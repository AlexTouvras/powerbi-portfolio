"""Build Drive Reliability gold: one row per drive in one Backblaze quarter.

The clock starts on the first day that drive appears in the quarter.
Event = 1 if the failure flag is set on any day. Drives still running are
censored on their last snapshot. This is not age from manufacture.
"""

from __future__ import annotations

import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd
import pyarrow.csv as pacsv

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
GOLD = ROOT / "data" / "gold"
ZIP_NAME = "data_Q1_2025.zip"
ZIP_URL = "https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_Q1_2025.zip"
COHORT = "2025Q1"
USECOLS = ["date", "serial_number", "model", "capacity_bytes", "failure"]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}")
    urllib.request.urlretrieve(url, dest)


def manufacturer(model: str) -> str:
    text = str(model).upper()
    if text.startswith("ST") or "SEAGATE" in text:
        return "Seagate"
    if text.startswith(("HGST", "HITACHI", "HUH", "HMS", "HDS")):
        return "HGST"
    if text.startswith("WDC") or text.startswith("WD"):
        return "WDC"
    if "TOSHIBA" in text:
        return "Toshiba"
    return "Other"


def read_day(archive: zipfile.ZipFile, name: str) -> pd.DataFrame:
    table = pacsv.read_csv(
        io.BytesIO(archive.read(name)),
        convert_options=pacsv.ConvertOptions(include_columns=USECOLS),
    )
    frame = table.to_pandas()
    frame["date"] = pd.to_datetime(frame["date"])
    frame = frame.dropna(subset=["serial_number", "date"])
    return frame.groupby("serial_number", sort=False).agg(
        first=("date", "min"),
        last=("date", "max"),
        failed=("failure", "max"),
        model=("model", "last"),
        capacity=("capacity_bytes", "max"),
    )


def fold_days(path: Path) -> pd.DataFrame:
    pieces: list[pd.DataFrame] = []
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.endswith(".csv")]
        if not names:
            raise SystemExit(f"no csv files in {path}")
        for index, name in enumerate(names, start=1):
            pieces.append(read_day(archive, name))
            print(f"{index}/{len(names)} {name}", flush=True)
    stacked = pd.concat(pieces)
    grouped = stacked.groupby(level=0, sort=False).agg(
        first=("first", "min"),
        last=("last", "max"),
        failed=("failed", "max"),
        model=("model", "last"),
        capacity=("capacity", "max"),
    )
    grouped = grouped.reset_index()
    grouped = grouped.loc[grouped["model"].notna() & grouped["capacity"].gt(0)].copy()
    grouped["TimeDays"] = (grouped["last"] - grouped["first"]).dt.days.astype(int)
    grouped["Manufacturer"] = grouped["model"].map(manufacturer)
    fact = pd.DataFrame(
        {
            "Serial": grouped["serial_number"].astype(str),
            "Model": grouped["model"].astype(str),
            "Manufacturer": grouped["Manufacturer"],
            "CapacityTb": (grouped["capacity"] / 1_000_000_000_000).round(2),
            "FirstDate": grouped["first"].dt.strftime("%Y-%m-%d"),
            "LastDate": grouped["last"].dt.strftime("%Y-%m-%d"),
            "TimeDays": grouped["TimeDays"],
            "Event": grouped["failed"].fillna(0).astype(int),
            "Cohort": COHORT,
        }
    )
    counts = fact["Manufacturer"].value_counts()
    small = set(counts[counts < 200].index)
    fact["Stratum"] = fact["Manufacturer"].where(~fact["Manufacturer"].isin(small), "Other")
    return fact


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    zip_path = RAW / ZIP_NAME
    download(ZIP_URL, zip_path)
    fact = fold_days(zip_path)
    if len(fact) < 50_000:
        raise SystemExit(f"drive grain is too small: {len(fact)}")
    if (fact["TimeDays"] < 0).any():
        raise SystemExit("time went negative")
    if set(fact["Event"].unique()) != {0, 1}:
        raise SystemExit("event must contain both 0 and 1")
    if fact["Event"].sum() < 50:
        raise SystemExit("too few failures to fit")
    fact.to_csv(GOLD / "FactDrive.csv", index=False)
    largest = fact["Stratum"].value_counts().idxmax()
    print(fact["Stratum"].value_counts().to_string())
    print(
        "GOLD_OK"
        f" rows={len(fact)}"
        f" events={int(fact['Event'].sum())}"
        f" censored={int((fact['Event'] == 0).sum())}"
        f" median_days={int(fact['TimeDays'].median())}"
        f" reference={largest}"
    )
    print(
        "fit: py -3.12 -m analytics_engine fit"
        " --csv data/gold/FactDrive.csv"
        " --time TimeDays --event Event --strata Stratum"
        " --covariates CapacityTb"
        f" --horizon 60 --reference Stratum={largest}"
        " --out data/fit-draft"
    )


if __name__ == "__main__":
    sys.exit(main())

"""Build Study Duration gold: one row per module registration.

Clock starts on module day 0.
Event = 1 when final_result is Withdrawn.
Pass, Fail, and Distinction are censored at the module length.
A withdrawal dated before day 0 never started, and is left out of this table.
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
GOLD = ROOT / "data" / "gold"
MIRROR = "https://raw.githubusercontent.com/data-edu/oulad/main/inst/extdata"
FILES = {
    "courses.parquet": f"{MIRROR}/courses.parquet",
    "studentInfo.parquet": f"{MIRROR}/studentInfo.parquet",
    "studentRegistration.parquet": f"{MIRROR}/studentRegistration.parquet",
}
KEYS = ["code_module", "code_presentation", "id_student"]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "PowerBI-portfolio"})
    with urllib.request.urlopen(request, timeout=120) as response, dest.open("wb") as out:
        out.write(response.read())


def load() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    frames = {}
    for name, url in FILES.items():
        path = RAW / name
        download(url, path)
        frames[name] = pd.read_parquet(path)
    courses = frames["courses.parquet"].rename(
        columns={"module_presentation_length": "CourseLengthDays"}
    )
    info = frames["studentInfo.parquet"]
    reg = frames["studentRegistration.parquet"]
    for frame in (info, reg):
        frame["id_student"] = frame["id_student"].astype("int64")
    return courses, info, reg


def build(courses: pd.DataFrame, info: pd.DataFrame, reg: pd.DataFrame) -> pd.DataFrame:
    merged = info.merge(reg, on=KEYS, how="inner", validate="one_to_one")
    merged = merged.merge(
        courses,
        on=["code_module", "code_presentation"],
        how="left",
        validate="many_to_one",
    )
    withdrawn = merged["final_result"].eq("Withdrawn")
    has_date = merged["date_unregistration"].notna()
    pre_start = withdrawn & has_date & merged["date_unregistration"].lt(0)
    print(f"withdrawn without a date, dropped: {int((withdrawn & ~has_date).sum())}")
    print(f"left before day 0, dropped: {int(pre_start.sum())}")
    print(f"stayers with an unregistration date, date ignored: {int((~withdrawn & has_date).sum())}")
    # The duration population is people who were still enrolled on day 0.
    keep = ~(withdrawn & ~has_date) & ~pre_start & merged["CourseLengthDays"].notna()
    work = merged.loc[keep].copy()
    length = work["CourseLengthDays"].astype(float)
    raw_time = work["date_unregistration"].clip(lower=0, upper=length)
    work["TimeDays"] = raw_time.where(withdrawn.loc[work.index], length).astype(int)
    work["Event"] = withdrawn.loc[work.index].astype(int)
    work["Stratum"] = work["code_module"].astype(str)
    work["Disability"] = work["disability"].map({"Y": 1, "N": 0})
    if work["Disability"].isna().any():
        raise SystemExit("disability had a value other than Y or N")
    out = pd.DataFrame(
        {
            "RegistrationId": (
                work["code_module"].astype(str)
                + "-"
                + work["code_presentation"].astype(str)
                + "-"
                + work["id_student"].astype(str)
            ),
            "StudentId": work["id_student"].astype(int),
            "Module": work["Stratum"],
            "Presentation": work["code_presentation"].astype(str),
            "TimeDays": work["TimeDays"],
            "Event": work["Event"],
            "Stratum": work["Stratum"],
            "CourseLengthDays": length.astype(int),
            "FinalResult": work["final_result"].astype(str),
            "AgeBand": work["age_band"].astype(str),
            "HighestEducation": work["highest_education"].astype(str),
            "Gender": work["gender"].astype(str),
            "Region": work["region"].astype(str),
            "ImdBand": work["imd_band"].fillna("Unknown").astype(str),
            "StudiedCredits": work["studied_credits"].astype(float),
            "PrevAttempts": work["num_of_prev_attempts"].astype(float),
            "Disability": work["Disability"].astype(int),
        }
    )
    return out


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    fact = build(*load())
    if len(fact) < 20_000:
        raise SystemExit(f"registration grain is too small: {len(fact)}")
    if set(fact["Event"].unique()) != {0, 1}:
        raise SystemExit("event must contain both 0 and 1")
    if (fact["TimeDays"] < 0).any():
        raise SystemExit("time went negative")
    if fact["Event"].sum() < 1_000:
        raise SystemExit("too few withdrawals to fit")
    # Stayers must sit on the course boundary, not on an invented earlier day.
    stayers = fact["Event"].eq(0)
    if not fact.loc[stayers, "TimeDays"].eq(fact.loc[stayers, "CourseLengthDays"]).all():
        raise SystemExit("a censored row is not on the course length")
    fact.to_csv(GOLD / "FactRegistration.csv", index=False)
    largest = fact["Stratum"].value_counts().idxmax()
    early = int(((fact["Event"] == 1) & (fact["TimeDays"] == 0)).sum())
    print(
        "GOLD_OK"
        f" rows={len(fact)}"
        f" events={int(fact['Event'].sum())}"
        f" censored={int((fact['Event'] == 0).sum())}"
        f" event_at_day0={early}"
        f" reference={largest}"
    )
    print(
        "fit: py -3.12 -m analytics_engine fit"
        " --csv data/gold/FactRegistration.csv"
        " --time TimeDays --event Event --strata Stratum"
        " --covariates AgeBand,HighestEducation,StudiedCredits,PrevAttempts,Disability,Gender"
        f" --horizon 100 --reference Stratum={largest}"
        " --out data/fit-draft"
    )


if __name__ == "__main__":
    sys.exit(main())

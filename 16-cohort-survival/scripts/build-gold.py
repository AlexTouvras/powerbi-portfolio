"""Build Cohort Survival gold from METABRIC overall survival.

One row per patient. Time is months from diagnosis. Event is all-cause death.
Living patients are censored at last follow-up. Relapse is a second clock and
is not in this file.
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
GOLD = ROOT / "data" / "gold"
CLINICAL_URL = (
    "https://media.githubusercontent.com/media/cBioPortal/datahub/master/"
    "public/brca_metabric/data_clinical_patient.txt"
)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "PowerBI-portfolio"})
    with urllib.request.urlopen(request, timeout=120) as response, dest.open("wb") as out:
        out.write(response.read())


def yes_no(series: pd.Series) -> pd.Series:
    text = series.fillna("").astype(str).str.strip().str.upper()
    return text.map({"YES": 1, "NO": 0})


def build() -> tuple[pd.DataFrame, int]:
    path = RAW / "data_clinical_patient.txt"
    download(CLINICAL_URL, path)
    raw = pd.read_csv(path, sep="\t", skiprows=4, dtype=str)
    started = len(raw)
    work = pd.DataFrame(
        {
            "PatientId": raw["PATIENT_ID"].str.strip(),
            "TimeMonths": pd.to_numeric(raw["OS_MONTHS"], errors="coerce"),
            "Event": raw["OS_STATUS"].fillna("").str.strip().str.startswith("1").astype(int),
            "Stratum": raw["CLAUDIN_SUBTYPE"].fillna("").str.strip(),
            "Age": pd.to_numeric(raw["AGE_AT_DIAGNOSIS"], errors="coerce"),
            "Nodes": pd.to_numeric(raw["LYMPH_NODES_EXAMINED_POSITIVE"], errors="coerce"),
            "Hormone": yes_no(raw["HORMONE_THERAPY"]),
            "Chemotherapy": yes_no(raw["CHEMOTHERAPY"]),
            "Radiotherapy": yes_no(raw["RADIO_THERAPY"]),
            "ErStatus": raw["ER_IHC"].fillna("").str.strip().replace({"Positve": "Positive"}),
            "Menopausal": raw["INFERRED_MENOPAUSAL_STATE"].fillna("").str.strip(),
            "Npi": pd.to_numeric(raw["NPI"], errors="coerce"),
        }
    )
    # A blank status must not become a censor. startswith on "" is 0, so drop it first.
    missing_status = raw["OS_STATUS"].fillna("").str.strip().eq("")
    work = work.loc[~missing_status.to_numpy()].copy()
    required = [
        "PatientId",
        "TimeMonths",
        "Stratum",
        "Age",
        "Nodes",
        "Hormone",
        "Chemotherapy",
        "Radiotherapy",
    ]
    work = work.dropna(subset=required)
    work = work.loc[work["Stratum"].ne("") & work["PatientId"].ne("")].copy()
    work["TimeMonths"] = work["TimeMonths"].astype(float)
    work["Event"] = work["Event"].astype(int)
    for column in ("Hormone", "Chemotherapy", "Radiotherapy", "Nodes"):
        work[column] = work[column].astype(int)
    work["Age"] = work["Age"].astype(float)
    counts = work["Stratum"].value_counts()
    small = set(counts[counts < 30].index)
    if small:
        print(f"dropped strata below 30 patients: {sorted(small)}")
        work = work.loc[~work["Stratum"].isin(small)].copy()
    return work.reset_index(drop=True), started - len(work)


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    fact, dropped = build()
    if len(fact) < 1_000:
        raise SystemExit(f"cohort is too small after drops: {len(fact)}")
    if (fact["TimeMonths"] < 0).any():
        raise SystemExit("time went negative")
    if set(fact["Event"].unique()) != {0, 1}:
        raise SystemExit("event must contain both 0 and 1")
    if fact["Event"].sum() < 100:
        raise SystemExit("too few deaths to fit")
    fact.to_csv(GOLD / "FactPatient.csv", index=False)
    largest = fact["Stratum"].value_counts().idxmax()
    print(f"excluded {dropped} source rows (missing clock or covariate, or a stratum under 30)")
    print(fact["Stratum"].value_counts().to_string())
    print(
        "GOLD_OK"
        f" rows={len(fact)}"
        f" events={int(fact['Event'].sum())}"
        f" censored={int((fact['Event'] == 0).sum())}"
        f" reference={largest}"
    )
    print(
        "fit: py -3.12 -m analytics_engine fit"
        " --csv data/gold/FactPatient.csv"
        " --time TimeMonths --event Event --strata Stratum"
        " --covariates Age,Nodes,Hormone,Chemotherapy,Radiotherapy"
        f" --horizon 60 --reference Stratum={largest}"
        " --out data/fit-draft"
    )


if __name__ == "__main__":
    sys.exit(main())

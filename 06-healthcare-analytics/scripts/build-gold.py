"""
Build Care Pulse gold tables from UCI Diabetes 130-US Hospitals.
Writes FactEncounter, DimPatient, DimDate, FactPathwayBridge, FactHeatBridge.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "uci" / "diabetic_data.csv"
MAP = ROOT / "data" / "raw" / "uci" / "IDS_mapping.csv"
GOLD = ROOT / "data" / "gold"
SAMPLE_N = 35000
RNG = np.random.default_rng(42)


def load_id_maps(path: Path) -> dict[str, dict[int, str]]:
    text = path.read_text(encoding="utf-8", errors="replace").splitlines()
    maps: dict[str, dict[int, str]] = {}
    current = None
    for line in text:
        line = line.strip()
        if not line:
            current = None
            continue
        if line.endswith(",description") and "_id" in line:
            current = line.split(",")[0]
            maps[current] = {}
            continue
        if current is None or "," not in line:
            continue
        # handle quoted descriptions
        parts = line.split(",", 1)
        try:
            kid = int(parts[0])
        except ValueError:
            continue
        desc = parts[1].strip().strip('"') if len(parts) > 1 else str(kid)
        if desc in ("NULL", "Not Mapped", "Unknown/Invalid", "Not Available", ""):
            desc = "Unknown"
        maps[current][kid] = desc
    return maps


def icd_group(code: str) -> str:
    if code is None or code == "?" or (isinstance(code, float) and np.isnan(code)):
        return "Unknown"
    s = str(code).strip()
    if s.startswith("V"):
        return "Supplemental (V)"
    if s.startswith("E"):
        return "External (E)"
    try:
        n = float(s)
    except ValueError:
        return "Other"
    if 390 <= n <= 459 or n == 785:
        return "Circulatory"
    if 460 <= n <= 519 or n == 786:
        return "Respiratory"
    if 520 <= n <= 579 or n == 787:
        return "Digestive"
    if str(s).startswith("250"):
        return "Diabetes"
    if 800 <= n <= 999:
        return "Injury"
    if 710 <= n <= 739:
        return "Musculoskeletal"
    if 580 <= n <= 629 or n == 788:
        return "Genitourinary"
    if 140 <= n <= 239:
        return "Neoplasms"
    return "Other"


def simplify_disposition(name: str) -> str:
    n = (name or "Unknown").lower()
    if "home" in n and "health" in n:
        return "Home health"
    if "home" in n:
        return "Home"
    if "snf" in n or "nursing" in n:
        return "SNF / nursing"
    if "hospice" in n:
        return "Hospice"
    if "expired" in n:
        return "Expired"
    if "rehab" in n:
        return "Rehab"
    if "ama" in n:
        return "Left AMA"
    if "transfer" in n or "another" in n or "hospital" in n:
        return "Transfer"
    if n == "unknown":
        return "Unknown"
    return "Other"


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    maps = load_id_maps(MAP)
    df = pd.read_csv(RAW, low_memory=False)
    # Drop expired / hospice discharges from modeling population (common practice)
    # but keep in gold with flag — exclude only from ML later
    df = df.sample(n=min(SAMPLE_N, len(df)), random_state=42).reset_index(drop=True)

    adm = maps.get("admission_type_id", {})
    dis = maps.get("discharge_disposition_id", {})
    src = maps.get("admission_source_id", {})

    df["AdmissionType"] = df["admission_type_id"].map(adm).fillna("Unknown")
    df["DischargeDisposition"] = df["discharge_disposition_id"].map(dis).fillna("Unknown")
    df["DischargeGroup"] = df["DischargeDisposition"].map(simplify_disposition)
    df["AdmissionSource"] = df["admission_source_id"].map(src).fillna("Unknown")
    df["AgeBand"] = df["age"].astype(str)
    df["Gender"] = df["gender"].replace({"Unknown/Invalid": "Unknown"})
    df["Race"] = df["race"].replace({"?": "Unknown"})
    df["DiagGroup"] = df["diag_1"].map(icd_group)
    df["Readmit30"] = (df["readmitted"] == "<30").astype(int)
    df["ReadmitOutcome"] = df["readmitted"].map(
        {"<30": "Readmit <30d", ">30": "Readmit >30d", "NO": "No readmit"}
    ).fillna("Unknown")
    df["LOSBand"] = pd.cut(
        df["time_in_hospital"],
        bins=[0, 3, 7, 14, 100],
        labels=["1-3d", "4-7d", "8-14d", "15d+"],
        include_lowest=True,
    ).astype(str)

    # Synthetic admission dates spanning ~3 years for trend visuals
    start = pd.Timestamp("2023-01-01")
    offsets = RNG.integers(0, 365 * 3, size=len(df))
    df["AdmissionDate"] = start + pd.to_timedelta(offsets, unit="D")

    # Pathway bridge: AdmissionType -> DischargeGroup (hop 1 only for stacked column /
    # Sankey Source→Target; hop 2 outcome mix is covered by discharge readmit bars)
    pathway = (
        df.groupby(["AdmissionType", "DischargeGroup"], as_index=False)
        .size()
        .rename(columns={"AdmissionType": "Source", "DischargeGroup": "Target", "size": "Weight"})
    )
    pathway["Hop"] = 1

    # Heat bridge for matrix / heatMap
    heat = (
        df.groupby(["AgeBand", "DiagGroup"], as_index=False)
        .agg(Encounters=("encounter_id", "count"), Readmit30=("Readmit30", "sum"))
    )
    heat["ReadmitRate"] = heat["Readmit30"] / heat["Encounters"]

    dim_patient = (
        df.sort_values("encounter_id")
        .groupby("patient_nbr", as_index=False)
        .agg(
            Race=("Race", "last"),
            Gender=("Gender", "last"),
            AgeBand=("AgeBand", "last"),
            EncounterCount=("encounter_id", "count"),
        )
    )

    dates = pd.date_range(df["AdmissionDate"].min(), df["AdmissionDate"].max(), freq="D")
    dim_date = pd.DataFrame({"Date": dates})
    dim_date["Year"] = dim_date["Date"].dt.year
    dim_date["Month"] = dim_date["Date"].dt.month
    dim_date["MonthName"] = dim_date["Date"].dt.strftime("%b")
    dim_date["YearMonth"] = dim_date["Date"].dt.strftime("%Y-%m")
    dim_date["Quarter"] = "Q" + dim_date["Date"].dt.quarter.astype(str)
    dim_date["YearQuarter"] = dim_date["Date"].dt.to_period("Q").astype(str)
    dim_date["Day"] = dim_date["Date"].dt.day
    dim_date["MonthYearSort"] = dim_date["Year"] * 100 + dim_date["Month"]

    fact = df[
        [
            "encounter_id",
            "patient_nbr",
            "AdmissionDate",
            "AdmissionType",
            "AdmissionSource",
            "DischargeDisposition",
            "DischargeGroup",
            "AgeBand",
            "Gender",
            "Race",
            "DiagGroup",
            "time_in_hospital",
            "num_lab_procedures",
            "num_procedures",
            "num_medications",
            "number_outpatient",
            "number_emergency",
            "number_inpatient",
            "number_diagnoses",
            "diabetesMed",
            "change",
            "A1Cresult",
            "insulin",
            "readmitted",
            "Readmit30",
            "ReadmitOutcome",
            "LOSBand",
        ]
    ].rename(
        columns={
            "encounter_id": "EncounterID",
            "patient_nbr": "PatientID",
            "time_in_hospital": "LengthOfStay",
            "num_lab_procedures": "LabProcedures",
            "num_procedures": "Procedures",
            "num_medications": "Medications",
            "number_outpatient": "PriorOutpatient",
            "number_emergency": "PriorEmergency",
            "number_inpatient": "PriorInpatient",
            "number_diagnoses": "DiagnosesCount",
            "diabetesMed": "DiabetesMed",
            "change": "MedChange",
            "A1Cresult": "A1CResult",
            "insulin": "Insulin",
            "readmitted": "ReadmittedRaw",
        }
    )

    fact.to_csv(GOLD / "FactEncounter.csv", index=False)
    dim_patient.to_csv(GOLD / "DimPatient.csv", index=False)
    dim_date.to_csv(GOLD / "DimDate.csv", index=False)
    pathway.to_csv(GOLD / "FactPathwayBridge.csv", index=False)
    heat.to_csv(GOLD / "FactHeatBridge.csv", index=False)

    print(
        json.dumps(
            {
                "ok": True,
                "encounters": len(fact),
                "patients": len(dim_patient),
                "readmit30_rate": round(float(fact["Readmit30"].mean()), 4),
                "pathway_rows": len(pathway),
                "gold": str(GOLD),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

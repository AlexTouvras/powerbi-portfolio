"""Build credit-risk gold from Home Credit (app + bureau + previous + installments).

Writes DimApplication.csv (pre-score feature table) and DimDate.csv.
Scoring / calibration / PSI / cut-off artefacts are produced by score-pd.py.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "_hf"
GOLD = ROOT / "data" / "gold"
SAMPLE_N = 80_000
RNG = 42


def read_parts(folder: Path) -> pd.DataFrame:
    files = sorted(folder.glob("*.parquet"))
    if not files:
        raise FileNotFoundError(folder)
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def aggregate_bureau(bur: pd.DataFrame) -> pd.DataFrame:
    g = bur.groupby("SK_ID_CURR", as_index=False).agg(
        BUR_CNT=("SK_ID_BUREAU", "count"),
        BUR_AMT_CREDIT_SUM=("AMT_CREDIT_SUM", "sum"),
        BUR_AMT_CREDIT_SUM_MEAN=("AMT_CREDIT_SUM", "mean"),
        BUR_AMT_CREDIT_SUM_DEBT=("AMT_CREDIT_SUM_DEBT", "sum"),
        BUR_AMT_CREDIT_SUM_OVERDUE=("AMT_CREDIT_SUM_OVERDUE", "sum"),
        BUR_DAYS_CREDIT_MEAN=("DAYS_CREDIT", "mean"),
        BUR_CREDIT_DAY_OVERDUE_MAX=("CREDIT_DAY_OVERDUE", "max"),
        BUR_CNT_CREDIT_PROLONG=("CNT_CREDIT_PROLONG", "sum"),
    )
    active = (
        bur.loc[bur["CREDIT_ACTIVE"] == "Active"]
        .groupby("SK_ID_CURR")
        .size()
        .rename("BUR_ACTIVE_CNT")
        .reset_index()
    )
    g = g.merge(active, on="SK_ID_CURR", how="left")
    g["BUR_ACTIVE_CNT"] = g["BUR_ACTIVE_CNT"].fillna(0).astype(int)
    return g


def aggregate_previous(prev: pd.DataFrame) -> pd.DataFrame:
    return prev.groupby("SK_ID_CURR", as_index=False).agg(
        PREV_CNT=("SK_ID_PREV", "count"),
        PREV_AMT_APPLICATION=("AMT_APPLICATION", "mean"),
        PREV_AMT_CREDIT=("AMT_CREDIT", "mean"),
        PREV_AMT_DOWN_PAYMENT=("AMT_DOWN_PAYMENT", "mean"),
        PREV_DAYS_DECISION=("DAYS_DECISION", "mean"),
        PREV_CNT_PAYMENT=("CNT_PAYMENT", "mean"),
        PREV_REFUSED_RATE=("NAME_CONTRACT_STATUS", lambda s: (s == "Refused").mean()),
        PREV_APPROVED_RATE=("NAME_CONTRACT_STATUS", lambda s: (s == "Approved").mean()),
    )


def aggregate_installments(inst: pd.DataFrame) -> pd.DataFrame:
    inst = inst.copy()
    inst["PAY_DIFF"] = inst["AMT_PAYMENT"] - inst["AMT_INSTALMENT"]
    inst["DELAY"] = inst["DAYS_ENTRY_PAYMENT"] - inst["DAYS_INSTALMENT"]
    return inst.groupby("SK_ID_CURR", as_index=False).agg(
        INST_CNT=("SK_ID_PREV", "count"),
        INST_PAY_DIFF_MEAN=("PAY_DIFF", "mean"),
        INST_DELAY_MEAN=("DELAY", "mean"),
        INST_DELAY_MAX=("DELAY", "max"),
        INST_AMT_PAYMENT_SUM=("AMT_PAYMENT", "sum"),
    )


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    print("Loading application…")
    app = pd.read_parquet(RAW / "application_train_dated" / "train-00000-of-00001.parquet")
    print("Loading bureau / previous / installments…")
    bur = pd.read_parquet(RAW / "bureau" / "train-00000-of-00001.parquet")
    prev = read_parts(RAW / "previous_application")
    inst = read_parts(RAW / "installments_payments")

    df = (
        app.merge(aggregate_bureau(bur), on="SK_ID_CURR", how="left")
        .merge(aggregate_previous(prev), on="SK_ID_CURR", how="left")
        .merge(aggregate_installments(inst), on="SK_ID_CURR", how="left")
    )
    df["application_date"] = pd.to_datetime(df["application_date"])
    df["AgeYears"] = (-df["DAYS_BIRTH"] / 365.25).round(1)
    emp = df["DAYS_EMPLOYED"].replace(365243, np.nan)
    df["EmploymentYears"] = (-emp / 365.25).round(1)
    df["CreditIncomeRatio"] = (df["AMT_CREDIT"] / df["AMT_INCOME_TOTAL"].replace(0, np.nan)).clip(
        upper=50
    )
    df["AnnuityIncomeRatio"] = (
        df["AMT_ANNUITY"] / df["AMT_INCOME_TOTAL"].replace(0, np.nan)
    ).clip(upper=5)
    df["EXT_MEAN"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].mean(axis=1)
    df["EXT_MIN"] = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].min(axis=1)
    df["GOODS_CREDIT_RATIO"] = df["AMT_GOODS_PRICE"] / df["AMT_CREDIT"].replace(0, np.nan)
    df["EAD"] = df["AMT_CREDIT"].astype(float)
    df["LGD"] = 0.45
    df["OCCUPATION_TYPE"] = df["OCCUPATION_TYPE"].fillna("Unknown")
    df["ORGANIZATION_TYPE"] = df["ORGANIZATION_TYPE"].fillna("Unknown")
    df["CODE_GENDER"] = df["CODE_GENDER"].replace({"XNA": "Unknown"})

    # Fill numeric aggregates
    for c in df.columns:
        if c.startswith(("BUR_", "PREV_", "INST_")) and pd.api.types.is_numeric_dtype(df[c]):
            df[c] = df[c].fillna(0)

    # Keep full frame for scoring; write a marker file path used by score-pd
    full_path = GOLD / "_full_features.parquet"
    df.to_parquet(full_path, index=False)
    print(f"Wrote full feature frame {full_path} rows={len(df):,}")

    # Stratified Desktop sample shell (scores filled later)
    keep, _ = train_test_split(
        df, train_size=SAMPLE_N, stratify=df["TARGET"], random_state=RNG
    )
    keep = keep.reset_index(drop=True)
    for col in [
        "PD",
        "Score",
        "Grade",
        "GradeSort",
        "RiskBand",
        "RiskRank",
        "EL",
        "Stage",
        "RecommendedAction",
        "IsOOT",
        "Decision",
    ]:
        keep[col] = np.nan if col in {"PD", "Score", "GradeSort", "RiskRank", "EL", "IsOOT"} else ""

    keep.to_csv(GOLD / "DimApplication.csv", index=False)
    print(f"Wrote DimApplication shell sample={len(keep):,} default={keep['TARGET'].mean():.4f}")

    dmin, dmax = df["application_date"].min(), df["application_date"].max()
    dates = pd.date_range(dmin, dmax, freq="D")
    pd.DataFrame(
        {
            "Date": dates,
            "Year": dates.year,
            "Month": dates.month,
            "YearMonth": dates.strftime("%Y-%m"),
            "Quarter": dates.quarter,
        }
    ).to_csv(GOLD / "DimDate.csv", index=False)


if __name__ == "__main__":
    main()

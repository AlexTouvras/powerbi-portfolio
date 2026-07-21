"""
Score 30-day readmission propensity; merge into FactEncounter.csv.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "data" / "gold"
FACT = GOLD / "FactEncounter.csv"
MODEL_DIR = GOLD / "models"


def main() -> None:
    df = pd.read_csv(FACT)
    # Exclude expired / hospice from training target population but still score all
    train_mask = ~df["DischargeGroup"].isin(["Expired", "Hospice"])

    y = df["Readmit30"]
    num_cols = [
        "LengthOfStay",
        "LabProcedures",
        "Procedures",
        "Medications",
        "PriorOutpatient",
        "PriorEmergency",
        "PriorInpatient",
        "DiagnosesCount",
    ]
    cat_cols = [
        "AdmissionType",
        "AdmissionSource",
        "DischargeGroup",
        "AgeBand",
        "Gender",
        "Race",
        "DiagGroup",
        "DiabetesMed",
        "MedChange",
        "A1CResult",
        "Insulin",
        "LOSBand",
    ]

    X = df[num_cols + cat_cols].copy()
    for c in cat_cols:
        X[c] = X[c].fillna("Unknown").astype(str)
    for c in num_cols:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0)

    X_train, X_test, y_train, y_test = train_test_split(
        X.loc[train_mask],
        y.loc[train_mask],
        test_size=0.25,
        random_state=42,
        stratify=y.loc[train_mask],
    )

    pre = ColumnTransformer(
        [
            ("num", StandardScaler(), num_cols),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                cat_cols,
            ),
        ]
    )
    clf = Pipeline(
        [
            ("pre", pre),
            (
                "model",
                LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
            ),
        ]
    )
    clf.fit(X_train, y_train)
    proba_test = clf.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, proba_test))

    all_proba = clf.predict_proba(X)[:, 1]
    df["ReadmitProbability"] = all_proba
    # Risk bands by tertiles on scored population
    q1, q2 = np.quantile(all_proba, [1 / 3, 2 / 3])
    df["RiskBand"] = pd.cut(
        all_proba,
        bins=[-0.01, q1, q2, 1.01],
        labels=["Low", "Medium", "High"],
    ).astype(str)
    df["RiskRank"] = df["ReadmitProbability"].rank(method="dense", ascending=False).astype(int)

    df.to_csv(FACT, index=False)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, MODEL_DIR / "readmit_logistic.joblib")

    print(
        json.dumps(
            {
                "ok": True,
                "encounters": len(df),
                "roc_auc": round(auc, 4),
                "readmit30_rate": round(float(df["Readmit30"].mean()), 4),
                "risk_bands": df["RiskBand"].value_counts().to_dict(),
                "thresholds": {"low_max": round(float(q1), 4), "med_max": round(float(q2), 4)},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

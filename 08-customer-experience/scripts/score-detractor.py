"""Train detractor propensity model and merge scores into FactReviews gold.

Predicts P(ProxyNPSClass = Detractor) from delivery / category ops features.
Sample-model for portfolio demo — not production CX scoring.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold" / "FactReviews.csv"
MODEL_DIR = ROOT / "data" / "gold" / "models"
MODEL_PATH = MODEL_DIR / "detractor_logistic.joblib"
METRICS_PATH = ROOT / "data" / "gold" / "ModelMetrics.json"

FEATURES_NUM = ["LeadTimeDays", "Freight", "LateFlag", "HasComment", "OnTime"]
FEATURES_CAT = ["Category", "CustomerState", "ThemePrimary", "DeliveryOutcome"]


def lead_time_band(days: int) -> str:
    d = int(days)
    if d <= 7:
        return "0-7d"
    if d <= 14:
        return "8-14d"
    if d <= 21:
        return "15-21d"
    if d <= 30:
        return "22-30d"
    return "31d+"


def main() -> None:
    df = pd.read_csv(GOLD)
    if "ProxyNPSClass" not in df.columns:
        raise SystemExit("FactReviews missing ProxyNPSClass — run enrich-reviews.py first")

    df["IsDetractor"] = (df["ProxyNPSClass"] == "Detractor").astype(int)
    df["LeadTimeBand"] = df["LeadTimeDays"].map(lead_time_band)

    y = df["IsDetractor"]
    X = df[FEATURES_NUM + FEATURES_CAT].copy()

    pre = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                FEATURES_NUM,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                FEATURES_CAT,
            ),
        ]
    )

    clf = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)
    pipe = Pipeline([("pre", pre), ("clf", clf)])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    pipe.fit(X_train, y_train)
    proba_test = pipe.predict_proba(X_test)[:, 1]
    pred_test = (proba_test >= 0.5).astype(int)

    metrics = {
        "target": "IsDetractor (ProxyNPSClass=Detractor)",
        "accuracy": round(float(accuracy_score(y_test, pred_test)), 4),
        "precision": round(float(precision_score(y_test, pred_test, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred_test, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba_test)), 4),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "base_rate": round(float(y.mean()), 4),
        "features_num": FEATURES_NUM,
        "features_cat": FEATURES_CAT,
    }

    proba_all = pipe.predict_proba(X)[:, 1]
    df["DetractorProbability"] = np.round(proba_all, 4)
    df["PredictedDetractor"] = (proba_all >= 0.5).astype(int)

    # Policy bands (not equal-count tertiles) so triage funnel has real shape.
    def risk_band(p: float) -> str:
        if p >= 0.50:
            return "High"
        if p >= 0.30:
            return "Medium"
        return "Low"

    df["RiskBand"] = df["DetractorProbability"].map(risk_band)
    df["RiskBandSort"] = df["RiskBand"].map({"High": 1, "Medium": 2, "Low": 3}).astype(int)
    df["RiskRank"] = (
        df["DetractorProbability"].rank(method="dense", ascending=False).astype(int)
    )

    band_counts = df["RiskBand"].value_counts().to_dict()
    metrics["risk_band_cutoffs"] = {"High": ">=0.50", "Medium": "0.30–0.50", "Low": "<0.30"}
    metrics["risk_band_counts"] = {k: int(band_counts.get(k, 0)) for k in ("High", "Medium", "Low")}

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    df.to_csv(GOLD, index=False)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(json.dumps({"ok": True, "metrics": metrics, "gold": str(GOLD)}, indent=2))


if __name__ == "__main__":
    main()

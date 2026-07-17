"""Train churn propensity model and merge scores into gold DimCustomer.csv."""
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
GOLD = ROOT / "data" / "gold" / "DimCustomer.csv"
MODEL_DIR = ROOT / "data" / "gold" / "models"
MODEL_PATH = MODEL_DIR / "churn_logistic.joblib"

FEATURES_NUM = [
    "Tenure",
    "CityTier",
    "WarehouseToHome",
    "HourSpendOnApp",
    "NumberOfDeviceRegistered",
    "SatisfactionScore",
    "NumberOfAddress",
    "Complain",
    "OrderAmountHikeFromlastYear",
    "CouponUsed",
    "OrderCount",
    "DaySinceLastOrder",
    "CashbackAmount",
    "RecencyScore",
    "FrequencyScore",
]
FEATURES_CAT = [
    "PreferredLoginDevice",
    "PreferredPaymentMode",
    "Gender",
    "PreferedOrderCat",
    "MaritalStatus",
    "WarehouseDistanceBand",
    "TenureBand",
    "CashbackBand",
]


def main() -> None:
    df = pd.read_csv(GOLD)
    y = df["Churn"].astype(int)
    X = df[FEATURES_NUM + FEATURES_CAT]

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
        "accuracy": round(float(accuracy_score(y_test, pred_test)), 4),
        "precision": round(float(precision_score(y_test, pred_test, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred_test, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, proba_test)), 4),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    }

    # Score full population
    proba_all = pipe.predict_proba(X)[:, 1]
    df["ChurnProbability"] = np.round(proba_all, 4)
    df["PredictedChurn"] = (proba_all >= 0.5).astype(int)

    tertiles = np.quantile(proba_all, [1 / 3, 2 / 3])

    def risk_band(p: float) -> str:
        if p <= tertiles[0]:
            return "Low"
        if p <= tertiles[1]:
            return "Medium"
        return "High"

    df["RiskBand"] = df["ChurnProbability"].map(risk_band)
    df["RiskRank"] = df["ChurnProbability"].rank(method="dense", ascending=False).astype(int)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    df.to_csv(GOLD, index=False)

    print(json.dumps({"ok": True, "metrics": metrics, "gold": str(GOLD), "model": str(MODEL_PATH)}, indent=2))


if __name__ == "__main__":
    main()

"""RFM scoring + k-means segments; merge into DimCustomer.csv."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"
AS_OF = pd.Timestamp("2026-07-17")


def quintile_score(s: pd.Series, ascending: bool = True) -> pd.Series:
    """1–5 score; for recency ascending=False means lower days = better."""
    try:
        return pd.qcut(s.rank(method="first", ascending=ascending), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    except ValueError:
        # Fallback if too many ties
        r = s.rank(pct=True, ascending=ascending)
        return pd.cut(r, bins=[-0.01, 0.2, 0.4, 0.6, 0.8, 1.01], labels=[1, 2, 3, 4, 5]).astype(int)


def main() -> None:
    cust = pd.read_csv(GOLD / "DimCustomer.csv")
    acct = pd.read_csv(GOLD / "DimAccount.csv")
    txn = pd.read_csv(GOLD / "FactTransactions.csv", parse_dates=["TransactionDate"])

    # Product count & balance
    prod = acct.groupby("CustomerID").agg(
        ProductCount=("AccountID", "nunique"),
        TotalBalance=("Balance", "sum"),
        AccountTypes=("AccountType", lambda s: "|".join(sorted(set(s)))),
    )

    # RFM from transactions
    debit = txn[txn["TransactionType"] == "debit"]
    g = txn.groupby("CustomerID").agg(
        LastTxnDate=("TransactionDate", "max"),
        Frequency=("TransactionID", "count"),
        MonetaryAll=("Amount", "sum"),
    )
    g_deb = debit.groupby("CustomerID")["Amount"].sum().rename("MonetaryDebit")
    g = g.join(g_deb, how="left").fillna({"MonetaryDebit": 0})
    g["RecencyDays"] = (AS_OF - g["LastTxnDate"]).dt.days.clip(lower=0)
    g["IsDormant"] = (g["RecencyDays"] > 365).astype(int)

    # Customers with no txns
    all_ids = cust["CustomerID"]
    g = g.reindex(all_ids)
    g["Frequency"] = g["Frequency"].fillna(0)
    g["MonetaryDebit"] = g["MonetaryDebit"].fillna(0)
    g["MonetaryAll"] = g["MonetaryAll"].fillna(0)
    g["RecencyDays"] = g["RecencyDays"].fillna(999)
    g["IsDormant"] = g["IsDormant"].fillna(1).astype(int)
    g["LastTxnDate"] = g["LastTxnDate"].fillna(pd.NaT)

    g["R_Score"] = quintile_score(g["RecencyDays"], ascending=False)  # low days = high score
    # For dormant-heavy, invert: fewer days since last = higher R
    # Wait: ascending=False on RecencyDays means larger days get lower rank in qcut with ascending=False...
    # qcut on rank(ascending=False): high RecencyDays → high rank number → high score. Wrong.
    # Fix: score so low RecencyDays → 5
    g["R_Score"] = quintile_score(g["RecencyDays"], ascending=True)
    # With ascending=True on RecencyDays: low days → low score. Invert:
    g["R_Score"] = 6 - g["R_Score"]
    g["F_Score"] = quintile_score(g["Frequency"], ascending=True)
    g["M_Score"] = quintile_score(g["MonetaryDebit"], ascending=True)
    g["RFM_Score"] = g["R_Score"] * 100 + g["F_Score"] * 10 + g["M_Score"]

    # k-means on scaled R/F/M
    X = g[["R_Score", "F_Score", "M_Score"]].astype(float).values
    Xs = StandardScaler().fit_transform(X)
    km = KMeans(n_clusters=4, random_state=42, n_init=10)
    g["Cluster"] = km.fit_predict(Xs)

    # Label clusters by mean RFM
    centers = g.groupby("Cluster")[["R_Score", "F_Score", "M_Score"]].mean()
    centers["strength"] = centers["R_Score"] + centers["F_Score"] + centers["M_Score"]
    order = centers["strength"].sort_values(ascending=False).index.tolist()
    label_map = {
        order[0]: "Champions",
        order[1]: "Loyal",
        order[2]: "At Risk",
        order[3]: "Hibernating",
    }
    g["ValueSegment"] = g["Cluster"].map(label_map)

    # Engagement funnel stage
    def stage(row):
        if row["IsDormant"] == 1 or row["Frequency"] == 0:
            return "Dormant"
        if row["ProductCount"] >= 2 and row["M_Score"] >= 4:
            return "High Value"
        if row["ProductCount"] >= 2:
            return "Multi-Product"
        return "Active"

    out = cust.set_index("CustomerID").join(prod, how="left").join(
        g[
            [
                "RecencyDays",
                "Frequency",
                "MonetaryDebit",
                "R_Score",
                "F_Score",
                "M_Score",
                "RFM_Score",
                "IsDormant",
                "ValueSegment",
                "LastTxnDate",
            ]
        ],
        how="left",
    )
    out["ProductCount"] = out["ProductCount"].fillna(1).astype(int)
    out["TotalBalance"] = out["TotalBalance"].fillna(0)
    out["AccountTypes"] = out["AccountTypes"].fillna("savings")
    out["EngagementStage"] = out.apply(stage, axis=1)
    out["LastTxnDate"] = out["LastTxnDate"].dt.strftime("%Y-%m-%d").fillna("")

    out = out.reset_index()
    # Column order
    cols = [
        "CustomerID",
        "CustomerName",
        "Gender",
        "BirthDate",
        "SignupDate",
        "City",
        "Latitude",
        "Longitude",
        "ProductCount",
        "TotalBalance",
        "AccountTypes",
        "RecencyDays",
        "Frequency",
        "MonetaryDebit",
        "R_Score",
        "F_Score",
        "M_Score",
        "RFM_Score",
        "IsDormant",
        "ValueSegment",
        "EngagementStage",
        "LastTxnDate",
    ]
    out[cols].to_csv(GOLD / "DimCustomer.csv", index=False)

    # Flow stages helper for waterfall (summary fact)
    flow = pd.DataFrame(
        [
            {"FlowStage": "Credit inflow", "FlowOrder": 1, "FlowAmount": float(txn.loc[txn["TransactionType"] == "credit", "Amount"].sum())},
            {"FlowStage": "Debit outflow", "FlowOrder": 2, "FlowAmount": -float(txn.loc[txn["TransactionType"] == "debit", "Amount"].sum())},
        ]
    )
    flow.to_csv(GOLD / "FactFlowBridge.csv", index=False)

    summary = {
        "ok": True,
        "customers": int(len(out)),
        "segments": out["ValueSegment"].value_counts().to_dict(),
        "dormant_pct": round(float(out["IsDormant"].mean()) * 100, 2),
        "transactions": int(len(txn)),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

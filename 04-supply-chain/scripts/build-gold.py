"""Build Logistics Pulse gold from Olist Brazilian E-Commerce CSVs.

Writes FactOrders, DimSeller, DimProduct, DimCustomer, DimDate, FactCorridor,
FactDemandWeekly. Forecast band + ModelMetrics come from forecast-demand.py.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
GOLD = ROOT / "data" / "gold"
MIN_SELLER_ORDERS = 30


def read_csv(name: str) -> pd.DataFrame:
    path = RAW / name
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path)


def week_start(s: pd.Series) -> pd.Series:
    return s.dt.to_period("W-SUN").dt.start_time.dt.normalize()


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)

    print("Loading Olist…")
    orders = read_csv("olist_orders_dataset.csv")
    items = read_csv("olist_order_items_dataset.csv")
    sellers = read_csv("olist_sellers_dataset.csv")
    customers = read_csv("olist_customers_dataset.csv")
    products = read_csv("olist_products_dataset.csv")
    cat_tr = read_csv("product_category_name_translation.csv")

    # --- DQ pass ---
    n_orders_raw = len(orders)
    status_counts = orders["order_status"].value_counts().to_dict()
    delivered = orders[orders["order_status"] == "delivered"].copy()
    for col in (
        "order_purchase_timestamp",
        "order_delivered_customer_date",
        "order_estimated_delivery_date",
    ):
        delivered[col] = pd.to_datetime(delivered[col], errors="coerce")

    before_null = len(delivered)
    delivered = delivered.dropna(
        subset=["order_delivered_customer_date", "order_estimated_delivery_date", "order_purchase_timestamp"]
    )
    dropped_null_dates = before_null - len(delivered)

    delivered["OrderDate"] = delivered["order_purchase_timestamp"].dt.normalize()
    delivered["DeliveredDate"] = delivered["order_delivered_customer_date"].dt.normalize()
    delivered["EstimatedDate"] = delivered["order_estimated_delivery_date"].dt.normalize()
    delivered["OnTime"] = (delivered["DeliveredDate"] <= delivered["EstimatedDate"]).astype(int)
    delivered["LeadTimeDays"] = (
        delivered["DeliveredDate"] - delivered["OrderDate"]
    ).dt.days.clip(lower=0)
    delivered["LateFlag"] = 1 - delivered["OnTime"]

    # Primary seller / freight / category at order grain
    item_agg = (
        items.groupby("order_id", as_index=False)
        .agg(
            Freight=("freight_value", "sum"),
            ItemCount=("order_item_id", "count"),
            SellerCount=("seller_id", "nunique"),
            PrimarySellerID=("seller_id", "first"),
            PrimaryProductID=("product_id", "first"),
        )
    )
    products = products.merge(cat_tr, on="product_category_name", how="left")
    products["Category"] = products["product_category_name_english"].fillna(
        products["product_category_name"].fillna("unknown")
    )
    prod_cat = products[["product_id", "Category"]]

    items_cat = items.merge(prod_cat, on="product_id", how="left")
    # modal category per order
    cat_mode = (
        items_cat.groupby("order_id")["Category"]
        .agg(lambda s: s.mode().iloc[0] if len(s.mode()) else "unknown")
        .reset_index()
        .rename(columns={"Category": "Category"})
    )

    fact = delivered.merge(item_agg, left_on="order_id", right_on="order_id", how="inner")
    fact = fact.merge(cat_mode, on="order_id", how="left")
    fact["Category"] = fact["Category"].fillna("unknown")
    fact = fact.merge(
        customers[["customer_id", "customer_unique_id", "customer_state"]],
        on="customer_id",
        how="left",
    )
    fact = fact.merge(
        sellers[["seller_id", "seller_city", "seller_state"]],
        left_on="PrimarySellerID",
        right_on="seller_id",
        how="left",
    )

    fact_out = pd.DataFrame(
        {
            "OrderID": fact["order_id"],
            "CustomerID": fact["customer_unique_id"],
            "OrderDate": fact["OrderDate"].dt.strftime("%Y-%m-%d"),
            "SellerID": fact["PrimarySellerID"],
            "CustomerState": fact["customer_state"].fillna("UNK"),
            "SellerState": fact["seller_state"].fillna("UNK"),
            "Category": fact["Category"],
            "OnTime": fact["OnTime"].astype(int),
            "LateFlag": fact["LateFlag"].astype(int),
            "LeadTimeDays": fact["LeadTimeDays"].astype(int),
            "Freight": fact["Freight"].round(2),
            "ItemCount": fact["ItemCount"].astype(int),
            "SellerCount": fact["SellerCount"].astype(int),
        }
    )
    fact_out.to_csv(GOLD / "FactOrders.csv", index=False)
    print(f"FactOrders: {len(fact_out):,}  (raw orders {n_orders_raw:,}; dropped null dates {dropped_null_dates:,})")
    print(f"  status mix (all): {status_counts}")
    print(f"  on-time rate: {fact_out['OnTime'].mean():.1%}")

    # DimSeller
    seller_stats = (
        fact_out.groupby("SellerID", as_index=False)
        .agg(
            OrderN=("OrderID", "count"),
            LateRate=("LateFlag", "mean"),
            AvgFreight=("Freight", "mean"),
            AvgLeadTime=("LeadTimeDays", "mean"),
            CustomerStateN=("CustomerState", "nunique"),
        )
    )
    seller_stats = seller_stats.merge(
        sellers.rename(
            columns={
                "seller_id": "SellerID",
                "seller_city": "City",
                "seller_state": "State",
            }
        )[["SellerID", "City", "State"]],
        on="SellerID",
        how="left",
    )
    seller_stats["LateRate"] = seller_stats["LateRate"].round(4)
    seller_stats["AvgFreight"] = seller_stats["AvgFreight"].round(2)
    seller_stats["AvgLeadTime"] = seller_stats["AvgLeadTime"].round(1)

    def risk_band(row: pd.Series) -> str:
        if row["OrderN"] < MIN_SELLER_ORDERS:
            return "Low volume"
        if row["LateRate"] >= 0.20:
            return "High"
        if row["LateRate"] >= 0.10:
            return "Medium"
        return "Low"

    def action(row: pd.Series) -> str:
        if row["OrderN"] < MIN_SELLER_ORDERS:
            return "Watch — below volume gate"
        if row["LateRate"] >= 0.20:
            return "Intervene — high late rate"
        if row["LateRate"] >= 0.10:
            return "Review — rising late rate"
        return "Maintain — on-time seller"

    seller_stats["RiskBand"] = seller_stats.apply(risk_band, axis=1)
    seller_stats["RecommendedAction"] = seller_stats.apply(action, axis=1)
    ranked = seller_stats[seller_stats["OrderN"] >= MIN_SELLER_ORDERS].sort_values(
        ["LateRate", "OrderN"], ascending=[False, False]
    )
    rank_map = {sid: i + 1 for i, sid in enumerate(ranked["SellerID"])}
    seller_stats["RiskRank"] = seller_stats["SellerID"].map(rank_map).fillna(0).astype(int)
    seller_stats.to_csv(GOLD / "DimSeller.csv", index=False)
    print(f"DimSeller: {len(seller_stats):,} (ranked >={MIN_SELLER_ORDERS}: {len(ranked):,})")

    # DimProduct (category)
    dim_prod = (
        fact_out.groupby("Category", as_index=False)
        .agg(OrderN=("OrderID", "count"), LateRate=("LateFlag", "mean"), AvgLeadTime=("LeadTimeDays", "mean"))
    )
    dim_prod["LateRate"] = dim_prod["LateRate"].round(4)
    dim_prod["AvgLeadTime"] = dim_prod["AvgLeadTime"].round(1)
    dim_prod.to_csv(GOLD / "DimProduct.csv", index=False)

    # DimCustomer
    dim_cust = (
        fact_out.groupby("CustomerID", as_index=False)
        .agg(State=("CustomerState", "first"), OrderN=("OrderID", "count"))
    )
    dim_cust.to_csv(GOLD / "DimCustomer.csv", index=False)

    # FactCorridor
    corridor = (
        fact_out.groupby(["SellerState", "CustomerState"], as_index=False)
        .agg(
            Orders=("OrderID", "count"),
            LateRate=("LateFlag", "mean"),
            AvgLeadTime=("LeadTimeDays", "mean"),
            AvgFreight=("Freight", "mean"),
        )
    )
    corridor["LateRate"] = corridor["LateRate"].round(4)
    corridor["AvgLeadTime"] = corridor["AvgLeadTime"].round(1)
    corridor["AvgFreight"] = corridor["AvgFreight"].round(2)
    corridor = corridor[corridor["Orders"] >= 20].sort_values("LateRate", ascending=False)
    corridor.to_csv(GOLD / "FactCorridor.csv", index=False)
    print(f"FactCorridor: {len(corridor):,} corridors (≥20 orders)")

    # DimDate
    dmin = pd.to_datetime(fact_out["OrderDate"]).min()
    dmax = pd.to_datetime(fact_out["OrderDate"]).max()
    dates = pd.date_range(dmin, dmax, freq="D")
    dim_date = pd.DataFrame({"Date": dates})
    dim_date["Year"] = dim_date["Date"].dt.year
    dim_date["Month"] = dim_date["Date"].dt.month
    dim_date["MonthName"] = dim_date["Date"].dt.strftime("%b")
    dim_date["YearMonth"] = dim_date["Date"].dt.strftime("%Y-%m")
    dim_date["Quarter"] = "Q" + dim_date["Date"].dt.quarter.astype(str)
    dim_date["YearQuarter"] = dim_date["Year"].astype(str) + dim_date["Quarter"]
    dim_date["Day"] = dim_date["Date"].dt.day
    dim_date["MonthYearSort"] = dim_date["Year"] * 100 + dim_date["Month"]
    dim_date["Date"] = dim_date["Date"].dt.strftime("%Y-%m-%d")
    dim_date.to_csv(GOLD / "DimDate.csv", index=False)

    # Weekly demand actuals
    od = pd.to_datetime(fact_out["OrderDate"])
    weekly = (
        pd.DataFrame({"WeekStart": week_start(od), "Orders": 1})
        .groupby("WeekStart", as_index=False)["Orders"]
        .sum()
        .sort_values("WeekStart")
    )
    weekly["WeekStart"] = weekly["WeekStart"].dt.strftime("%Y-%m-%d")
    weekly.to_csv(GOLD / "FactDemandWeekly.csv", index=False)
    print(f"FactDemandWeekly: {len(weekly):,} weeks")

    dq = GOLD / "DQ_NOTES.md"
    dq.write_text(
        f"""# Gold DQ notes — Logistics Pulse

Generated by `scripts/build-gold.py`.

| Check | Result |
|-------|--------|
| Raw orders | {n_orders_raw:,} |
| Status mix | `{status_counts}` |
| Delivered with usable dates | {len(fact_out):,} |
| Dropped null delivery/estimate/purchase | {dropped_null_dates:,} |
| On-time rate | {fact_out['OnTime'].mean():.1%} |
| Avg lead time (days) | {fact_out['LeadTimeDays'].mean():.1f} |
| Seller volume gate | >= {MIN_SELLER_ORDERS} orders to rank |
| Geolocation | Not loaded (no map hero in v1) |

On-time = delivered calendar date <= estimated delivery calendar date.
In-Full (true OTIF) is out of v1.
""",
        encoding="utf-8",
    )
    print("Wrote DQ_NOTES.md")
    print("Done. Next: python scripts/forecast-demand.py")


if __name__ == "__main__":
    main()

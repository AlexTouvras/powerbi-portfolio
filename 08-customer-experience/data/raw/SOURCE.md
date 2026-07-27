# Customer experience — raw sources

## Primary (locked): Olist Brazilian E-Commerce reviews

| | |
|--|--|
| Dataset | [olistbr/brazilian-ecommerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) |
| Review file | `olist_order_reviews_dataset.csv` |
| Ops grain | Join to Logistics Pulse `FactOrders` (`04-supply-chain/data/gold/`) |

## Local layout

This folder may hold a copy or symlink of Olist CSVs. The enrich script prefers:

1. `08-customer-experience/data/raw/olist_order_reviews_dataset.csv`
2. Else `04-supply-chain/data/raw/olist_order_reviews_dataset.csv`

Orders / sellers / categories come from `04-supply-chain/data/gold/FactOrders.csv` (already cleaned delivered grain).

## Caveats

- Review score is **1–5** (CSAT-like), not a textbook 0–10 NPS question
- Free-text comments are Portuguese; gold stores machine EN via Argos Translate
- Theme labels are keyword rules (PT + EN), not a trained classifier

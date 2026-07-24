# Supply chain — raw sources

## Primary (locked): Olist Brazilian E-Commerce

| | |
|--|--|
| Dataset | [olistbr/brazilian-ecommerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) |
| Scale | 100k+ orders · 9 relational CSVs · 2016–2018 |
| Why | Real multi-entity logistics grain (orders × sellers × freight × geo) |

## Download

Prefer the official Kaggle dataset (requires Kaggle CLI + credentials):

```powershell
cd 04-supply-chain/data/raw
kaggle datasets download -d olistbr/brazilian-ecommerce
Expand-Archive brazilian-ecommerce.zip -DestinationPath .
```

GitHub mirror used for local builds when Kaggle CLI is unavailable:

`https://github.com/0PeterAdel/Brazilian-ECommerce/tree/main/0.DataSet`

Expected files include: `olist_orders_dataset.csv`, `olist_order_items_dataset.csv`, `olist_sellers_dataset.csv`, `olist_customers_dataset.csv`, `olist_order_payments_dataset.csv`, `olist_order_reviews_dataset.csv`, `olist_products_dataset.csv`, `product_category_name_translation.csv`.  
`olist_geolocation_dataset.csv` is optional in v1 (no map hero).

## Alternative

DataCo Smart Supply Chain — backup if Olist download fails; prefer Olist for relational star modeling.

## Caveats

- Brazilian marketplace sample — not Nordic ops data  
- Forecasts are portfolio demos, not inventory policy advice  
- Prefer gitignore for large raw CSVs; commit curated gold only  

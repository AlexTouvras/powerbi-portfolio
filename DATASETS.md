# Data sources — KDNuggets article

Article: https://www.kdnuggets.com/5-real-world-sql-projects-to-build-your-data-portfolio

| # | Topic | Article link | Staged here |
|---|-------|--------------|-------------|
| 1 | E-commerce churn | [Judithokon/Ecommerce-Customer-Churn…](https://github.com/Judithokon/Ecommerce-Customer-Churn-Analysis-Using-SQL) | `02-ecommerce-churn/data/raw/` |
| 2 | SQL data warehouse | [DataWithBaraa/sql-data-warehouse-project](https://github.com/DataWithBaraa/sql-data-warehouse-project) | Used as raw input for Sales (`03-sales-executive/data/raw/`) — no separate portfolio folder |
| 3 | Sales analysis | [Kaggle: emirakyer/sql-sales-data-analysis](https://www.kaggle.com/code/emirakyer/sql-sales-data-analysis) | `03-sales-executive/data/raw/` *(see note)* |
| 4 | Bank segmentation | [franklinanalytics/Bank-Segmentation-Analysis](https://github.com/franklinanalytics/Bank-Segmentation-Analysis) | `05-bank-segmentation/data/raw/` (SQL generators; gold CSVs to be built) |
| 5 | Healthcare | [Kaggle: gizellef/healthcare…](https://www.kaggle.com/code/gizellef/healthcare-data-analysis-using-sql) | `06-healthcare-analytics/` — **pending** (needs Kaggle download) |

## Active / featured builds

| Project | Dataset | Notes |
|---------|---------|-------|
| `03-sales-executive` | KDNuggets #2 warehouse CSVs (sales grain) | C-level sales — **featured** |
| `02-ecommerce-churn` | KDNuggets #1 `ecommerce_churn.csv` | ML propensity + drivers — **featured** |
| `05-bank-segmentation` | KDNuggets #4 simulated bank (customers · accounts · transactions) | **Next** |

### Sales (`03-sales-executive`)

The Kaggle sales notebook does not expose a public downloadable dataset. For the C-level sales report we use the **CRM/ERP CSVs from the KDNuggets article’s warehouse project (#2)** — AdventureWorks-style sales already shaped for star-schema reporting:

- `sales_details.csv` — fact (order line)
- `cust_info.csv`, `CUST_AZ12.csv`, `LOC_A101.csv` — customer / geo
- `prd_info.csv`, `PX_CAT_G1V2.csv` — product / category

Observed: **60,398** order lines · revenue **~$29.4M** · dates **2010-12-29 → 2014-01-28**

### Churn (`02-ecommerce-churn`)

KDNuggets #1 customer-level churn export:

- `ecommerce_churn.csv` — 5,630 customers · **16.84%** churn rate
- Gold pipeline adds tenure/recency bands + logistic **ChurnProbability** / **RiskBand**

### Bank (`05-bank-segmentation`)

Upstream ships PostgreSQL generators only (`schema_setup.sql`, `data_generation.sql`). Schema:

- `customers` — id, name, gender, dob, signup_date, city  
- `accounts` — customer_id, account_type (`savings` | `current` | `loan`), balance, account_number  
- `transactions` — account_id, date, amount, credit/debit, description  

Upstream scale is small (~200 customers · ~1k transactions). Portfolio build should **seed a larger gold layer** (Node/Python) with the same schema for credible volume, then RFM + engagement analytics in Power BI.

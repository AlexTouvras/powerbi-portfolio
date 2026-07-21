# Data sources — KDNuggets article

Article: https://www.kdnuggets.com/5-real-world-sql-projects-to-build-your-data-portfolio

| # | Topic | Article link | Staged here |
|---|-------|--------------|-------------|
| 1 | E-commerce churn | [Judithokon/Ecommerce-Customer-Churn…](https://github.com/Judithokon/Ecommerce-Customer-Churn-Analysis-Using-SQL) | `02-ecommerce-churn/data/raw/` |
| 2 | SQL data warehouse | [DataWithBaraa/sql-data-warehouse-project](https://github.com/DataWithBaraa/sql-data-warehouse-project) | Used as raw input for Sales (`03-sales-executive/data/raw/`) — no separate portfolio folder |
| 3 | Sales analysis | [Kaggle: emirakyer/sql-sales-data-analysis](https://www.kaggle.com/code/emirakyer/sql-sales-data-analysis) | `03-sales-executive/data/raw/` *(see note)* |
| 4 | Bank segmentation | [franklinanalytics/Bank-Segmentation-Analysis](https://github.com/franklinanalytics/Bank-Segmentation-Analysis) | `05-bank-segmentation/data/raw/` + scaled `data/gold/` |
| 5 | Healthcare | [Kaggle: gizellef/healthcare…](https://www.kaggle.com/code/gizellef/healthcare-data-analysis-using-sql) | KDNuggets #5 billing sample lacks outcomes — **portfolio uses UCI Diabetes 130-US** under `06-healthcare-analytics/data/raw/uci/` |

## Active / featured builds

| Project | Dataset | Notes |
|---------|---------|-------|
| `03-sales-executive` | KDNuggets #2 warehouse CSVs (sales grain) | C-level sales — **featured** |
| `02-ecommerce-churn` | KDNuggets #1 `ecommerce_churn.csv` | ML propensity + drivers — **featured** |
| `05-bank-segmentation` | KDNuggets #4 simulated bank (customers · accounts · transactions) | **Featured** — RFM + k-means |
| `06-healthcare-analytics` | UCI Diabetes 130-US Hospitals (~35k encounter sample) | **Featured** — 30d readmit propensity + pathway ribbon + heat |
| `01-finance` | Yahoo Finance delayed Nordic large caps (~43 tickers · FI/SE/DK/NO) | **Featured** — live gold refresh + sector treemap + SMA/MACD/RSI/BB |

### Nordic Equity (`01-finance`)

Curated OMX-style large caps with daily OHLCV from Yahoo chart API:

- Gold: `DimCompany`, `DimDate`, `FactPrices` (+ indicators)
- Refresh: `node scripts/build-gold.mjs` then Desktop Refresh
- Delayed quotes — not tick real-time; not investment advice

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

Upstream scale is small (~200 customers · ~1k transactions). Portfolio gold is a **scaled seed** (~5k customers · ~113k transactions) plus RFM + k-means `ValueSegment`, geocoded `DimCity`, and `FactFlowBridge` for the waterfall.

### Healthcare (`06-healthcare-analytics`)

KDNuggets #5 Kaggle billing notebooks often lack a true readmission label. Care Pulse uses **[UCI Diabetes 130-US Hospitals](https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008)**:

- Raw: `diabetic_data.csv` (+ IDS mappings)
- Gold: ~35k encounters with `Readmit30`, pathway bridge, heat bridge
- ML: logistic **ReadmitProbability** / **RiskBand** / **RiskRank** (sample model, not clinical CDS)


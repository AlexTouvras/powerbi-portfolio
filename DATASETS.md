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
| `01-finance` | Yahoo Finance delayed Nordic large/mid caps (~82 tickers · FI/SE/DK/NO) | **Featured** — PBIP + [live Vercel board](https://heatmap-web-five.vercel.app) · weekday gold refresh Action |
| `11-credit-risk` | **[Home Credit Default Risk](https://www.kaggle.com/c/home-credit-default-risk)** (~80k scored sample · OOT Gini ~55%) | **Featured** — LightGBM+Platt PD · cut-off frontier · PSI · steering |

### Nordic Equity (`01-finance`)

Curated OMX-style large caps with daily OHLCV from Yahoo chart API:

- Gold: `DimCompany`, `DimDate`, `FactPrices` (+ indicators)
- Live web board: [https://heatmap-web-five.vercel.app](https://heatmap-web-five.vercel.app) (`heatmap-web/`)
- Manual refresh: `node scripts/build-gold.mjs` → `node scripts/snapshot-board.mjs` → Desktop Refresh
- Scheduled: `.github/workflows/nordic-equity-gold-refresh.yml` (weekdays 17:00 UTC) commits gold + `board.json`; optional `VERCEL_DEPLOY_HOOK` redeploys the site
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

## Wave 2 — planned (folders scaffolded)

| Project | Dataset | Status |
|---------|---------|--------|
| `12-investing-desk` | Local [`investing`](../investing) platform (capital.yaml + sims + price cache) | Prework |
| `04-supply-chain` | [Olist Brazilian E-Commerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) | Prework |
| `07-helsinki-energy` | [Helsinki Nuuka open API](https://hri.fi/data/en/dataset/helsingin-kaupungin-palvelukiinteistojen-energiankulutustietoja) | Prework — API verified (~1.8k properties) |
| `10-fpa-controllership` | Seeded Nordic multi-entity Actual + Budget + FX | Prework |

### Credit risk / scorecards (`11-credit-risk`)

**Featured:** Home Credit Default Risk — retail PD scorecard (LightGBM + Platt), grades G1–G8, EL @ LGD 0.45, acceptance-frontier cut-off vs `EXT_MEAN`, PSI + new-business monitoring + steering queue.

- Gold sample: **80k** stratified apps · default **8.07%** · **OOT Gini ~55.3%** / AUC ~0.78
- Operating cut-off (risk–reward @ 4% appetite): PD ≤ **7.5%** · OOT approval **~74%** · bad rate among approved **~4.0%**
- Raw via Hugging Face mirror (`scripts/download-homecredit.py`) or Kaggle CLI — **gitignored**
- Open [`11-credit-risk/CreditRisk.pbip`](11-credit-risk/CreditRisk.pbip)
- Sample model only — not production IRB / IFRS 9

### Investing desk (`12-investing-desk`)

Gold exported from `C:\Users\kater\.cursor\projects\investing` — sleeve policy, TSMOM vs VWCE sims, risk gates. Complements Nordic Equity (market board) with allocation research.

### Supply chain (`04-supply-chain`)

Olist 9-CSV relational marketplace (orders, sellers, freight, geo) → OTIF + demand forecast gold.

### Facility energy (`07-helsinki-energy`)

Nuuka open API (no auth): property list + daily/hourly electricity/heat/water/cooling. Cohort sample first (not all properties hourly).

### Controllership (`10-fpa-controllership`)

Seeded P&L (Actual vs Budget, entities, CoA, FX) — public XBRL dumps skipped for clean BvA / what-if storytelling.


# Sources (KDNuggets #3 Sales)

Primary article: https://www.kdnuggets.com/5-real-world-sql-projects-to-build-your-data-portfolio  
Sales notebook linked in article: https://www.kaggle.com/code/emirakyer/sql-sales-data-analysis (dataset not publicly downloadable)

**Working files** (from article project #2 warehouse CSVs — same article, sales-ready):

| File | Role | Join key |
|------|------|----------|
| `sales_details.csv` | Fact — order line | `sls_prd_key`, `sls_cust_id` |
| `cust_info.csv` | Customer | `cst_id` ↔ `sls_cust_id` |
| `CUST_AZ12.csv` | Customer birth/gender (ERP) | `CID` ↔ `cst_key` (normalize `AW-` prefix) |
| `LOC_A101.csv` | Customer country | `CID` ↔ `cst_key` |
| `prd_info.csv` | Product | `prd_key` ↔ `sls_prd_key` |
| `PX_CAT_G1V2.csv` | Product category | category id from product key prefix |

Upstream: https://github.com/DataWithBaraa/sql-data-warehouse-project/tree/main/datasets

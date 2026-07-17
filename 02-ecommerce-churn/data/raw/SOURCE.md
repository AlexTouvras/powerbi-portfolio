# Sources (KDNuggets #1 E-commerce churn)

Primary article: https://www.kdnuggets.com/5-real-world-sql-projects-to-build-your-data-portfolio  
Upstream: https://github.com/Judithokon/Ecommerce-Customer-Churn-Analysis-Using-SQL

| File | Role |
|------|------|
| `ecommerce_churn.csv` | Customer-level churn export (5,630 rows · ~16.84% churn) |
| `EcommerceCustomerChurnAnalysis.sql` | Source SQL cleaning / exploration notebook companion |

Gold layer (`../gold/DimCustomer.csv`) adds cleaned categoricals, tenure/recency/cashback bands, and ML columns (`ChurnProbability`, `RiskBand`, `RiskRank`) from `scripts/score-churn.py`.

# 02 — E-commerce Churn Retention (Advanced Analytics)

Nordic Boardroom retention report: churn rate and propensity at a glance, driver analysis (Key Influencers + decomposition), and an at-risk intervention queue.

**Open:** [`ChurnRetention.pbip`](ChurnRetention.pbip)

## Preview

![Retention Pulse](screenshots/retention-pulse.png)

![Churn Drivers](screenshots/churn-drivers.png)

![At-Risk Queue](screenshots/at-risk-queue.png)

## Pages

| Page | Role |
|------|------|
| **Retention Pulse** | KPI strip · churn rate by tenure band |
| **Churn Drivers** | Key Influencers · decomposition tree · payment × city-tier matrix |
| **At-Risk Queue** | Customers ranked by `ChurnProbability` · risk / city / satisfaction slicers |

## What's in the folder

| Piece | Path |
|-------|------|
| PBIP entry | `ChurnRetention.pbip` |
| Report (PBIR) | `ChurnRetention.Report/` |
| Semantic model (TMDL) | `ChurnRetention.SemanticModel/` |
| Gold scored CSV | `data/gold/DimCustomer.csv` |
| Raw export + SQL notes | `data/raw/` |
| Spec | `_brief/report-spec.md` |
| Screenshots | `screenshots/` |
| Gold ETL | `scripts/build-gold.mjs` |
| ML scoring | `scripts/score-churn.py` |
| Elevate layout | `scripts/elevate-churn-report.mjs` |
| Python deps | `requirements.txt` |

## Open in Power BI Desktop

1. Clone this repo.
2. Open `02-ecommerce-churn/ChurnRetention.pbip`.
3. Set the **GoldDataFolder** parameter (Transform data → Manage parameters) to your local path, for example:

   ```text
   C:/Users/<you>/.../powerbi-portfolio/02-ecommerce-churn/data/gold
   ```

   Use forward slashes. Then **Close & Apply**.
4. If Desktop shows relationship/data banners, click **Refresh now**, then **Save**.

## Rebuild gold + scores

```bash
pip install -r requirements.txt
node scripts/build-gold.mjs
python scripts/score-churn.py
```

Hold-out metrics (stratified split): ROC-AUC ~0.89. Scores are **sample-model** output for portfolio demonstration, not a production CRM score.

## Validate report definition

```bash
powerbi-report-author validate ChurnRetention.Report
```

## Audience & design

- Audience: CRO / retention lead / lifecycle marketing  
- Theme: Nordic Boardroom (same chrome as Sales Executive: page nav pills, mist canvas, footer source line)  
- Source: [Judithokon E-commerce Churn SQL](https://github.com/Judithokon/Ecommerce-Customer-Churn-Analysis-Using-SQL) (KDNuggets #1) — see [`../DATASETS.md`](../DATASETS.md)

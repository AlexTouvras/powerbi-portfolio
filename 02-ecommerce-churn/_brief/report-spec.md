# Report Spec — E-commerce Churn Retention

## Report identity
- Report name: Churn Retention — Advanced Analytics
- Semantic model: local PBIP from `02-ecommerce-churn/data/gold` (ML-scored customer table)
- Audience: CRO / retention lead / lifecycle marketing
- Primary purpose: Understand churn drivers, quantify risk, and surface an actionable at-risk queue
- Delivery target: Local PBIP + portfolio screenshots

## User decisions
- Scope: KDNuggets #1 e-commerce churn (Judithokon SQL project)
- Page count: **3 analysis + Context (last visible)**
- Advanced stack: Python propensity model → gold CSV → Key Influencers + Decomposition + risk queue
- Design: Nordic Boardroom theme; risk bands use semantic green/amber/red
- Data: 5,630 customers · ~17% churn · customer grain

## Page plan

1. **Retention Pulse** — Executive — churn rate, customer count, avg propensity, high-risk count; churn rate by tenure band
2. **Churn Drivers** — Analytical — Key Influencers on Churn; decomposition tree on churn rate; payment mode × city tier matrix
3. **At-Risk Queue** — Operational — retained high-risk customers table sorted by probability
4. **Context** (last visible) — audience, how to read influencers/decomposition, data/model caveats

## Measures (DimCustomer)
- Customers, Churned Customers, Churn Rate, Avg Churn Probability, High Risk Customers, Retained High Risk

## Verify
- `node scripts/build-gold.mjs` → `python scripts/score-churn.py`
- `powerbi-report-author validate ChurnRetention.Report`
- Desktop refresh + `screenshot-all` without warning banners

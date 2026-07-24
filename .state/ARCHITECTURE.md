# Architecture (working log)

> Tracked in git. Living decisions for this repo — not a substitute for `docs/architecture/`.

## Overview

Nordic Boardroom Power BI portfolio: gold CSVs → TMDL semantic model → PBIR pages → screenshots / optional Orbit sync. Wave 2 reports reuse theme + Landing archetypes from featured builds.

## Data shapes

| Name | Shape / location | Notes |
|------|------------------|-------|
| Nordic Equity gold | `01-finance/data/gold/` — DimCompany, DimDate, FactPrices | Yahoo delayed · ~82 Nordic caps · indicators + RSI signals |
| Investing research | `../investing` — capital.yaml, sim_latest.json, research_selection_kpis.csv | Sleeve policy · Core vs Mid sims · risk gates |
| Investing Desk gold | `12-investing-desk/data/gold/` | Export merges both sources |
| Logistics Olist gold | `04-supply-chain/data/gold/` | FactOrders + FactForecast band · ~96k delivered |

## Design patterns

- Nordic Boardroom theme; Landing = portfolio poster + unique mist atmosphere per report
- Dual-source reports: research policy from investing + market tape from Nordic Equity (no Fabric composite model in v1 — copy/export gold)
- Forecast signature: Demand Outlook uses Actual/Forecast/Lo80/Hi80 line series with per-measure metadata color selectors
- Scatter Size/X/Y must bind **measures** (or Aggregations), never bare columns

## Dependencies

| Dependency | Why introduced | Date |
|------------|----------------|------|
| Sibling `investing` repo | Capital / sims / gates source of truth | 2026-07-23 |
| `01-finance` gold + live board | Nordic tape backdrop + CTA | 2026-07-23 |
| Olist Brazilian E-Commerce | Logistics Pulse orders / sellers / freight | 2026-07-24 |
| statsmodels SARIMAX | Weekly demand forecast + PI bands | 2026-07-24 |

## File structure

```text
04-supply-chain/
├── LogisticsPulse.pbip
├── LogisticsPulse.Report/
├── LogisticsPulse.SemanticModel/
├── data/gold/
├── scripts/
│   ├── build-gold.py
│   ├── forecast-demand.py
│   ├── scaffold-logistics-pbip.mjs
│   └── elevate-logistics-report.mjs
└── _brief/report-spec.md
```

## Key decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-23 | Investing Desk uses **both** investing research exports and Nordic Equity gold | User: utilize Nordic Equity + research investing repo |
| 2026-07-23 | v1 = local gold copy (not live composite model across PBIPs) | Portable PBIP; Desktop refresh stays simple |
| 2026-07-23 | Report framed as **Investment Portfolio** (CIO) | User: JPMorgan-level+ |
| 2026-07-24 | Logistics Pulse signature = demand forecast PI ribbon; KPI = On-time % (not true OTIF) | Portfolio gap = forecasting; In-Full deferred; avoid Bank Icon Map hero |
| 2026-07-24 | Trim Olist early ramp + trailing stub week before SARIMAX holdout | Raw end-of-sample wind-down inflated MAPE to >100% |

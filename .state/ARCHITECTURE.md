# Architecture (working log)

> Tracked in git. Living decisions for this repo — not a substitute for `docs/architecture/`.

## Overview

Nordic Boardroom Power BI portfolio: gold CSVs → TMDL semantic model → PBIR pages → screenshots / optional Orbit sync. Wave 2 reports reuse theme + Landing archetypes from featured builds.

## Data shapes

| Name | Shape / location | Notes |
|------|------------------|-------|
| Nordic Equity gold | `01-finance/data/gold/` — DimCompany, DimDate, FactPrices | Yahoo delayed · ~82 Nordic caps · indicators + RSI signals |
| Investing research | `../investing` — capital.yaml, sim_latest.json, research_selection_kpis.csv | Sleeve policy · Core vs Mid sims · risk gates |
| Investing Desk gold | `12-investing-desk/data/gold/` | Export merges both sources + risk layer |
| Experience Pulse gold | `08-customer-experience/data/gold/` | FactReviews + themes; join to Logistics FactOrders |

## Design patterns

- Nordic Boardroom theme; Landing = portfolio poster + unique mist atmosphere per report (`_shared/scripts/ensure-landing-atmosphere.mjs` registry: fjord-dawn, alpine-mist, coastal-fog, valley-dusk, harbor-mist, linen-mist)
- Semantic per-category chart colors use a `scopeColor`/`scopeColorInt` dataPoint selector (`{ selector: { data: [{ scopeId: { Comparison: ... } }] } }`) instead of conditional-formatting rules — works for both string bands (e.g. DeliveryOutcome) and integer categories (e.g. ReviewScore 1–5)
- Visual-level table filters (e.g. "ReviewScore ≤ 2" default) use an Advanced filter with a `Comparison` condition (`ComparisonKind: 4` = LessThanOrEqual) in `filterConfig.filters[].filter.Where`, sibling to the `visual` key on the visual.json
- Dual-source reports: research policy from investing + market tape from Nordic Equity (no Fabric composite model in v1 — copy/export gold)
- Forecast signature: Demand Outlook uses Actual/Forecast/Lo80/Hi80 line series with per-measure metadata color selectors
- Scatter Size/X/Y must bind **measures** (or Aggregations), never bare columns

## Dependencies

| Dependency | Why introduced | Date |
|------------|----------------|------|
| Sibling `investing` repo | Capital / sims / gates source of truth | 2026-07-23 |
| `01-finance` gold + live board | Nordic tape backdrop + CTA | 2026-07-23 |
| Olist Brazilian E-Commerce | Logistics Pulse orders / sellers / freight | 2026-07-24 |
| Argos Translate (PT→EN) | Experience Pulse review comment English | 2026-07-26 |
| scikit-learn | Experience Pulse detractor logistic propensity | 2026-07-26 |
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

08-customer-experience/
├── ExperiencePulse.pbip
├── ExperiencePulse.Report/
├── ExperiencePulse.SemanticModel/
├── data/gold/          # FactReviews + theme tables; dims synced from logistics
├── scripts/
│   ├── enrich-reviews.py
│   ├── score-detractor.py
│   ├── scaffold-experience-pbip.mjs
│   └── elevate-experience-report.mjs
└── _brief/report-spec.md
```

## Key decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-26 | Experience Pulse (`08-customer-experience`) = Olist reviews × Logistics FactOrders; brand CSAT/score not true NPS; signature = score erosion by delivery outcome; Landing `linen-mist` | Portfolio VoC gap; ops linkage differentiates vs gauge-NPS dashboards |
| 2026-07-26 | Experience Pulse advanced stack = logistic `DetractorProbability` + Key Influencers + decomposition (Churn-parity); score erosion remains visual signature | User: no disruption/next-level analytics vs peers |
| 2026-07-27 | Experience Pulse Drivers = tall KI left; decomp + theme matrix top-right; score erosion full-width below | User layout polish — KI scroll + whitespace |
| 2026-07-23 | Investing Desk uses **both** investing research exports and Nordic Equity gold | User: utilize Nordic Equity + research investing repo |
| 2026-07-23 | v1 = local gold copy (not live composite model across PBIPs) | Portable PBIP; Desktop refresh stays simple |
| 2026-07-23 | Report framed as **Investment Portfolio** (CIO) | User: JPMorgan-level+ |
| 2026-07-24 | Logistics Pulse signature = demand forecast PI ribbon; KPI = On-time % (not true OTIF) | Portfolio gap = forecasting; In-Full deferred; avoid Bank Icon Map hero |
| 2026-07-24 | Trim Olist early ramp + trailing stub week before SARIMAX holdout | Raw end-of-sample wind-down inflated MAPE to >100% |
| 2026-08-14 | Investing Desk Risk & Mandate shows live-sleeve 95% VaR + book vs min-vol vs max-Sharpe | User: risk as extra layer, not Ledger 2.0; first cycle gold + one visual |

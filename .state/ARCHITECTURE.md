# Architecture (working log)

> Tracked in git. Living decisions for this repo — not a substitute for `docs/architecture/`.

## Overview

Nordic Boardroom Power BI portfolio: gold CSVs → TMDL semantic model → PBIR pages → screenshots / optional Orbit sync. Wave 2 reports reuse theme + Landing archetypes from featured builds.

## Data shapes

| Name | Shape / location | Notes |
|------|------------------|-------|
| Nordic Equity gold | `01-finance/data/gold/` — DimCompany, DimDate, FactPrices | Yahoo delayed · ~82 Nordic caps · indicators + RSI signals |
| Investing research | `../investing` — capital.yaml, sim_latest.json, research_selection_kpis.csv | Sleeve policy · Core vs Mid sims · risk gates |
| Investing Desk gold (planned) | `12-investing-desk/data/gold/` | Export merges both sources |

## Design patterns

- Nordic Boardroom theme; Landing = portfolio poster + harbor-mist atmosphere (from Nordic Equity)
- Dual-source reports: research policy from investing + market tape from Nordic Equity (no Fabric composite model in v1 — copy/export gold)

## Dependencies

| Dependency | Why introduced | Date |
|------------|----------------|------|
| Sibling `investing` repo | Capital / sims / gates source of truth | 2026-07-23 |
| `01-finance` gold + live board | Nordic tape backdrop + CTA | 2026-07-23 |

## File structure

```text
12-investing-desk/
├── InvestingDesk.pbip
├── InvestingDesk.Report/
├── InvestingDesk.SemanticModel/
├── data/gold/          # export-from-sources output
├── scripts/
│   ├── export-from-sources.mjs
│   ├── scaffold-investing-desk-pbip.mjs
│   └── elevate-investing-desk-report.mjs
└── _brief/report-spec.md
```

## Key decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-23 | Investing Desk uses **both** investing research exports and Nordic Equity gold | User: utilize Nordic Equity + research investing repo; differentiation stays policy/sims vs market board |
| 2026-07-23 | v1 = local gold copy (not live composite model across PBIPs) | Portable PBIP; Desktop refresh stays simple |
| 2026-07-23 | Report framed as **Investment Portfolio** (CIO), not hobby research desk | User: JPMorgan-level+; pages = allocation / excess performance / holdings / mandate / regional markets |

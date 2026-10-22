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
- Finished-report showcase: `_shared/scripts/capture_showcase.py` writes `screenshots/<page>.png`. Bridge snapshots already omit the ribbon, visualizations pane, data pane, and page tabs. The script then drops the Filters pane and flat fit-to-page bars so the file is the page canvas. A centered cut is used when those bars are flat. When the page is top-aligned and only the strip under it is flat, the cut stays at the top so a landing photograph is not sliced. Pixels that were hidden under an expanded Filters pane are not in the snapshot.
- Semantic per-category chart colors use a `scopeColor`/`scopeColorInt` dataPoint selector (`{ selector: { data: [{ scopeId: { Comparison: ... } }] } }`) instead of conditional-formatting rules — works for both string bands (e.g. DeliveryOutcome) and integer categories (e.g. ReviewScore 1–5)
- Visual-level table filters (e.g. "ReviewScore ≤ 2" default) use an Advanced filter with a `Comparison` condition (`ComparisonKind: 4` = LessThanOrEqual) in `filterConfig.filters[].filter.Where`, sibling to the `visual` key on the visual.json
- Dual-source reports: research policy from investing + market tape from Nordic Equity (no Fabric composite model in v1 — copy/export gold)
- Forecast signature: Demand Outlook uses Actual/Forecast/Lo80/Hi80 line series with per-measure metadata color selectors
- Scatter Size/X/Y must bind **measures** (or Aggregations), never bare columns
- Bank Value argument (2026-10-20): Franchise Pulse waterfall is net flow by `ValueSegment` (sentiment colors), not the credit/debit bridge. Segments compares `Customer Share` vs `Balance Share`. Relationship Book leads with single-product balances. `Landing Thesis` is a DAX sentence from engaged vs quiet net flow.

## Dependencies

| Dependency | Why introduced | Date |
|------------|----------------|------|
| Sibling `investing` repo | Capital / sims / gates source of truth | 2026-07-23 |
| `01-finance` gold + live board | Nordic tape backdrop + CTA | 2026-07-23 |
| Olist Brazilian E-Commerce | Logistics Pulse orders / sellers / freight | 2026-07-24 |
| Argos Translate (PT→EN) | Experience Pulse review comment English | 2026-07-26 |
| scikit-learn | Experience Pulse detractor logistic propensity | 2026-07-26 |
| statsmodels SARIMAX | Weekly demand forecast + PI bands | 2026-07-24 |
| lifelines | Duration engine: Kaplan–Meier, Cox, Grambsch–Therneau | 2026-10-19 |
| Pillow | Canvas crop of showcase PNGs (`_shared/scripts/capture_showcase.py`) | 2026-10-20 |

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

Wave 3 grains sit beside that tree. `14-learning-duration` has `StudyDuration.pbip`. `13-wine-market`, `15-drive-reliability`, and `16-cohort-survival` are still gold plus a draft `_brief/report-spec.md`.

## Analytics engine

`_shared/analytics_engine` fits a caller-supplied duration table (time, event, optional strata and covariates). It writes FactKm, StratumSummary, FactCensor, FactCox, FactPh, FactBetaT, FactResidual, FactInfluence, FactAdjusted, FactHazard, FactCoxSnell, FactCalibration, FactAalen, FactDecision, FactNomogram, FactPrediction, and ModelMetrics. `render` draws the survminer-style curves and seven censoring-aware estimands: smoothed hazard, Cox–Snell, calibration, Aalen additive hazard, decision curve, Cox nomogram, and a restricted-mean contrast on one shared clock with a Greenwood interval. Cumulative hazard stops where survival falls below 0.02. Every figure ends with the column binding, the latest follow-up time, and an eight-character fit-hash prefix. `render` repeats that line in `figures.json` with the full hash. `cite` and `render` refuse a draft. The CLI cannot write `APPROVED`; a person copies `fit_hash.txt` there. Label outcomes stay on the logistic scripts. A single series stays on SARIMAX. Contract: `docs/architecture/analytics-engine.md`. The approved Study Duration render is checked in at `docs/gallery/study-duration/` and indexed by `docs/GALLERY.md` (fit tables stay gitignored).

## Plot catalogue

`docs/PLOT_CATALOGUE.md` is the reusable visual vocabulary (≥24 core plots). Instrument pages keep Nordic Boardroom; argument pages use claim-as-title + engine figures. Catalogue scaffolds in `_shared/scripts/plot-patterns.mjs`: slope/dumbbell (#16–17), stream (#18), seasonal decomp (#19), lollipop (#20), Statement (`buildStatementLayout` — CoA operator table + variance bars on Controllership). Prefer extending existing gold/TMDL tables — Desktop can wipe brand-new table files on reopen. Controllership = seeded Nordic BvA gold (`10-fpa-controllership`) + Landing / P&L Pulse / Variance Drivers / Scenarios / Context (+ hidden Line Profile). Signature: claim thesis + Budget→Actual OP waterfall bridge (`DimBridgeStep` + `Bridge Amount`; start = Budget OP with `IsTotal`; end = waterfall Show total ≈ Actual) + KPI sparklines + CoA statement + exception queue with drillthrough (Pulse); entity Actual/Budget compare + monthly gap slope + leaf heat (Drivers). `Signed Variance Eur` = `VarianceEur × DimAccount[Sign]`. Landing conclusion = DAX text measures (`Landing Thesis` / `Landing Subthesis`) on cards. Native waterfall has no PBIR mid-category Set-as-total — Actual bookend is `totalsEnabled`, not a Category row. Scenarios = precomputed `FactScenario` OP bands, not live what-if. Gantt is companion-only for duration questions. Raw-time histogram/barcode/raincloud are refused for censored data.

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
| 2026-10-19 | Duration engine is dataset-free. Care Pulse stays a 30-day label: UCI has no readmission time | User: do not bind a dataset to set the engine |
| 2026-10-19 | Extra figures are censoring-aware estimands (hazard, Cox–Snell, calibration, Aalen, decision curve, nomogram, restricted-mean contrast). A histogram or barcode of recorded time is not in the collection | User: the extra charts were too basic |
| 2026-10-19 | Plot catalogue locked at ≥24 easy-advanced forms in `docs/PLOT_CATALOGUE.md` (shipped + OpenBI gap + engine argument set) | User: reach >20 sophisticated-but-clear plots for 99th-percentile work |
| 2026-10-20 | Wave 3 starts as gold + draft specs: `13-wine-market`, `14-learning-duration`, `15-drive-reliability`, `16-cohort-survival`. Study Duration later gained a PBIP; the other three have not | User: initial steps for the wine desk and the duration tables. The engine still does not own a dataset. |
| 2026-10-20 | Controllership Landing conclusion = DAX narrative measures on cards (not static textbox) | User: dynamic conclusion that recalculates with Period/Entity |
| 2026-10-20 | Controllership Pulse: `DimBridgeStep` bridge + sparklines + hidden Line Profile drillthrough | User: Budget→Actual totals, KPI sparklines, drill from queue |
| 2026-10-20 | Controllership showcase PNGs shipped under `screenshots/` | Portfolio piece ready |
| 2026-10-20 | `_shared/deneb/` Vega-Lite binders (KM / forest / β(t)) + PBIR helpers; AppSource GUID | Plot catalogue P1; argument pages only |
| 2026-10-20 | Study Duration: approved fit + `StudyDuration.pbip` Argument page binds FactKm/Cox/BetaT via Deneb | User: wire binders onto approved duration argument page |
| 2026-10-20 | ModelMetrics KPI measure is `Fit Concordance` (not `Concordance`) — Tabular forbids measure name = column name on same table | Desktop DataModelLoadFailed / PFE_XL_MEASURE_COLUMN_ALREADY_EXIST |
| 2026-10-20 | Study Duration Pulse uses StratumSummary measures + FactRegistration withdrawal-rate by module; KM Deneb drops dense at-risk strip; β(t) shortlists 4 PH-fail terms | User: report did not look great yet |
| 2026-10-21 | Every duration figure stamps the caller's columns, the latest follow-up time, and the `fit_hash.txt` prefix. `figures.json` repeats the line. A wall-clock fitted-at time is not stamped | Same idea as a chart that shows its query and its data clock. The hash is the freshness check |
| 2026-10-21 | Approved Study Duration render checked in at `docs/gallery/study-duration/`, indexed by `docs/GALLERY.md` | The engine had no pictures in the repo. Fit tables stay gitignored; the PNGs are the public render of hash `9d191288…` |
| 2026-10-22 | Argument Deneb cards: KM y-domain 0.55–1 with one shared stratum legend; forest reference is a rule with `y: null` so it stays vertical at hazard ratio 1; β(t) panels plot the smooth curve and interval only | Schoenfeld residuals (module AAA up to ~70) shared a y-scale with β(t) and flattened the line. A parent `y` encoding turned the “line at 1” into a dash on every row. Deneb 2 leaves a card white when the spec fails, so a downscaled screenshot can look empty while the curves are there. |

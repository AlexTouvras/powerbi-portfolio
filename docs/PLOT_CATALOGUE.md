# Plot catalogue — advanced, clear, reusable

> Source of truth for which sophisticated visuals we ship on Nordic Boardroom
> **instrument** pages and **argument** pages. Target: **≥20** plots that a
> cold reader can decode in about ten seconds with a short caption — 99th
> percentile craft, not chart junk.
>
> Synced 2026-10-19 with cloud work on `powerbi-portfolio` (OpenBI catalog
> notes + merged [PR #6](https://github.com/AlexTouvras/powerbi-portfolio/pull/6)
> duration engine). Pictures of the duration figures (rows 21–24 and the
> estimands) are in [GALLERY.md](GALLERY.md). Rows 1–20 are the report pages
> named in section G.

## How to use this list

1. Pick the **question** (comparison, change, distribution, flow, duration…).
2. Prefer a row already marked **Shipped** or **Engine-ready** before inventing a new geom.
3. Instrument pages stay Nordic Boardroom. Argument pages use the claim-as-title
   archetype (editorial / classic / tufte ink rules from OpenBI).
4. A caption may only quote measures the gold/fit actually produced (citation gate).
5. Do **not** answer a duration question with a Gantt; Gantt is companion chrome only.

**Clarity bar:** if a non-statistician cannot state the takeaway after one
caption, the plot belongs in **Specialist** — allowed on Context / Methods,
never as the hero of an argument page.

---

## A. Core catalogue (24) — sophisticated and easy to read

| # | Plot | One-line read | Where it belongs | Status | PBI / render path |
|---|------|---------------|------------------|--------|-------------------|
| 1 | **Waterfall** | How we got from A to B (additive bridge) | Instrument Pulse / Drivers | **Shipped** — Bank | `waterfallChart` |
| 2 | **Forecast PI ribbon** | Actual + forecast + uncertainty band | Outlook | **Shipped** — Logistics | Multi-series `lineChart` (Actual/Forecast/Lo/Hi) |
| 3 | **Sankey / pathway** | Volume moving across stages | Drivers | **Shipped** — Care | AppSource Sankey / `ribbonChart` |
| 4 | **Key Influencers** | What splits the outcome most | Drivers | **Shipped** — Churn, Experience | `keyDriversVisual` |
| 5 | **Decomposition tree** | Interactive root-cause split | Drivers | **Shipped** — Churn, Experience | `decompositionTreeVisual` |
| 6 | **Matrix heatmap** | Pattern across two categories | Drivers | **Shipped** — Care, Experience | `pivotTable` + fillRule |
| 7 | **Scatter / bubble** | Relationship + outliers (3rd = size) | Analytical | **Shipped** — Bank | `scatterChart` (measures only) |
| 8 | **Funnel** | Monotone stage drop-off | Queue / ops | **Shipped** — Bank | `funnel` |
| 9 | **Ordered erosion bars** | Metric falls across ordered outcomes | Drivers signature | **Shipped** — Experience | `clusteredColumnChart` / ordered bar |
| 10 | **Cut-off frontier** | Approval rate vs bad rate as the gate moves | Strategy | **Shipped** — Credit | Line / dual series from gold |
| 11 | **Calibration** | Predicted risk vs observed rate | Validation / argument | **Shipped** — Credit; **Engine** | Line + diagonal; `FactCalibration` |
| 12 | **Treemap (size × color)** | Magnitude and a second rate at once | Markets | **Shipped** — Nordic Equity | `treemap` |
| 13 | **Book vs optimizer weights** | Live book against min-vol / max-Sharpe | Risk | **Shipped** — Investing | Clustered / stacked bar |
| 14 | **Composite KPI + delta** | Headline with signed YoY (color **and** arrow) | Exec Pulse | **Shipped** — Sales | `cardVisual` + caption |
| 15 | **Master-scale grade strip** | Shared G1→G8 risk band on every page | Scorecard chrome | **Shipped** — Credit | Cards / conditional format |
| 16 | **Slope** | “A overtook B” between two periods | Essay / Comparative | **Scaffolded** — Sales Market | `_shared/scripts/plot-patterns.mjs` → related `DimDate[Year]` + year filter (not disconnected period) |
| 17 | **Dumbbell** | Before/after or gap between two measures | Essay / Comparative | **Scaffolded** — Sales Market | Same two-point pattern (thicker stem); horizontal Deneb later |
| 18 | **Stream / mix-over-time** | Composition evolving without spaghetti | Momentum / essay | **Scaffolded** — Logistics Delivery Pulse | `buildStreamChart` → `hundredPercentStackedAreaChart` ≤4 series |
| 19 | **Seasonal decomposition** | Trend / season / remainder as three panels | Outlook Methods | **Scaffolded** — Logistics Demand Outlook | STL → `FactForecast` Trend/Seasonal/Remainder + `buildSeasonalDecompPanels`; matplotlib PNG in `_verify/` |
| 20 | **Lollipop** | Ranked magnitude with less ink than bars | Comparative / RMST | **Scaffolded** — Logistics Delivery Pulse | `buildLollipopChart` → combo thin column + marker; engine `rmst.png` later |
| 21 | **Kaplan–Meier + at-risk** | Who is still free of the event over time | Argument hero | **Study Duration** | Deneb Argument page + [`kaplan-meier.png`](gallery/study-duration/kaplan-meier.png) |
| 22 | **Forest (hazard ratios)** | What multiplies risk, with interval and line at 1 | Argument | **Study Duration** | Deneb Argument page + [`forest.png`](gallery/study-duration/forest.png) |
| 23 | **Cumulative events (1 − KM)** | How many have had the event by time *t* | Argument | **Gallery** | [`cumulative-events.png`](gallery/study-duration/cumulative-events.png) |
| 24 | **Decision curve** | Does the model beat treat-all / treat-none? | Argument / credit | **Gallery** | [`decision-curve.png`](gallery/study-duration/decision-curve.png) |

**Count in core:** 24 (≥20). Rows 1–20 are in featured PBIPs. Rows 21–22 are on the Study Duration Argument page (Deneb) and in the gallery. Rows 23–24 are gallery PNGs from the same approved fit. β(t) is in section B, on that Argument page as four terms, and as the full grid in [`beta-time.png`](gallery/study-duration/beta-time.png).

---

## B. Strong additions (still clear) — expand past 24 when a report needs them

| Plot | One-line read | Status | Notes |
|------|---------------|--------|-------|
| **Smoothed hazard** | Instant risk rate over time (with band) | **Gallery** | [`hazard.png`](gallery/study-duration/hazard.png). Prefer over a raw-time histogram |
| **Restricted-mean contrast** | Extra event-free time vs reference | **Gallery** | [`rmst.png`](gallery/study-duration/rmst.png). Shared clock; Greenwood interval |
| **Adjusted survival** | Model’s curves at a fixed covariate profile | **Gallery** | [`adjusted-survival.png`](gallery/study-duration/adjusted-survival.png) |
| **Nomogram** | Points → total → predicted survival | **Gallery** | [`nomogram.png`](gallery/study-duration/nomogram.png). Argument companion, not a Pulse hero |
| **Connected scatter** | Two series’ relationship walking through time | Next | FT correlation; careful with causality |
| **Surplus/deficit filled line** | Balance above/below a baseline | Next | Deviation; good for BvA |
| **Small multiples (shared axis)** | Same chart, many facets | Next | Prefer over 6+ series on one axis |
| **Diverging bar** | +/− from target or zero | Next | Controllership / sentiment |
| **Statement (chart of accounts)** | Roll-up with operators + variance bars | **Scaffolded** — Controllership P&L Pulse | `buildStatementLayout` · CoA operators + variance bars |
| **Dendrogram (Ward)** | Hierarchy k-means threw away | Next — Bank / segments | OpenBI kind; Context or appendix |
| **Violin / density + points** | Distribution behind a KPI | Next | Keep raw points; no box-only average |
| **Hexbin** | Density when scatter overplots | Next | Analytical only |
| **β(t) panels** | Does the hazard ratio stay constant? | **Study Duration** | Deneb Argument page keeps four terms that fail PH. Full grid: [`beta-time.png`](gallery/study-duration/beta-time.png) |
| **XY at-risk heatmap** | How many remain by stratum × time | Optional | From `FactKm`, not raw follow-up |

---

## C. Specialist (allowed, not hero)

Use on Context / Methods only. Captions must name the null.

| Plot | Why it stays specialist |
|------|-------------------------|
| Cumulative hazard (−log S) | Same information as KM; harder language |
| Log cumulative hazard (cloglog) | PH visual check — parallel = OK |
| Reverse KM (censoring) | Follow-up ending, not the event |
| Martingale / deviance residuals | Model shape diagnostics |
| dfbeta influence | Influential rows |
| Cox–Snell | Goodness-of-fit vs y = x |
| Aalen additive hazard | Time-varying additive effects |

---

## D. Explicitly out of the collection

| Rejected form | Reason |
|---------------|--------|
| Histogram / barcode / raincloud of **recorded** follow-up | Treats censored times as events (cloud decision 2026-10-19) |
| **Gantt as the duration answer** | No risk set, no band, no censoring mark — companion only |
| Gauge / radar / dual-axis for unlike units | Encoding anti-patterns (`powerbi-report-design`) |
| Pie / donut with >5 slices | Prefer sorted bar or treemap |
| Competing-risk cumulative incidence | Different estimator — not in engine v1 |

---

## E. Page species × plot routing

| Species | Skin | Preferred catalogue rows | Avoid as Figure 1 |
|---------|------|--------------------------|------------------|
| **Instrument** (Landing / Pulse / Drivers / Queue / Context) | Nordic Boardroom | 1–20, small multiples, field-parameter axes | KM / forest / β(t) |
| **Argument** (claim title, numbered figures, no slicer rail) | Editorial / classic / tufte token | 21–24 + B engine rows | KPI carpet, Gantt, raw-time histograms |
| **Essay / Orbit story** | Storytelling grammar | Slope, dumbbell, stream, connected scatter | Full board chrome |

Method router (unchanged from cloud plan):

- Fixed-horizon **label** → logistic scripts (Churn / Care / Experience / Credit PD).
- **Clock + censoring flag** → duration engine (KM, Cox, PH gate).
- Single measured **series** → SARIMAX (Logistics forecast).

---

## F. Implementation backlog (plots only)

| Priority | Work | Unlocks |
|----------|------|---------|
| P0 | Keep engine figures green (`pytest` under `_shared/analytics_engine`) | Rows 21–24 + B |
| P1 | ~~Checked-in Deneb templates: KM+risk, forest, β(t)~~ | Done 2026-10-20 — `_shared/deneb/` + `deneb-binders.mjs` (AppSource GUID) |
| P1 | ~~Slope + dumbbell patterns in elevate scaffolds~~ | Done 2026-10-20 — Sales Customer & Market + `plot-patterns.mjs` |
| P1 | ~~Stream / mix-over-time on Logistics Delivery Pulse~~ | Done 2026-10-20 — `buildStreamChart` + top-4 category 100% stack |
| P2 | Optional Deneb horizontal dumbbell stem | True FT orientation when Desktop custom visual is available |
| P2 | ~~Seasonal decomposition export beside Logistics SARIMAX~~ | Done 2026-10-20 — STL on Demand Outlook + matplotlib PNG |
| P2 | ~~Lollipop on Logistics Delivery Pulse~~ | Done 2026-10-20 — `buildLollipopChart` + Orders by category |
| P2 | ~~Controllership statement layout~~ | Done 2026-10-20 — seed + PBIP + `buildStatementLayout` |
| P3 | ~~Bind first real duration grain (not Care Pulse UCI; not invented times)~~ | Done 2026-10-21 — Study Duration approved fit. Argument page binds KM, forest, and four β(t) terms. Canvas screenshots of that PBIP are still open |

---

## G. Inventory — what featured reports already prove

| Report | Signature plot(s) already in catalogue |
|--------|----------------------------------------|
| Sales Executive | Composite KPI + delta (#14); country slope + category dumbbell (#16–17) |
| Churn Retention | Key Influencers + decomp (#4–5) |
| Bank Value | Waterfall + scatter + funnel (#1, #7–8) |
| Care Pulse | Sankey + heatmap (#3, #6) — **not** time-to-readmission KM |
| Credit Risk | Cut-off frontier + calibration + grade strip (#10–11, #15) |
| Logistics Pulse | Forecast PI ribbon (#2); category mix stream (#18); seasonal decomp (#19); orders lollipop (#20) |
| Controllership | Statement CoA + Budget→Actual OP bridge + sparklines + queue drillthrough |
| Experience Pulse | Score erosion + KI/decomp (#9, #4–5) |
| Investing Desk | Book vs optimizer (#13); VaR KPI |
| Nordic Equity | Treemap heatmap (#12) |
| Study Duration | Kaplan–Meier, forest, β(t) on the Argument page (#21–22, section B). Gallery holds the rest of the fit |

---

## H. Sources

- Cloud Slack digest 2026-10-19 (OpenBI kinds + October PBI custom-visual GA).
- `_shared/analytics_engine` + `docs/architecture/analytics-engine.md` (PR #6).
- FT [Visual Vocabulary](https://ft-interactive.github.io/visual-vocabulary/).
- Personal skill `powerbi-report-design` chart-selection + anti-patterns.

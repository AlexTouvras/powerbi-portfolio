# Backlog

> Tracked in git. Upcoming work and hard scope boundaries.

## Now

- [x] **12-investing-desk** — dual-source **Investment Portfolio** shipped to main (PR #2)
- [x] **04-supply-chain** — Logistics Pulse Featured (PBIP + screenshots + docs) — shipping
- [x] **08-customer-experience** — Experience Pulse Featured (PBIP + propensity + screenshots + docs)
- [x] Desktop screenshots for `12-investing-desk`
- [x] README / DATASETS / Orbit notify path
- [x] **Risk layer (first cycle)** — VaR KPI + book vs min-vol vs max-Sharpe on Risk & Mandate (2026-08-14)

## Next

- [x] **Showcase canvas capture** — `capture_showcase.py` as the last step when a report is finished; existing `screenshots/` cropped to the page (2026-10-20)
- [x] **Bank Value argument** — segment net-flow waterfall, headcount vs balance share, single-product money vs dormancy, live landing thesis (2026-10-20)
- [x] **Analytics engine v1** — duration contract, citation gate, survminer-style curves, and censoring-aware estimands (smoothed hazard, Cox–Snell, calibration, Aalen, decision curve, nomogram, restricted-mean contrast). No portfolio dataset bound (2026-10-19)
- [x] **Figure binding** — column contract, latest follow-up, and fit-hash prefix on every duration figure; `figures.json` repeats the line (2026-10-21)
- [x] **Plot catalogue ≥20** — `docs/PLOT_CATALOGUE.md` (24 core: 15 shipped + 5 OpenBI/FT next + 4 engine argument heroes) synced with cloud OpenBI notes + PR #6 (2026-10-19)
- [x] Slope + dumbbell scaffold patterns (catalogue #16–17) — `plot-patterns.mjs` + Sales Customer & Market (2026-10-20)
- [x] Stream / mix-over-time scaffold (catalogue #18) — `buildStreamChart` + Logistics Delivery Pulse (2026-10-20)
- [x] Seasonal decomposition scaffold (catalogue #19) — STL on FactForecast + Demand Outlook three panels (2026-10-20)
- [x] Lollipop scaffold (catalogue #20) — `buildLollipopChart` + Logistics Delivery Pulse (2026-10-20)
- [x] Controllership Statement scaffold — seed + PBIP Landing/P&L Pulse/Context + `buildStatementLayout` (2026-10-20)
- [x] Controllership Variance Drivers + Scenarios pages (2026-10-20)
- [x] Controllership Landing dynamic conclusion — DAX `Landing Thesis`/`Subthesis` + slicers (2026-10-20)
- [x] Controllership Pulse: Budget→Actual OP bridge + KPI sparklines + Line Profile drillthrough (2026-10-20)
- [x] Controllership showcase capture → `10-fpa-controllership/screenshots/` (2026-10-20)
- [x] Deneb KM + forest + β(t) binders — `_shared/deneb/` templates + `deneb-binders.mjs` (2026-10-20)
- [x] Study Duration Argument page wired to approved fit + Deneb KM/forest/β(t) (2026-10-20)
- [ ] Study Duration: showcase capture is on disk (`screenshots/`, 5508×3098) but Argument Deneb cards were blank (2026-10-21)
- [x] **Canvas recapture** — Study Duration, Care Pulse, Investing Desk, Nordic Equity, Churn, Sales recaptured at one canvas size (2026-10-21). Controllership landing was cropped earlier, not re-shot. Logistics, Experience, Bank, and Credit were already one size from the older pass.
- [x] Study Duration visual pass — Landing poster, Pulse charts/matrix, KM/β(t) Deneb fixes + model refresh (2026-10-20)
- [x] Study Duration narrative clarity — plain OULAD / CCC vs FFF framing on Landing–Context (2026-10-21)
- [x] **Engine figure gallery** — approved Study Duration render in `docs/gallery/study-duration/`, indexed by `docs/GALLERY.md` (2026-10-21)
- [x] **Wave 3 gold grains** — Wine Market, Study Duration, Drive Reliability, Cohort Survival (`13`–`16`). Study Duration has a PBIP; the other three are still draft specs (2026-10-20)
- [ ] **Orbit live dashboards** (not PBIR) — `/portfolio/live`; Wave A owned in `website/`
- [ ] `07-helsinki-energy` Facility Energy (Nuuka)
- [ ] Logistics Pulse: optional dark PI fill after Desktop refresh (BandWidth stacked area)
- [ ] Investing Desk: Desktop Refresh + screenshots for Sortino/Calmar + overfit table

## Later

- [ ] Fabric publish for featured reports (only if requested)
- [ ] Investing Desk: live broker holdings sync
- [ ] Logistics Pulse: true In-Full OTIF definition (v2)

## Out of scope (strict)

- Live Saxo/Nordnet order routing
- Day-trading sleeve as an active strategy page (gates only)
- Fabric composite model linking two PBIPs in v1
- Regulated investment advice framing

## Definition of done (08-customer-experience — complete)

- [x] Locked `_brief/report-spec.md` approved
- [x] Gold enrich + detractor scoring
- [x] `ExperiencePulse.pbip` + PBIR validate + Desktop screenshots
- [x] Context disclaimer visible; README / DATASETS / portfolio README → Featured

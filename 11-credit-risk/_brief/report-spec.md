# Report Spec — Credit Risk Pulse

**Status:** APPROVED — shipped locally; ready for GitHub  
**Folder:** `11-credit-risk`  
**Report name:** Credit Risk Pulse  
**PBIP:** `CreditRisk.pbip`  
**Theme:** Nordic Boardroom (`_shared/themes/Nordic-Boardroom*.json`)  
**Landing atmosphere:** `ledger-mist`

---

## 1. Job to be done

| Field | Decision |
|-------|----------|
| Audience | CRO / Head of Credit Risk / model monitoring lead |
| Primary job | In ≤10s: is book risk on track? Then: which scorecard drivers matter, is the model stable, **who to act on** |
| Success | Viewer leaves with **3 executable moves** (tighten cut-off / investigate PSI feature / work the steering queue) |
| Failure | Looks like a generic “propensity queue” clone of Churn/Care Pulse |

**Differentiation vs portfolio peers**

- `05-bank` = RFM engagement — **not** PD/ECL  
- `02-churn` / `06-care` = propensity queues in other domains  
- This report = **retail credit vocabulary**: PD, score, grade, EL, Gini/KS, PSI, vintage, cut-off

---

## 2. Design identity

| Element | Choice |
|---------|--------|
| Tone | Nordic Boardroom (mist `#F7FAFC`, teal `#2F5F73`, copper `#C17B3A`) |
| Signature | **Master-scale grade strip** — every analysis page shows G1→G8 (or Low→High) with semantic green→amber→red; tables/queues inherit the same band colors |
| Chrome | Page navigator pills · footer source line · filter pane collapsed on Landing/Context |
| Risk color | Semantic green/amber/red **only** for risk bands / RAG — never decorative |

---

## 3. Dataset & gold

| Layer | Decision |
|-------|----------|
| Source | Home Credit Default Risk — `application_train` + bureau aggregates (+ `previous_application` if cheap) |
| Desktop grain | Stratified sample **~80k** applications (preserve ~8% default rate) for Import performance |
| Full-run metrics | Train/OOT metrics computed on larger window; written to `ModelMetrics.json` / Context measures |
| Raw in git | **No** — gitignored; download via Kaggle CLI |

### Gold tables (star-ish)

| Table | Grain | Key columns |
|-------|-------|-------------|
| `DimApplication` | 1 row / application | SK_ID_CURR, TARGET, PD, Score, Grade, RiskBand, RiskRank, EL, EAD, LGD, Stage, key app features |
| `DimScorecard` | 1 row / characteristic × bin | Feature, Bin, WoE, IV, Points |
| `FactVintage` | Cohort × MOB | VintageMonth, MOB, DefaultRate, Exposure |
| `FactPsi` | Feature | Feature, PSI, StabilityFlag |
| `DimDate` | day | Continuous calendar for vintage |
| `ModelMetrics` | 1 row | OOT_AUC, OOT_Gini, OOT_KS, Brier, SampleN, TrainWindow |

### Scoring method

1. Leakage-safe feature set (application + bureau aggregates available at decision time)  
2. WoE binning + IV filter → **logistic scorecard** (interpretable champion)  
3. Optional LightGBM challenger — **metrics on Context only**, not the queue driver  
4. Master scale: score → PD → **Grade G1–G8**  
5. EL ≈ PD × LGD × EAD (LGD benchmark constant or simple proxy; document on Context)  
6. IFRS 9–style Stage 1/2/3 heuristic for storytelling (not production staging)  
7. PSI vs baseline window for top features  

---

## 4. Page plan (5 visible + 1 hidden)

### P0 — Landing (Portfolio Landing)

- Poster · thesis · audience · numbered page map  
- **One hero:** OOT Gini (domain craft signal)  
- No slicers / charts  

### P1 — Portfolio Risk Pulse (Executive · Hero-Right)

**Question:** Is the book on track?

| Zone | Content |
|------|---------|
| KPI strip (4) | Applications · Default rate · Avg PD · Portfolio EL rate |
| Hero | Predicted vs realized default by Grade (clustered bar or line+markers) |
| Secondary | Grade mix (100% stacked or sorted bar) · Exposure by RiskBand |
| Slicers | Grade, RiskBand, Contract type / Income type (rail) |

### P2 — Scorecard & Validation (Analytical)

**Question:** Why does the score discriminate — and is it calibrated?

| Zone | Content |
|------|---------|
| Left | Top IV characteristics (sorted bar) |
| Center | Score distribution by TARGET (histogram / overlapping columns) |
| Right | Calibration curve proxy (decile: avg PD vs realized rate) |
| Bottom | Scorecard points matrix (table from `DimScorecard`) — Top N features |
| Optional native | Key Influencers on TARGET (if it adds story without clutter) |

### P3 — Monitoring & Steering (Operational · action page)

**Question:** What drifted — and **who do we work today?**

| Zone | Content |
|------|---------|
| KPI | Max PSI · Features in breach · High-risk count · Cut-off preview approval rate |
| PSI | Horizontal bars; breach threshold line (0.10 / 0.25) |
| Vintage | Line: default rate by MOB for recent vintages |
| **Steering queue** | Top RiskRank applications still “approvable” narrative — columns: ID, Grade, PD, EL, key driver, **Recommended action** |
| Cut-off | Field parameter or slicer on score cut-off → approval rate vs bad rate trade-off (small dual card + curve) |

**Executable insight contract (binding):** each queue row carries a `RecommendedAction` string from gold rules, e.g.:

- `Review — PD above cut-off band`  
- `Investigate — bureau PSI feature drift`  
- `Watch — Grade G2–G3 borderline`  

### P4 — Context (facts-only, last visible)

- Home Credit attribution · sample-model disclaimer  
- How to read Gini / KS / PSI / Grades  
- Champion vs challenger metrics table  
- Not production IRB / IFRS 9  

### Hidden — Application Profile (drillthrough)

From queue → one application: features, score contribution (top points), PD/EL, TARGET if known.

---

## 5. Measures (core)

`Applications`, `Defaults`, `Default Rate`, `Avg PD`, `Sum EAD`, `Sum EL`, `EL Rate`,  
`OOT Gini`, `OOT KS`, `OOT AUC`, `High Risk Applications`,  
`PSI Breach Features`, `Approval Rate @ Cutoff`, `Bad Rate @ Cutoff`

---

## 6. Build sequence

| Phase | Work | Verify |
|------:|------|--------|
| 0 | Deps: Python 3.12 venv + sklearn; Kaggle CLI + `kaggle.json`; confirm Desktop + `powerbi-report-author` | imports + `kaggle --version` |
| 1 | Download Home Credit raw (gitignored) | `application_train.csv` present |
| 2 | `build-gold.py` — clean, bureau agg, sample 80k, vintage + PSI scaffolds | gold CSVs row counts |
| 3 | `score-pd.py` — WoE/logistic, grades, EL, actions, metrics JSON | OOT Gini in ~0.45–0.55 ballpark; stdout metrics |
| 4 | `scaffold-credit-pbip.mjs` — TMDL + GoldDataFolder param | opens in Desktop |
| 5 | `elevate-credit-report.mjs` — Landing + 4 pages + drillthrough + nav | visual inventory |
| 6 | Validate + Desktop Bridge screenshots | `powerbi-report-author validate`; no banners |
| 7 | README + DATASETS featured row + Orbit sync (if requested later) | screenshots in README |

---

## 7. Dependencies

| Dependency | Status (2026-07-23) |
|------------|---------------------|
| Dataset locked (Home Credit) | Yes |
| Folder prework | Yes |
| Kaggle CLI / `kaggle.json` | **Missing — block Phase 1** |
| sklearn on default `py -3` | **Missing — use/create venv like other projects** |
| Nordic Boardroom theme | Available |
| Modeling MCP | Available (user-powerbi-modeling-mcp) |
| Fabric publish | Out of scope unless approved |

---

## 8. Out of scope (v1)

- Live Provenir / credit engine  
- Claiming production IRB RWA / official IFRS 9  
- Redistributing raw Kaggle dumps  
- Fabric Real-Time  
- Full 307k Import if Desktop chokes (keep 80k + metrics JSON)

---

## 9. Approval gate

Approve this spec to unlock implementation Phase 0→7.  
Reply **approve** / **go** (or name deltas). First implementation action after approval: create venv + obtain Kaggle credentials, then download Home Credit.

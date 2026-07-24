# Report Spec — Investment Portfolio (Investing Desk)

**Status:** APPROVED + BUILT (user: proceed, 2026-07-23)  
**Folder:** `12-investing-desk`  
**Report name:** Investment Portfolio  
**PBIP:** `InvestingDesk.pbip`  
**Framing:** Institutional multi-sleeve portfolio (CIO / board-ready) — not a retail “research checklist” desk

## Report identity

| Field | Decision |
|-------|----------|
| Audience | CIO / portfolio committee / senior BI portfolio readers |
| Job | Allocate capital across sleeves, judge performance vs policy benchmark, see holdings & rebalance intent, monitor Nordic regional tape, confirm mandate compliance |
| Theme | Nordic Boardroom |
| Tone + signature | Institutional investment book — **allocation → performance vs benchmark → holdings → risk/mandate → regional market** |
| Delivery | Local PBIP + screenshots; no Fabric publish in v1 |
| Design reuse | Landing / harbor-mist / theme patterns from `01-finance` Nordic Equity |

## Dual dataset (locked)

| Source | Path | Gold contribution |
|--------|------|-------------------|
| **Investing research** | `C:\Users\kater\.cursor\projects\investing` | Sleeves, sim curves, policy comparison, review holdings/actions, mandate gates |
| **Nordic Equity** | `01-finance/data/gold/` | Nordic company + prices for regional exposure / tape |
| **Live board** | [heatmap-web-five.vercel.app](https://heatmap-web-five.vercel.app) | CTA on Regional Markets page |

### Gold tables (planned)

| Table | Source | Grain |
|-------|--------|-------|
| `DimSleeve` | `capital.yaml` / `sim_latest.capital` | sleeve |
| `FactSimSummary` | `sim_latest.summaries` | strategy |
| `FactEquityCurve` | `sim_latest.series` | date × series |
| `FactPolicyCompare` | `compare_policies.csv` / research KPIs | policy |
| `FactHolding` | `review_latest.json` (positions / targets) | name |
| `FactRebalanceAction` | `review_actions.csv` | action × name |
| `DimMandateRule` | `capital.yaml` risk_gates + `next_review.yaml` | rule |
| `DimNordicCompany` | Nordic Equity DimCompany | ticker (+ `InBook` / `InMidUniverse`) |
| `FactNordicPrices` | Nordic Equity FactPrices | date × ticker |

v1 = **copied gold** into this folder (portable PBIP). Prefer **weights %** on public-facing visuals; absolute € OK locally with Context disclaimer.

## Page plan (institutional)

| # | Page | Archetype | Purpose |
|---|------|-----------|---------|
| 1 | **Landing** | Portfolio poster | CIO cover — one signature portfolio number |
| 2 | **Asset Allocation** | Comparative allocation | Strategic sleeve map + policy weights |
| 3 | **Performance** | Analytical / benchmark | Excess return vs VWCE · curves · policy peer set |
| 4 | **Holdings & Rebalance** | Analytical / IB book | Book weights · target book · EXIT/ENTER/TRIM/DEFER |
| 5 | **Risk & Mandate** | Executive risk | Vol / MDD / Sharpe · mandate compliance · review calendar |
| 6 | **Regional Markets** | Market monitor | Nordic tape for book-relevant names + live board |
| 7 | **Notes** | Context (facts) | Methodology, delay, not advice, sources |

**Active page on open:** Landing.  
Analysis page map on Landing lists 02–06 only (Notes stays last, like Context).

## Visual inventory (build list)

### 1. Landing
- Atmosphere + teal bar + white panel + copper hairline
- Title **Investment Portfolio** · thesis (multi-sleeve · policy benchmark · mandate)
- Audience: CIO / portfolio committee
- Numbered map: Allocation · Performance · Holdings · Risk · Regional Markets
- **One hero card:** Excess CAGR vs VWCE *(or Total book Sharpe — lock at build)*
- `pageNavigator` — no charts / no KPI strip

### 2. Asset Allocation
- KPI cards: Total book € · Strategic Core % · Active (Mid+Short) % · Cash %
- **Donut or treemap:** Core / Mid / Short sleeve € (policy allocation)
- **100% stacked bar or matrix:** Active book split Mid vs Short
- Callout card: Ring-fenced strategic sleeve (OP) — **out of active loop**, context only
- Optional **table:** Sleeve · horizon · asset class · broker channel · mandate note  
No stock-level clutter on this page.

### 3. Performance
- KPI strip: Portfolio CAGR · Benchmark (VWCE) CAGR · **Excess CAGR** · Sharpe · Max DD · Ann. vol
- **Line chart:** Indexed equity (€100) — Working policy vs VWCE vs Universe EW
- **Line chart:** Drawdown (policy vs benchmark)
- **Clustered bar:** Policy peer set — CAGR or Sharpe (`FactPolicyCompare`: applied / alts / benchmarks)
- Footnote: sample window · fee_bps · long-only  
Slicer (optional): policy family

### 4. Holdings & Rebalance
- KPI cards: Book € · Equity € · Cash € · Names held · Target top-N
- **Table:** Holdings — name · Yahoo · weight % · current € · target € · 12m momentum · rank  
  *(default sort by weight)*
- **Bar or waterfall-lite:** Net € delta by action (ENTER / EXIT / TRIM / ADD)
- **Matrix / table:** Rebalance actions — action · name · Δ€ · explanation (truncated)
- Slicers: Action type · Region (Nordic vs other)  
Short sleeve **not** a live trading blotter — Mid book focus.

### 5. Risk & Mandate
- KPI cards: Ann. vol · Max DD · Sharpe · Turnover (ann. one-way) · Mandate rules met (n/N)
- **Bullet / bar:** Risk metrics vs benchmark (vol, MDD)
- **Table:** Mandate rules — rule · category (live authorization / cost / kill-rule / short-sleeve) · status
- **Cards / text:** Next production review window (`next_review.yaml`) · working policy id · max name changes  
Framing = **Investment Policy Statement compliance**, not a hobby checklist.

### 6. Regional Markets (Nordic Equity)
- KPI cards: Nordic names in book · Avg day change % · RSI extremes count
- **Table:** Book ∩ Nordic — ticker · company · country · sector · Change% · RSI14 · side
- Optional **bar:** Day change % for overlap names
- **Action button:** Open live Nordic board  
Complements Holdings; does not replace the full Nordic Equity report.

### 7. Notes
- Text only: not regulated advice · sim ≠ live · Yahoo delay · fee model · TSMOM citation · source repos
- Small cards: sample start/end · universe N · fee_bps · holdings as-of  
- `pageNavigator`

## Measures (planned)

- Total Book EUR, Sleeve Weight %, Active Book %
- Portfolio / Benchmark / Excess CAGR
- Portfolio Sharpe, Vol, Max DD
- Excess return (indexed series)
- Mandate Compliance %
- Nordic-in-book Day Change (avg)
- Rebalance Net € by action

## Design

- Theme: `_shared/themes/Nordic-Boardroom.json`
- Landing: `portfolio-landing` + distinct atmosphere variant (not identical to Nordic Equity’s harbor-mist if already used — prefer `alpine-mist` or `coastal-fog`)
- Institutional chrome: sparse KPI strips, one primary chart per band, copper accents
- Green/red only for excess return / day change / RSI extremes

## Out of scope (v1)

- Live broker order routing / API trading  
- Full multi-asset (bonds/FX/alts) — sleeves are ETF + equity research book only  
- Fabric publish · composite live model to NordicEquity PBIP  
- Day-trading blotter / tick charting  
- Client reporting pack / PDF factsheet export  

## Dependency status

| Dependency | Status |
|------------|--------|
| Investing repo reports | `sim_latest`, `compare_policies`, `review_latest`, `review_actions`, `next_review.yaml` |
| Nordic Equity gold | Present |
| PBIP | Not built |
| Fabric | Not requested |

## Verify (when built)

- [ ] Gold export from investing + Nordic Equity  
- [ ] PBIR validate · Desktop screenshots (7 pages)  
- [ ] Notes disclaimer + live-board CTA  
- [ ] Language reads institutional (allocation / excess / mandate), not hobby desk  

## Approval

Approved by user **proceed** (2026-07-23) after JPM-level page/visual lock.  
Built: export → scaffold → elevate · PBIR validate succeeded.

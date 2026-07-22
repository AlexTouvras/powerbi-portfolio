# Report Spec — Nordic Equity (Live Market Board)

**Status:** APPROVED (user: go for it, 2026-07-21)  
**Folder:** `01-finance`  
**Report name:** Nordic Equity  
**PBIP:** `NordicEquity.pbip`

## Report identity

| Field | Decision |
|-------|----------|
| Audience | Investors / analysts / Nordic market watchers |
| Theme | Nordic Boardroom |
| Delivery | Local PBIP — **first live / near-live** portfolio report |
| Pages | Landing · Nordic Heatmap · Ticker Explorer · Signal Desk · Context |

## Dataset

| Layer | Source |
|-------|--------|
| Universe | Curated OMXH / OMXS / OMXC / OBX large caps (`DimCompany`) |
| Prices | Yahoo Finance chart API (delayed) → `FactPrices` |
| Indicators | Computed in gold: SMA20/50, EMA12/26, MACD, RSI14, Bollinger(20,2), Volume |
| Strategy | RSI mean-reversion: Long RSI≤30 / Short RSI≥70 + next-day return & hit |
| Refresh | `node scripts/build-gold.mjs` (manual or scheduled) then Desktop refresh |

## Page plan

1. **Landing** — poster cover; hero = EW cumulative return % (strategy backtest)  
2. **Nordic Heatmap** — treemap by company; size = Market Cap; color = Day Change % (+ CTA to live Vercel board)  
3. **Ticker Explorer** — **single-select** ticker; price + SMA; MACD; RSI; volume  
4. **Signal Desk** — RSI long/short candidates for latest session + next-day hit rates + EW backtest charts  
5. **Context** — delay, Yahoo source, indicator defs, not investment advice; **no ML forecast**

## Design

- Nordic Boardroom; Landing = `portfolio-landing.md` + atmosphere variant `harbor-mist`  
- Green / red for change & RSI extremes only  

## Out of scope

- ML / neural next-day price forecast (future project)  
- Official Nasdaq paid Web API / tick streaming  
- Fabric publish (unless later approved)  

## Approval

Approved by user **go for it** after scope lock (indicators now; forecast later).  
Signal Desk added 2026-07-21 on user request (rules-based RSI desk + single-ticker Explorer).

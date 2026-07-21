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
| Pages | Landing · Nordic Heatmap · Ticker Explorer · Context |

## Dataset

| Layer | Source |
|-------|--------|
| Universe | Curated OMXH / OMXS / OMXC / OBX large caps (`DimCompany`) |
| Prices | Yahoo Finance chart API (delayed) → `FactPrices` |
| Indicators | Computed in gold: SMA20/50, EMA12/26, MACD, RSI14, Bollinger(20,2), Volume |
| Refresh | `node scripts/build-gold.mjs` (manual or scheduled) then Desktop refresh |

## Page plan

1. **Landing** — poster cover; hero = Advancers (latest session) or Avg Day Change %  
2. **Nordic Heatmap** — treemap Sector → Ticker; size = Market Cap; color = Day Change %  
3. **Ticker Explorer** — ticker slicer; price + SMA/BB; MACD; RSI; volume  
4. **Context** — delay, Yahoo source, indicator defs, not investment advice; **no ML forecast** (future project)

## Design

- Nordic Boardroom; Landing = `portfolio-landing.md` + atmosphere variant `harbor-mist`  
- Green / red for change & RSI extremes only  

## Out of scope

- Price forecast / ML next-day  
- Strategy backtest / paper P&L  
- Official Nasdaq paid Web API / tick streaming  
- Fabric publish (unless later approved)  

## Approval

Approved by user **go for it** after scope lock (indicators now; forecast later).

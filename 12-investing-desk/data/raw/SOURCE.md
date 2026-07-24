# Investing desk — dual sources

## A — Investing research platform (policy + sims)

| Path | Role |
|------|------|
| `C:\Users\kater\.cursor\projects\investing\configs\capital.yaml` | Sleeve budgets + risk gates |
| `C:\Users\kater\.cursor\projects\investing\configs\universes.yaml` | Core / mid / short symbols + mid overlap bridge |
| `C:\Users\kater\.cursor\projects\investing\reports\sim_latest.json` | Summaries + equity curves (dates / equity_eur / drawdown) |
| `C:\Users\kater\.cursor\projects\investing\reports\sim_core_mid.csv` | Flat summary fallback |
| `C:\Users\kater\.cursor\projects\investing\reports\research_selection_kpis.csv` | Strategy-family comparison |
| `C:\Users\kater\.cursor\projects\investing\data\cache\*.parquet` | Optional curve rebuild (prefer `sim_latest.json`) |

### Observed sim snapshot (`sim_latest.json`, generated 2026-07-23)

| Strategy | Start | CAGR | Sharpe | Max DD |
|----------|------:|-----:|-------:|-------:|
| `core_buyhold_VWCE.DE` | €6,000 | ~13.7% | ~1.01 | ~-21% |
| `mid_top10_tsmom_12m` | €11,000 | ~29.5% | ~1.36 | ~-18% |

Re-run sims in the investing repo before gold export if numbers should be current.

## B — Nordic Equity (market tape)

| Path | Role |
|------|------|
| `01-finance/data/gold/DimCompany.csv` | Nordic large-cap dim (~82 · FI/SE/DK/NO) |
| `01-finance/data/gold/FactPrices.csv` | OHLCV + SMA/MACD/RSI + RSI signals |
| [Live board](https://heatmap-web-five.vercel.app) | CTA on Nordic Tape page |

Mid-universe overlap currently in Nordic gold: `NOKIA.HE`, `ERIC-B.ST`, `VOLV-B.ST`, `INVE-B.ST`, `NESTE.HE`, `NDA-FI.HE`.

## Export plan

`scripts/export-from-sources.mjs` reads A + B and writes gold:

- From A: `DimSleeve`, `DimGate`, `FactSimSummary`, `FactEquityCurve`, `FactResearchKpi`
- From B: `DimNordicCompany`, `FactNordicPrices` (+ `InMidUniverse` flag)

Do **not** commit broker credentials or live account dumps.

## Caveats

- Engineering / research budget — **not financial advice**  
- OP Bank ETFs are ring-fenced (display-only context)  
- Day sleeve stays blocked until mid gates pass (per capital.yaml)  
- Nordic prices are Yahoo delayed — same caveats as Nordic Equity  

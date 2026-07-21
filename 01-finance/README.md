# Nordic Equity

Near-live Nordic large-cap board — TradingView-style sector heatmap and ticker explorer with classic day-trading indicators.

| | |
|---|---|
| Audience | Investors / analysts / Nordic market watchers |
| Theme | Nordic Boardroom |
| Pages | Landing · Nordic Heatmap · Ticker Explorer · Context |
| Open | [`NordicEquity.pbip`](NordicEquity.pbip) |
| Data | Yahoo Finance delayed · refresh `node scripts/build-gold.mjs` |

## Pages

| Page | Screenshot |
|------|------------|
| Landing | ![Landing](screenshots/landing.png) |
| Nordic Heatmap | ![Nordic Heatmap](screenshots/nordic-heatmap.png) |
| Ticker Explorer | ![Ticker Explorer](screenshots/ticker-explorer.png) |
| Context | ![Context](screenshots/context.png) |

## Build

```powershell
node scripts/build-gold.mjs
node scripts/scaffold-nordic-equity-pbip.mjs   # first time / model reset
node scripts/elevate-nordic-equity-report.mjs
powerbi-report-author validate NordicEquity.Report
```

Open `NordicEquity.pbip` in Desktop → Refresh → screenshots.

## Notes

- Indicators: SMA 20/50, EMA/MACD (12/26/9), RSI 14, Bollinger (20, 2σ), volume  
- **No price forecast** in this report (separate future project)  
- Not investment advice · delayed public quotes  

# Scripts

| Order | Script | Role |
|------:|--------|------|
| 1 | `build-gold.py` | Olist raw CSVs → star gold (`FactOrders`, `DimSeller`, `DimProduct`, `DimCustomer`, `DimDate`, `FactCorridor`, `FactDemandWeekly`) |
| 2 | `forecast-demand.py` | Reads `FactDemandWeekly.csv` → writes `FactForecast.csv` + `ModelMetrics.csv` (SARIMAX, seasonal-naive fallback) |
| 3 | `scaffold-logistics-pbip.mjs` | Gold CSVs → TMDL semantic model (`LogisticsPulse.SemanticModel`) + 4 page shells (`LogisticsPulse.Report`) |
| 4 | `elevate-logistics-report.mjs` | Adds Landing (harbor-mist), polishes Delivery Pulse / Sellers & Routes / Demand Outlook / Context, nav + sync slicers |

## Run order

```powershell
# 1–2: gold + forecast (needs data/raw/ Olist CSVs — see data/raw/SOURCE.md)
python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python scripts\build-gold.py
.venv\Scripts\python scripts\forecast-demand.py

# 3–4: PBIP authoring (Node ESM, no npm deps)
node scripts\scaffold-logistics-pbip.mjs
node scripts\elevate-logistics-report.mjs
```

Re-running `scaffold-` or `elevate-` is safe — both are idempotent (overwrite tables/pages/visuals in place; `elevate-` resolves pages by `displayName` from `pages.json`, not hardcoded IDs).

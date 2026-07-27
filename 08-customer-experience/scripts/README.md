# Scripts

| Order | Script | Role |
|------:|--------|------|
| 1 | `enrich-reviews.py` | Olist reviews × Logistics `FactOrders` → gold + themes + sync dims |
| 2 | `score-detractor.py` | Logistic `DetractorProbability` / `RiskBand` / `RiskRank` on FactReviews |
| 3 | `scaffold-experience-pbip.mjs` | TMDL model + analysis page shells |
| 4 | `elevate-experience-report.mjs` | Landing (`linen-mist`) + polish all pages |

## Run order

```powershell
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python scripts\enrich-reviews.py
.\.venv\Scripts\python scripts\score-detractor.py
node scripts\scaffold-experience-pbip.mjs   # first time / model reset
node scripts\elevate-experience-report.mjs
powerbi-report-author validate ExperiencePulse.Report
# Push layout into the open Desktop instance (required — Desktop does not watch files)
powerbi-desktop status
powerbi-desktop reload --pid <pid> --wait-seconds 120
```

After gold/TMDL changes (`enrich-reviews.py`, `score-detractor.py`, measure edits), also **Refresh** the model in Desktop — `reload` alone updates report definition, not imported data.

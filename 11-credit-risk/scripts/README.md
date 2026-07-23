# Credit Risk Pulse — scripts

| Script | Role |
|--------|------|
| `download-homecredit.py` | Fetch Home Credit raw via Hugging Face mirror (or use Kaggle CLI) |
| `build-gold.py` | Raw → star/feature gold sample (`DimApplication`, bridges) |
| `score-pd.py` | LightGBM + Platt PD · grades · EL · ROC/PSI/cutoff/new-business gold |
| `scaffold-credit-pbip.mjs` | PBIP + semantic model (TMDL) from gold |
| `elevate-credit-report.mjs` | Nordic Boardroom pages, visuals, theme chrome |

Typical order: download → build-gold → score-pd → scaffold → elevate → `powerbi-report-author validate CreditRisk.pbip`.

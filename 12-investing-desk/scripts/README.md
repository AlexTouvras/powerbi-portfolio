# Investing Desk scripts

| Script | Purpose |
|--------|---------|
| `export-from-sources.mjs` | Build `data/gold/` from investing repo + `01-finance` Nordic gold |
| `scaffold-investing-desk-pbip.mjs` | Create `InvestingDesk.pbip` + semantic model + page shells |
| `elevate-investing-desk-report.mjs` | Write Nordic Boardroom visuals across 7 pages |

Optional env:

- `INVESTING_ROOT` — override path to investing repo (default `../../investing`)
- `HEATMAP_WEB_URL` — live Nordic board URL for Regional Markets CTA

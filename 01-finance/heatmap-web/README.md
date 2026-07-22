# Nordic Equity · Sector heatmap (Vercel)

TradingView-style stock heatmap that native Power BI treemaps cannot do well: **sector groups**, **company logos**, **day-change % on tiles**, intentional market-board chrome.

## Local

```bash
# from 01-finance/
node scripts/snapshot-board.mjs
cd heatmap-web
npm install
npm run dev
```

## Deploy (Vercel)

```bash
cd heatmap-web
npx vercel
# or: vercel --prod
```

Root directory for the Vercel project: `01-finance/heatmap-web`.  
Build command: `npm run build` (runs board snapshot first).  
Output: `dist`.

After deploy, the production URL is wired as `HEATMAP_WEB_URL` in `scripts/elevate-nordic-equity-report.mjs` (default `https://heatmap-web-five.vercel.app`).

### Keep the board fresh with the portfolio

Weekday gold refresh is owned by the monorepo Action  
`.github/workflows/nordic-equity-gold-refresh.yml`. To auto-redeploy this site after `board.json` commits:

1. Vercel → Project → **Settings → Git → Deploy Hooks** → create hook (Production)
2. Add the hook URL as GitHub repo secret **`VERCEL_DEPLOY_HOOK`**

Or connect the GitHub repo to this Vercel project (Root Directory = `01-finance/heatmap-web`) so pushes rebuild automatically.

## Data

`public/board.json` is generated from `data/gold/DimCompany.csv` + latest `FactPrices.csv` rows (`IsLatest=1`). Re-run `node scripts/snapshot-board.mjs` after gold rebuilds.

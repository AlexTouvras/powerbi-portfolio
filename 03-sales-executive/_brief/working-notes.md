# Working notes — Rounds 0–2

## Dependency status
- Semantic model: **new local** from `03-sales-executive/data/raw`
- PBIP/PBIR: not created
- Desktop Bridge: available
- Modeling MCP: not confirmed
- Fabric publish: deferred

## Audience (locked from user)
- C-level / senior leadership
- Job: self-serve actionable insights; showcase-quality storytelling
- Tone: high-end, calm Nordic

## Facts / dimensions
**Grain:** sales order line (`sls_ord_num` + `sls_prd_key`)

**Fact:** sales_details — order_dt, ship_dt, due_dt, sales, qty, price  
**Dims:** customer (cust_info + ERP birth/gender + country), product (prd_info + category), date

## Risks
- Date columns are integers `YYYYMMDD` (need typed date)
- Customer key prefix mismatch (`AW00011000` vs `AW-00011000`) — normalize in model
- `prd_cost` may be null on some rows — margin measures need safe divide
- Kaggle sales notebook dataset unavailable — using article warehouse CSVs (documented)

## First-build scope
- C-level sales executive report (not full medallion ETL showcase)
- Warehouse / churn / bank / healthcare folders = WIP only

## Round 3 — report shape (user chose option 3)

Composition: **Executive + Drill + Explorer** (3 pages)

| # | Page | Archetype | Layout variant (draft) | Purpose |
|---|------|-----------|------------------------|---------|
| 1 | Portfolio Pulse | Executive Summary | **B. KPI-Strip** — 5–6 peer KPIs, no single hero metric | 5-second status: revenue, orders, AOV, customers, YoY |
| 2 | Performance Drivers | Analytical Canvas | Filter-rail / category·region focus | Why: product line, category, discount/price mix, ship lag |
| 3 | Customer & Market | Comparative Benchmark | Ranking + geo/segment compare | Who/where: country, segment proxies, top customers |

**Global slicers (landing + synced where useful):** Order date range, Country, Product category  
**Page 2 extras:** Product line, maybe manufacturer/subcat  
**Page 3 extras:** searchable Customer (high cardinality)

**Core measures (model later):** Revenue, Orders, Units, AOV, Customers, YoY Revenue %, MoM Revenue %, Margin % (if cost joinable)

**Deferred:** full medallion ETL demo, Fabric publish, healthcare/bank/churn builds

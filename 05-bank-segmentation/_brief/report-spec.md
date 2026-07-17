# Report Spec — Bank Value & Engagement

## Report identity
- Report name: Bank Value & Engagement
- Semantic model: local PBIP from `05-bank-segmentation/data/gold`
- Audience: retail-bank CRO / relationship lead
- Theme: Nordic Boardroom (family consistency with Sales + Churn)
- Pages: 3 visible + 1 drillthrough

## Decisions
- Scaled gold seed (~5k customers · ~50k txns) — not upstream 200-row sample
- RFM + k-means ValueSegment in gold
- Geocoded DimCity for azureMap
- Signature visuals: waterfall, scatter, funnel, city bar (map when signed in), drillthrough

## Pages
1. Franchise Pulse — KPIs, waterfall, monthly trend
2. Segments & Markets — segment mix, F×M scatter, city map
3. Relationship Book — dormant/single-product queues, engagement funnel
4. Customer Profile (drillthrough, hidden) — one customer detail

## Verify
- validate PBIR · Desktop refresh · screenshots without banners

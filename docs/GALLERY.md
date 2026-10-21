# Figure gallery

`analytics_engine render` on the approved Study Duration fit. Open University registrations, time in days, event = withdrawal.

| | |
|---|---|
| N | 29,824 |
| Events | 7,387 |
| Concordance | 0.64 |
| Reference stratum | FFF |
| Horizon | 100 days |
| Hash | `9d1912888e2bad01d6e69c9bb316252b38881493cb9d77e100bccc0f44c7f071` |

The fit tables stay in `14-learning-duration/data/fit-draft`, which is gitignored. A clone of this repo has the pictures. Redraw them only on a machine that still has that approved directory:

```powershell
$env:PYTHONPATH = "_shared"
py -3.12 -m analytics_engine render --fit 14-learning-duration/data/fit-draft --out docs/gallery/study-duration
```

`StudyDuration.pbip` binds the Kaplan–Meier curve, the forest, and β(t) on the Argument page through Deneb. That page keeps four terms whose hazard ratio changes. The β(t) figure below is every term in the fit. Plot list: [PLOT_CATALOGUE.md](PLOT_CATALOGUE.md).

## Argument figures

![Kaplan–Meier with at-risk counts](gallery/study-duration/kaplan-meier.png)

![Cox forest, hazard ratios versus FFF](gallery/study-duration/forest.png)

![Cumulative events, one minus Kaplan–Meier](gallery/study-duration/cumulative-events.png)

![Smoothed hazard by module](gallery/study-duration/hazard.png)

![Restricted mean time versus FFF, clock at 262 days](gallery/study-duration/rmst.png)

![Decision curve at day 100](gallery/study-duration/decision-curve.png)

![Calibration at day 100](gallery/study-duration/calibration.png)

![Cox nomogram, survival at day 100](gallery/study-duration/nomogram.png)

![β(t) for every Cox term](gallery/study-duration/beta-time.png)

## Diagnostics

These belong on a methods page. The caption names the null.

![Cumulative hazard](gallery/study-duration/cumulative-hazard.png)

![Log cumulative hazard](gallery/study-duration/log-cumulative-hazard.png)

![Reverse Kaplan–Meier of censoring](gallery/study-duration/censoring.png)

![Adjusted survival](gallery/study-duration/adjusted-survival.png)

![Cox–Snell](gallery/study-duration/cox-snell.png)

![Aalen additive hazard](gallery/study-duration/aalen.png)

![Martingale residuals](gallery/study-duration/martingale.png)

![Deviance residuals](gallery/study-duration/deviance.png)

![dfbeta influence](gallery/study-duration/influence.png)

## Catalogue rows on report pages

Rows 1–20 are Power BI pages, not matplotlib. The root [README](../README.md) shows most of them. This is the row-to-page map.

| # | Plot | Page |
|---|------|------|
| 1 | Waterfall | [Bank Franchise Pulse](../05-bank-segmentation/screenshots/franchise-pulse.png) |
| 2 | Forecast PI ribbon | [Logistics Demand Outlook](../04-supply-chain/screenshots/demand-outlook.png) |
| 3 | Sankey / pathway | [Care Pathways & Drivers](../06-healthcare-analytics/screenshots/pathways-drivers.png) |
| 4–5 | Key Influencers, decomposition | [Churn Drivers](../02-ecommerce-churn/screenshots/churn-drivers.png), [Experience Drivers](../08-customer-experience/screenshots/drivers.png) |
| 6 | Matrix heatmap | [Care Pathways & Drivers](../06-healthcare-analytics/screenshots/pathways-drivers.png) |
| 7–8 | Scatter, funnel | [Bank Segments & Markets](../05-bank-segmentation/screenshots/segments-markets.png), [Relationship Book](../05-bank-segmentation/screenshots/relationship-book.png) |
| 9 | Ordered erosion bars | [Experience Pulse](../08-customer-experience/screenshots/experience-pulse.png) |
| 10–11, 15 | Cut-off frontier, calibration, grade strip | [Cut-off Strategy](../11-credit-risk/screenshots/cutoff-strategy.png), [Scorecard & Validation](../11-credit-risk/screenshots/scorecard-validation.png) |
| 12 | Treemap | [Nordic Heatmap](../01-finance/screenshots/nordic-heatmap.png) |
| 13 | Book vs optimizer | [Risk & Mandate](../12-investing-desk/screenshots/risk-mandate.png) |
| 14 | Composite KPI + delta | [Sales Portfolio Pulse](../03-sales-executive/screenshots/portfolio-pulse.png) |
| 16–17 | Slope, dumbbell | [Customer & Market](../03-sales-executive/screenshots/customer-market.png) |
| 18, 20 | Stream, lollipop | [Delivery Pulse](../04-supply-chain/screenshots/delivery-pulse.png) |
| 19 | Seasonal decomposition | [Demand Outlook](../04-supply-chain/screenshots/demand-outlook.png) |
| Statement | Chart of accounts and OP bridge | [P&L Pulse](../10-fpa-controllership/screenshots/p-l-pulse.png), [Variance Drivers](../10-fpa-controllership/screenshots/variance-drivers.png) |
| 21–24 | Kaplan–Meier, forest, cumulative events, decision curve | The figures above |

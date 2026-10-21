# Analytics engine

The engine answers a duration question for whatever table the caller passes. It does not contain a dataset, and it does not choose one. A fixed-horizon label stays on the logistic scripts (`score-churn.py`, `score-readmit.py`, `score-detractor.py`, `score-pd.py`). One measured series stays on SARIMAX (`forecast-demand.py`).

Instrument pages stay on the [report page contract](report-page-contract.md): Landing, Pulse, Drivers, Queue, Context. A duration fit is what an argument page is allowed to quote. The title of that page is the finding. The body is one model, the figures below, and sentences filled from the fit.

## Outcome

| Kind | Columns the caller names | Where it is fit |
|---|---|---|
| `duration` | `time` (≥ 0), `event` (0 or 1), optional `strata`, optional covariates, optional `horizon` | This engine |
| `label` | One binary or class column | Existing score scripts |
| `series` | One time column, one value column | `forecast-demand.py` |

`strata` is the Kaplan–Meier grouping. It also enters the Cox model as a factor unless it is already listed as a covariate. `reference` picks the level that is left out of the dummies (`{"group": "A"}`). Numeric covariates stay numeric. A covariate with no variation is dropped.

## Fit tables

| Table | Grain |
|---|---|
| `FactKm` | Stratum × time. Survival, log-log 95% band, n at risk, events, censorings |
| `StratumSummary` | Stratum. N, events, median, restricted mean on one shared clock, and the difference versus the reference stratum with a Greenwood 95% interval. The clock is the latest time at which every stratum still has a tenth of its rows at risk |
| `FactCox` | Term. Hazard ratio, 95% interval, p, reference level. Efron ties |
| `FactPh` | Term. Grambsch–Therneau p and verdict `holds` or `changes` |
| `FactBetaT` | Term × time. Scaled Schoenfeld residual, and a cubic smooth of β(t) on log time with a pointwise 95% band |
| `FactPrediction` | One row, when a horizon was set. N still at risk (event = 0), expected exits inside the horizon |
| `FactCensor` | Reverse Kaplan–Meier. Censoring is the event |
| `FactResidual` | Row. Linear predictor, martingale residual, deviance residual |
| `FactInfluence` | Term × row. dfbeta, the approximate change in the coefficient when the row is omitted |
| `FactAdjusted` | Profile × time. Cox predicted survival at the reference profile |
| `FactHazard` | Stratum × time. Epanechnikov smooth of the Nelson–Aalen hazard, one bandwidth for every stratum, pointwise 95% band |
| `FactCoxSnell` | Residual. Nelson–Aalen cumulative hazard of the Cox–Snell residuals. A fitting model tracks y = x |
| `FactCalibration` | Predicted-risk group. Mean Cox risk of the event by a stated time, against one minus the Kaplan–Meier survival in that group |
| `FactAalen` | Term × time. Cumulative coefficient of the Aalen additive hazard, with a pointwise 95% band |
| `FactDecision` | Threshold × strategy. Net benefit of the Cox model, of treating everyone, and of treating no one. The rates are Kaplan–Meier rates |
| `FactNomogram` | Axis × tick. Points, covariate scales, total points, and survival at the stated time |
| `ModelMetrics` | One row. N, events, censorings, concordance, log-rank p |

The proportional-hazards test uses the Kaplan–Meier time transform, which is the transform current R `cox.zph` uses. lifelines' own default is the rank transform, and the two will not match digit for digit. lifelines stores the scaled Schoenfeld residual centered at zero; R adds the Cox coefficient. `FactBetaT.Residual` is the lifelines value. The figure adds the coefficient before drawing, so the dashed line sits on the Cox coefficient.

A verdict is `changes` when the term's p-value is below 0.05. That term does not get to keep a single hazard ratio as the whole story: the β(t) panel is the result.

## Citation

A sentence may contain `{Measure}` only for a name the fit produced. `N`, `Events`, `NCensored`, `Concordance`, `LogRankP`, `Horizon`, `NAtRisk`, `ExpectedExits`, and `Median_<stratum>` when that median is finite. Any other name raises. A draft raises before a number is formatted.

`fit` returns a draft. `release` marks an in-memory result citeable; report code and agents do not call it. The command line cannot approve a fit.

```bash
PYTHONPATH=_shared python -m analytics_engine fit \
  --csv path/to/rows.csv \
  --time time --event event \
  --strata group --covariates x \
  --horizon 2 --reference group=A \
  --out out/duration

# a person, after reading the draft, copies the hash:
# cp out/duration/fit_hash.txt out/duration/APPROVED

PYTHONPATH=_shared python -m analytics_engine cite \
  --fit out/duration \
  --template "Of {N} rows, concordance {Concordance}."

PYTHONPATH=_shared python -m analytics_engine render \
  --fit out/duration --out out/duration/figures
```

`fit` writes the tables, `draft.json`, and `fit_hash.txt`. It never writes `APPROVED`. `cite` and `render` require `APPROVED` to contain the current hash. Refitting changes the hash, and the old approval stops matching.

## What a figure claims

Every figure ends with the same binding: the columns the caller named, the latest time in the table, and the first eight characters of the fit hash.

```text
time = days · event = died · strata = arm · covariates = age · horizon = 365 · reference arm = control · follow-up through 420 · fit a1b2c3d4
```

`follow-up through` is the latest time on `FactKm`, which is the latest observed time. `fit` is the prefix of the hash in `fit_hash.txt`. A whole number is printed without a decimal.

`render` writes that line again to `figures.json` beside the pngs, with the full hash and the follow-up as a number. The argument page prints the binding under the figure. The method sentence above the binding says which estimand the panel is. The binding says which columns it was counted from.

## Figure collection

The set follows the publication gallery in survminer and the survival package: `ggsurvplot`, `ggforest`, `ggcoxzph`, `ggcoxdiagnostics`, and `ggadjustedcurves`.

| File | What it shows |
|---|---|
| `kaplan-meier.png` | Step curve, log-log band, at-risk table |
| `cumulative-hazard.png` | −log of the Kaplan–Meier estimate, drawn while survival stays at or above 0.02, band transformed and stopped at the same floor |
| `cumulative-events.png` | One minus the Kaplan–Meier estimate. One event type, so this is not a competing-risk cumulative incidence |
| `log-cumulative-hazard.png` | Complementary log-log against log time. Parallel curves are what proportional hazards look like |
| `censoring.png` | Reverse Kaplan–Meier of the censoring time |
| `forest.png` | Log hazard-ratio axis, line at 1, interval labels |
| `beta-time.png` | Scaled Schoenfeld points, smooth, band, dashed Cox coefficient, the test in the panel title |
| `martingale.png` | Martingale residual against the linear predictor, smooth, line at 0 |
| `deviance.png` | Deviance residual. Filled points had the event, open points were censored |
| `influence.png` | dfbeta against time, one panel per coefficient |
| `adjusted-survival.png` | Cox predicted survival for each stratum. Other categories at the reference level, numeric covariates at their mean |

Cumulative hazard, cumulative events, and the log-log plot are drawn from `FactKm`. The others are drawn from the tables above. Captions that quote a count go through the citation rule.

## Further estimands

A histogram of the recorded time treats a censored row as if that time were the event. These figures do not. Each one is an estimand with a stated null.

| File | What it shows |
|---|---|
| `hazard.png` | Kernel-smoothed hazard from the Nelson–Aalen estimator, one bandwidth for every stratum, pointwise 95% band. The figure keeps the central 90 percent of follow-up and drops a point whose upper band is more than three times that stratum's typical hazard |
| `cox-snell.png` | Nelson–Aalen cumulative hazard of the Cox–Snell residuals against the line y = x |
| `calibration.png` | Observed Kaplan–Meier event rate against mean predicted Cox risk, by quantile group, at the horizon or the median follow-up |
| `aalen.png` | Cumulative additive-hazard coefficients. A flat stretch adds no hazard. The line at 0 is no effect |
| `decision-curve.png` | Net benefit across decision thresholds. Treat-all and treat-none are the comparators. Rates are Kaplan–Meier rates |
| `nomogram.png` | Cox nomogram. Points, each covariate, total points, and survival at the stated time |
| `rmst.png` | Difference in restricted mean time versus the reference stratum. One shared clock. Greenwood 95% interval. The line at 0 is no difference |

## What this is not

Care Pulse cannot be passed through as time-to-readmission. The UCI file labels an encounter `<30`, `>30`, or `NO` and has no readmission date. The product-survival page in the reference figures needs a catalog with an on-sale date and a withdrawal date; that file is not in this repo. When a table of that shape shows up, the same command produces the draft.

Dependencies: `_shared/analytics_engine/requirements.txt` (pandas, numpy, matplotlib, scipy, statsmodels, lifelines). Tests draw their own rows and live in `_shared/analytics_engine/tests`.

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
| `StratumSummary` | Stratum. N, events, median, restricted mean |
| `FactCox` | Term. Hazard ratio, 95% interval, p, reference level. Efron ties |
| `FactPh` | Term. Grambsch–Therneau p and verdict `holds` or `changes` |
| `FactBetaT` | Term × time. Scaled Schoenfeld residual, and a cubic smooth of β(t) on log time with a pointwise 95% band |
| `FactPrediction` | One row, when a horizon was set. N still at risk (event = 0), expected exits inside the horizon |
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

The three figures are `kaplan-meier.png` (step curve, log-log band, at-risk table), `forest.png` (log hazard-ratio axis, line at 1), and `beta-time.png` (residual points, smooth, band, dashed Cox coefficient, the test in the panel title). Their captions are filled through the same citation rule.

## What this is not

Care Pulse cannot be passed through as time-to-readmission. The UCI file labels an encounter `<30`, `>30`, or `NO` and has no readmission date. The product-survival page in the reference figures needs a catalog with an on-sale date and a withdrawal date; that file is not in this repo. When a table of that shape shows up, the same command produces the draft.

Dependencies: `_shared/analytics_engine/requirements.txt` (pandas, numpy, matplotlib, scipy, statsmodels, lifelines). Tests draw their own rows and live in `_shared/analytics_engine/tests`.

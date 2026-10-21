# 14 – Study Duration

Time to withdrawal on Open University modules. Argument page quotes an **approved** duration fit via Deneb (KM · forest · β(t)).

**Status:** PBIP with approved fit · Argument Deneb binders wired  
**Audience:** a programme lead who wants to know who leaves, and when.  
**Theme:** Nordic Boardroom · Landing `valley-dusk`

## Pipeline

```powershell
py -3.12 scripts/build-gold.py

$env:PYTHONPATH = "..\_shared"
py -3.12 -m analytics_engine fit `
  --csv data/gold\FactRegistration.csv `
  --time TimeDays --event Event --strata Stratum `
  --covariates AgeBand,HighestEducation,StudiedCredits,PrevAttempts,Disability,Gender `
  --horizon 100 --reference Stratum=FFF `
  --out data\fit-draft

# Person: copy fit_hash.txt → APPROVED (already done for the wired Argument page)
# Export FactKm / FactCox / thinned FactBetaT into data/gold (see scripts notes)

node scripts/scaffold-study-duration-pbip.mjs
node scripts/elevate-study-duration-report.mjs
powerbi-report-author validate StudyDuration.Report
```

Open `StudyDuration.pbip`, Refresh the model, install **Deneb** from AppSource if prompted.

## Pages

| Page | Role |
|------|------|
| **Landing** | What we analyse: OULAD module withdrawal timing (CCC vs FFF) |
| **Pulse** | Counts, withdrawal share by module, days kept |
| **Argument** | Stay-enrolled curves + Cox risk vs FFF (approved fit) |
| **Context** | Unit of analysis, clock, licence, fit hash |

## Fit

- Hash: see `data/fit-draft/fit_hash.txt` (mirrored in `APPROVED`)
- N = 29,824 · Events = 7,387 · Concordance ≈ 0.64 · reference **FFF** · horizon 100 days
- `FactBetaT` in gold is thinned (smooth + sampled residuals) for Deneb’s row budget

## Spec

[`_brief/report-spec.md`](_brief/report-spec.md)

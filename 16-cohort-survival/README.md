# 16 – Cohort Survival

All-cause survival in the METABRIC breast cancer cohort. Draft data grain only: no PBIP yet.

**Status:** Gold built. Report spec is a draft and is not approved for pages.  
**Audience:** a reader of a research cohort. This is not a tool for choosing treatment.

## Pipeline

```powershell
py -3.12 scripts/build-gold.py
```

```powershell
$env:PYTHONPATH = "..\_shared"
py -3.12 -m analytics_engine fit `
  --csv data/gold/FactPatient.csv `
  --time TimeMonths --event Event --strata Stratum `
  --covariates Age,Nodes,Hormone,Chemotherapy,Radiotherapy `
  --horizon 60 --reference Stratum=LumA `
  --out data/fit-draft
```

## Gold

`data/gold/FactPatient.csv` is one patient.

- `TimeMonths` is overall survival from diagnosis
- `Event` is 1 for death from any cause
- Living patients are censored at last follow-up
- `Stratum` is the Claudin / PAM50 subtype. `NC` is dropped (under 30 patients)
- The source spelling `Positve` on ER status is stored as `Positive`

Relapse-free survival is not in the file. Raw clinical text is gitignored. See `data/raw/SOURCE.md`.

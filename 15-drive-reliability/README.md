# 15 – Drive Reliability

Time to failure for drives Backblaze published in the first quarter of 2025. Draft data grain only: no PBIP yet.

**Status:** Gold built (318,426 drives, 1,067 failures, 2025 Q1). Report spec is a draft and is not approved for pages.  
**Audience:** someone choosing a drive model on observed failures, not on a brochure AFR.

## Pipeline

```powershell
py -3.12 scripts/build-gold.py
```

The raw zip is about 1 GB and is gitignored. The script keeps it if it is already in `data/raw/`.

```powershell
$env:PYTHONPATH = "..\_shared"
py -3.12 -m analytics_engine fit `
  --csv data/gold/FactDrive.csv `
  --time TimeDays --event Event --strata Stratum `
  --covariates CapacityTb `
  --horizon 60 --reference Stratum=Seagate `
  --out data/fit-draft
```

Use the reference stratum the script prints. Seagate is the usual largest group, not a promise.

## Gold

`data/gold/FactDrive.csv` is one serial number in `2025Q1`.

- `TimeDays` is the last snapshot minus the first snapshot in that quarter
- `Event` is 1 if `failure` was 1 on any day
- Drives still running are censored on their last day
- `Stratum` is the manufacturer. Models with fewer than 200 drives fold into `Other`

This clock is not hours since manufacture. See `data/raw/SOURCE.md`.

# 13 – Wine Market

Bottle reviews, country-year production, and a separate lab sample. Draft data grain only: no PBIP yet.

**Status:** Gold built. Report spec is a draft and is not approved for pages.  
**Audience:** A buyer or editor comparing price, score, and where the wine is made.

## Pipeline

```powershell
py -3.12 scripts/build-gold.py
```

## Gold

| File | Grain |
|------|--------|
| `data/gold/FactBottle.csv` | One Wine Enthusiast review. Points, price, place, variety, vintage parsed from the title. |
| `data/gold/FactCountryYear.csv` | One country-year of wine production, in tonnes. |
| `data/gold/DimCountry.csv` | ISO3 bridge between review country names and production names. |
| `data/gold/FactLab.csv` | One UCI Vinho Verde sample. Not the same wines as the reviews. |

Raw files stay in `data/raw/` and are gitignored. See `data/raw/SOURCE.md`.

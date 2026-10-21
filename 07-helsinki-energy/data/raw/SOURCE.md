# Helsinki energy — raw sources

## Primary (locked): Nuuka open API (City of Helsinki)

| | |
|--|--|
| Portal | [HRI — energy consumption of Helsinki service properties](https://hri.fi/data/en/dataset/helsingin-kaupungin-palvelukiinteistojen-energiankulutustietoja) |
| Auth | None |
| Grain | Property / building · monthly / daily / hourly · Electricity, Heating, Water, Cooling |

### Smoke-test endpoints (verified 2026-07-23)

```text
GET https://helsinki-openapi.nuuka.cloud/api/v1.0/Property/List?Customer=Helsinki
# → ~1,809 properties (e.g. 1000 Hakaniemen kauppahalli)

GET https://helsinki-openapi.nuuka.cloud/api/v1.0/EnergyData/Daily/ListByProperty
  ?Customer=Helsinki&Record=LocationName
  &SearchString=1000%20Hakaniemen%20kauppahalli
  &ReportingGroup=Electricity
  &StartTime=2019-01-01&EndTime=2019-12-31
```

Swagger / docs linked from the Avoindata / HRI dataset page.

## Staging plan

1. `scripts/fetch-nuuka.mjs` — pull property list + a bounded daily electricity window for a property cohort  
2. Persist JSON/CSV under `data/raw/nuuka/` (gitignore bulky dumps if needed)  
3. Gold: `DimProperty`, `DimDate`, `FactEnergy`, anomaly flags  

## Caveats

- Availability varies by property and reporting group  
- Data updates about once per day — near-live, not tick streaming  
- Public municipal meters — not private residential smart-meter PII  

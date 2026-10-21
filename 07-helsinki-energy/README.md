# 07 — Facility Energy (planned)

Nordic Boardroom **Helsinki facilities energy** report: consumption, peaks, anomalies — open city data.

**Status:** Prework · API verified · PBIP not built yet  
**Audience:** Facilities / sustainability lead  
**Theme:** Nordic Boardroom

## Dataset (locked)

**[Helsinki Nuuka open API](https://hri.fi/data/en/dataset/helsingin-kaupungin-palvelukiinteistojen-energiankulutustietoja)** — electricity / heating / water / cooling for city service properties (~1,800+ properties; no auth).

See [`data/raw/SOURCE.md`](data/raw/SOURCE.md).

## Planned pages

| Page | Role |
|------|------|
| **Landing** | Poster · thesis · audience · page map |
| **Energy Pulse** | kWh KPIs · YoY · property-type mix |
| **Peaks & Patterns** | Hour × weekday heat · anomaly timeline |
| **Property Queue** | Outlier / high-intensity properties |
| **Context** | Nuuka attribution · update lag · sample window |

## Planned pipeline

```powershell
node scripts/fetch-nuuka.mjs   # property list + daily energy sample → data/raw or gold
node scripts/build-gold.mjs
# later: scaffold + elevate PBIP
```

## Spec

[`_brief/report-spec.md`](_brief/report-spec.md)

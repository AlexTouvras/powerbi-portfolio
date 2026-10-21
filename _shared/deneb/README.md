# Deneb binders (argument pages)

Checked-in Vega-Lite templates for duration-engine figures in Power BI Desktop via **Deneb** (AppSource).

These belong on **argument** pages (claim title + figures), not Nordic Boardroom instrument chrome. Controllership / Pulse / Drivers stay on catalogue rows 1–20.

## Visual GUID

```
deneb7E15AEF80B9E4D4F8E12924291ECE89A
```

Certified AppSource Deneb — no `.pbiviz` folder required in the PBIP. Register the GUID on `report.json` → `publicCustomVisuals` when first used.

## Templates

| File | Engine table | Fields (nativeQueryRef) |
|------|--------------|-------------------------|
| `templates/km-at-risk.vl.json` | `FactKm` | `Stratum`, `Time`, `Survival`, `Lo`, `Hi`, `NRisk` |
| `templates/forest.vl.json` | `FactCox` | `Term`, `HazardRatio`, `Lo`, `Hi` |
| `templates/beta-t.vl.json` | `FactBetaT` | `Term`, `Time`, `Residual`, `Beta`, `Lo`, `Hi`, `Kind` |

Column names match `_shared/analytics_engine/fit.py` (`_KM_COLUMNS`, `_COX_COLUMNS`, `_BETA_COLUMNS`).

## Wire into a report

1. Load engine gold (`FactKm` / `FactCox` / `FactBetaT`) into the semantic model (Import CSV or generated from `analytics_engine fit`).
2. From elevate / authoring, call the helpers in `deneb-binders.mjs` (or import the `.vl.json` in the Deneb editor and map placeholders).
3. Bind **all** fields into Deneb’s single `dataset` Values well — field names in the spec must match `nativeQueryRef`.
4. Approve the fit (`APPROVED` hash) before citing numbers on the page.

## Sample data

`sample/*.csv` is written from the engine’s synthetic draw (same seed as unit tests). Regenerate:

```powershell
$env:PYTHONPATH = "_shared"
py -3.12 _shared/deneb/scripts/write-sample-gold.py
```

## PBIR helper

```js
import { buildDenebKm, buildDenebForest, buildDenebBetaT, DENEB_GUID } from "./deneb-binders.mjs";
```

Each builder returns a visual container JSON ready for `writeVisual`. Specs are embedded as stringified `objects.vega.jsonSpec`.

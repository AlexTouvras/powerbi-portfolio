# Report Spec — Care Pulse (Hospital Readmission)

**Status:** APPROVED — built with Microsoft Sankey pathway + screenshots  
**Folder:** `06-healthcare-analytics`  
**Report name:** Care Pulse  
**PBIP (proposed):** `CarePulse.pbip`

## Report identity

| Field | Decision |
|-------|----------|
| Audience | Hospital CMO / quality & utilization lead |
| Theme | Nordic Boardroom (family consistency with Sales, Churn, Bank) |
| Delivery | Local PBIP (Desktop Bridge verify + screenshots) |
| Pages | 3 visible analysis + Context (last) + 1 hidden Encounter Profile drillthrough |

## Dataset decision

Prefer **UCI Diabetes 130-US Hospitals** (true `readmitted` label, ~101k encounters) over the KDNuggets Kaggle billing sample (no outcomes). Document both in `DATASETS.md`; gold may be a stratified sample (~25–40k) for snappy Desktop refresh.

## Advanced analytics

- Gold prep: clean age bands, admission/discharge pathway stages, `Readmit30` flag  
- ML: logistic (or HGB) **30-day readmission propensity** → `ReadmitProbability`, `RiskBand`, `RiskRank` in gold  
- DAX: readmit rate, LOS, high-risk discharge counts  

## Signature visuals (new vs portfolio)

| Page | Signature (new to portfolio) |
|------|------------------------------|
| Care Pulse | KPI strip + LOS / volume trend |
| Pathways & Drivers | **Sankey** (AppSource custom, like Icon Map) or **ribbonChart** pathway; **heatMap** / matrix heatmap |
| Discharge Risk Queue | Ranked risk table + risk/age/disposition slicers |
| Encounter Profile | Hidden drillthrough |

**Avoid as heroes:** Key Influencers, RFM, Azure/Icon Map (already featured).

## Page plan

1. **Care Pulse** — portfolio health: encounters, 30d readmit rate, avg LOS, high-risk discharges; monthly volume  
2. **Pathways & Drivers** — care pathway Sankey; readmit rate heatmap (e.g. age band × primary diagnosis group)  
3. **Discharge Risk Queue** — intervention list sorted by propensity  
4. **Context** (last visible) — audience, how to read Sankey, data/model caveats  
5. **Encounter Profile** (hidden) — drillthrough detail for one encounter/patient  

## Design direction

- Nordic Boardroom: mist `#F7FAFC`, white cards radius 8, synced dropdowns (per-field sync groups), rounded pageNavigator, classic `card`, footer source line  
- Risk accents: High = `#B42318`, Medium = `#C17B3A`, Low / teal = `#2F5F73`  

## Dependencies

| Dependency | Status |
|------------|--------|
| powerbi-report-planning / design / authoring | Available |
| semantic-model-authoring + Modeling MCP | Available |
| healthcare-analytics skill | Created |
| Python (pandas/sklearn) | Available (from churn/bank) |
| Desktop Bridge | Available |
| UCI raw download | In progress / required before gold |

## Out of scope

- Real-time HL7 / FHIR feeds  
- Fabric publish (unless later approved)  
- Clinical decision support claims  

## Approval

Reply **approve** (or request edits) to unlock implementation: gold → score → PBIP → validate → Desktop screenshots.

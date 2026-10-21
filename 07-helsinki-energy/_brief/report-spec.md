# Report Spec — Facility Energy

**Status:** DRAFT (wave-2 approved · awaiting build kickoff)  
**Folder:** `07-helsinki-energy`  
**Report name:** Facility Energy  
**PBIP (planned):** `FacilityEnergy.pbip`

## Report identity

| Field | Decision |
|-------|----------|
| Audience | Facilities / sustainability |
| Theme | Nordic Boardroom |
| Delivery | Local PBIP; optional scheduled Nuuka refresh later |
| Pages | Landing · Energy Pulse · Peaks & Patterns · Property Queue · Context |

## Dataset

Nuuka Helsinki open API → gold star for selected properties / date window.

## Page plan

1. **Landing** — hero = total kWh or anomaly count  
2. **Energy Pulse** — consumption KPIs, type mix, trend  
3. **Peaks & Patterns** — hour×weekday heat, spike flags  
4. **Property Queue** — ranked intensity / anomaly list  
5. **Context** — API, lag, sample cohort  

## Out of scope (v1)

- Full hourly history for all 1,800 properties (too heavy) — cohort + daily first  
- Fabric Real-Time IoT  

## Verify (when built)

- fetch script returns properties · gold build · PBIR validate · screenshots  

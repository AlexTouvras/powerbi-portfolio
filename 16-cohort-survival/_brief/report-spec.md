# Report spec — Cohort Survival

**Status: draft.** Not approved. Do not author PBIR from this file. There is no design contract yet.

## Report identity

- Report name: Cohort Survival
- Folder: `16-cohort-survival`
- Audience: a research reader
- Primary purpose: see how survival separates by tumour subtype, with a single hazard model beside it
- Delivery target: local gold now; an argument page only after a person approves a fit

This does not replace Care Pulse. Care Pulse is a 30-day readmission label. This table has a clock.

## Grain

`FactPatient`. METABRIC overall survival.

| Column | Rule |
|--------|------|
| `TimeMonths` | Months from diagnosis to death or last follow-up. |
| `Event` | 1 if `OS_STATUS` starts with 1 (deceased), else 0. |
| `Stratum` | `CLAUDIN_SUBTYPE`. Levels with fewer than 30 patients are dropped. |
| Covariates | `Age`, `Nodes`, `Hormone`, `Chemotherapy`, `Radiotherapy` as 0/1 where the source said yes or no. |

Rows missing the clock or one of those covariates are excluded. Current gold: 1,898 patients, 1,098 deaths, reference stratum `LumA`, horizon 60 months.

All-cause death is the event. Death from another cause is not split out. Relapse is a different clock and is not in this file.

Cite cBioPortal, Curtis et al. 2012, and Pereira et al. 2016. The page, when it exists, states that this is a research cohort and not a treatment recommendation.

## Proposed pages

1. Landing
2. Pulse — patients, deaths, follow-up
3. Argument — Kaplan–Meier by subtype, quoted only from an approved fit
4. Context — the event definition, the drops, and the research limit

There is no action queue. Ranking these patients for a decision would overclaim the file.

## Out of this step

No semantic model and no pages.

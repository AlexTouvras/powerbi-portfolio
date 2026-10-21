# Report spec — Drive Reliability

**Status: draft.** Not approved. Do not author PBIR from this file. There is no design contract yet.

## Report identity

- Report name: Drive Reliability
- Folder: `15-drive-reliability`
- Audience: an infrastructure lead
- Primary purpose: see which manufacturers fail sooner inside one observed quarter
- Delivery target: local gold now; an argument page only after a person approves a fit

## Grain

`FactDrive`. One drive, cohort `2025Q1`.

| Column | Rule |
|--------|------|
| `TimeDays` | Days from the first snapshot of that serial in the quarter to the last. |
| `Event` | 1 if the Backblaze failure flag is set on any day, else 0. |
| `Stratum` | Manufacturer parsed from the model string. Groups under 200 drives become `Other`. |
| Covariate | `CapacityTb` |

Follow-up stops at the quarter boundary, so most drives are censored and a median lifetime will not appear. Current gold: 318,426 drives, 1,067 failures, median days observed 89, reference stratum Seagate. The comparison is which group fails sooner inside this window. Power-on hours are left out: using them as time from zero would pretend every drive was observed from the factory.

Cite Backblaze. Do not sell the raw zip.

## Proposed pages

1. Landing
2. Pulse — drives, failures, days observed
3. Argument — Kaplan–Meier by manufacturer, quoted only from an approved fit
4. Context — the quarter clock, and that this is not a warranty claim

A model queue waits until the fit says a model is actually worse.

## Out of this step

No semantic model and no pages.

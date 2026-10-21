# Report spec — Study Duration

**Status: Argument page unlocked.** Fit approved (`data/fit-draft/APPROVED`). PBIP authored for Landing · Pulse · Argument · Context.

## Report identity

- Report name: Study Duration
- Folder: `14-learning-duration`
- PBIP: `StudyDuration.pbip`
- Audience: a programme lead
- Primary purpose: see which modules lose students, and how early
- Delivery target: local PBIP; Argument quotes the approved fit via Deneb

## Grain

`FactRegistration`. One row per student-module-presentation that was still enrolled on day 0.

| Column | Rule |
|--------|------|
| `TimeDays` | Days from module start. Withdrawals are clipped into `[0, course length]`. Stayers sit on the course length. |
| `Event` | 1 if `FinalResult` is Withdrawn, else 0. |
| `Stratum` | Module code (`AAA`–`GGG`). |
| Covariates for the first fit | `AgeBand`, `HighestEducation`, `StudiedCredits`, `PrevAttempts`, `Disability`, `Gender` |

Current gold: 29,824 rows, 7,387 withdrawals, reference stratum `FFF`, horizon 100 days.

## Fit (approved)

- Concordance ≈ 0.64 · log-rank p ≪ 0.01
- Claim: Module CCC withdraws faster than FFF (HR ≈ 1.88 vs FFF)
- Several terms have PH verdict `changes` → β(t) panel is required

## Pages

1. **Landing** — claim + page map (`valley-dusk`)
2. **Pulse** — registrations / withdrawals / rate / concordance
3. **Argument** — Deneb KM (`FactKm`) · forest (`FactCox`) · β(t) (`FactBetaT` thinned)
4. **Context** — clock rule, OULAD CC BY 4.0, fit hash, Deneb GUID

## Out of this step

Queue page deferred. Full showcase capture after Desktop opens cleanly with Deneb installed and model refreshed.

# Theme review — Nordic-Finesse → Nordic-Boardroom

Evidence: `_shared/themes` + WCAG contrast math (this session).

## What worked

- Cool mist canvas and fjord teal accent read as Nordic, not generic purple SaaS
- No borders / no shadows — good restraint
- Primary ink `#1F2A33` on white/mist passes AA easily (~13–14:1)

## Gaps found (must fix)

| Issue | Evidence | Fix in Nordic-Boardroom |
|-------|----------|-------------------------|
| Secondary labels fail AA | `#6B7C86` on white = **4.33:1** (needs 4.5) | Secondary → `#5A6B75` (**5.53:1**) |
| Tertiary fails AA | `#8A9AA3` on white = **2.9:1** | Darken to `#6B7C86` or use secondary for body |
| Monochrome `dataColors` | 8 blues/greys — series collide; no categorical separation | Teal + slate + warm copper + forest (max 8, CVD-friendlier) |
| No sentiment keys | Missing `good` / `bad` / `neutral` | Green `#1B7A4E`, red `#B42318`, grey neutral — variance only |
| White labels on pastel tiles | Treemap white on `#C8DCE3` = **1.42:1** | Dark ink labels; keep fills mid-dark |
| Legacy `card` only | Modern reports use `cardVisual` | Add `cardVisual` + zero padding (base.json safeguard) |
| No `textbox` / `slicer` rules | Titles inherit card chrome | Transparent textbox; clear slicer headers |
| Value axes hidden on columns | Hard to read magnitude | Dotted mist gridlines; bars still start at 0 |
| Callout 28 / title 18 | Flat hierarchy for board | Callout **32**, page title **20** Semibold |

## Design identity locked

- **Tone:** Nordic Boardroom — cool mist surfaces, fjord teal primary, copper as second categorical hue, semantic green/red only for variance; Segoe UI; generous whitespace; no chrome noise
- **Signature:** Composite KPI strip — value + YoY delta (color + `▲/▼` text, never color alone) recurring on every page header band

## Files

- New: `_shared/themes/Nordic-Boardroom.json` (use for Sales Executive)
- Legacy: `01-finance/Nordic-theme.json` kept for the stock treemap WIP until that project migrates

# Report spec — Wine Market

**Status: draft.** Not approved. Do not author PBIR from this file. There is no design contract yet.

## Report identity

- Report name: Wine Market
- Folder: `13-wine-market`
- Audience: a buyer or editor
- Primary purpose: see where score and price separate, and how production has moved
- Delivery target: local gold now; PBIP after this spec is approved

## Grains

Three tables. A bottle is not a country-year, and a lab sample is not a review.

- `FactBottle` — about 130k reviews from 2017. `CountryCode` is ISO3 where the review country has a clear match. England is left unmatched.
- `FactCountryYear` — FAOSTAT tonnes via the Our World in Data wine-production grapher. Country rows only, so continents are not added back into the total. This is not a direct OIV download.
- `FactLab` — 6,497 red and white Vinho Verde samples. Chemistry and a 0–10 score. Cite Cortez et al. 2009. Do not join it to the reviews.

The tasting note is not in gold.

## Proposed pages

1. Landing — poster, one hero number, page map
2. Market Pulse — review volume, median points, median price
3. Price and Place — price against points, a vintage slope for a few countries, a variety lollipop
4. Supply — production by country over years
5. Context — CC BY-NC-SA on the reviews, the 2017 scrape, the production unit, and the lab file as a different population

## Out of this step

No semantic model, no pages, no duration fit. Nothing here has a censoring clock.

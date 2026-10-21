# Raw sources — Wine Market

Not committed. `scripts/build-gold.py` downloads anything missing.

| File | Source | Licence |
|------|--------|---------|
| `winemag-data-130k-v2.csv` | Wine Enthusiast reviews, June and November 2017, via [TidyTuesday 2019-05-28](https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-05-28) | CC BY-NC-SA 4.0 (Kaggle `zynicide/wine-reviews`) |
| `wine-production.csv` | [Our World in Data wine production](https://ourworldindata.org/grapher/wine-production) grapher. FAOSTAT tonnes, the series OIV harmonises with. Not a direct OIV extract. | CC BY, cite OWID and FAOSTAT |
| `winequality-red.csv`, `winequality-white.csv` | [UCI Wine Quality](https://archive.ics.uci.edu/dataset/186/wine+quality) | CC BY 4.0. Cite Cortez, Cerdeira, Almeida, Matos, and Reis, Decision Support Systems, 2009. |

The review file's tasting note stays in raw. Gold keeps the title, not the paragraph.

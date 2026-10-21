"""Build Wine Market gold: bottle reviews, country-year production, lab samples.

Three grains. They do not share a row. CountryCode is the only bridge between
bottles and production, and the lab file is a different population.
"""

from __future__ import annotations

import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
GOLD = ROOT / "data" / "gold"

REVIEWS_URL = (
    "https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/"
    "data/2019/2019-05-28/winemag-data-130k-v2.csv"
)
PRODUCTION_URL = "https://ourworldindata.org/grapher/wine-production.csv"
UCI_RED = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/"
    "wine-quality/winequality-red.csv"
)
UCI_WHITE = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/"
    "wine-quality/winequality-white.csv"
)

# Review country name -> ISO3, matching Our World in Data / FAOSTAT codes.
# England is omitted on purpose: it is not the United Kingdom.
REVIEW_ISO3 = {
    "US": "USA",
    "France": "FRA",
    "Italy": "ITA",
    "Spain": "ESP",
    "Portugal": "PRT",
    "Chile": "CHL",
    "Argentina": "ARG",
    "Australia": "AUS",
    "Austria": "AUT",
    "Germany": "DEU",
    "New Zealand": "NZL",
    "South Africa": "ZAF",
    "Israel": "ISR",
    "Greece": "GRC",
    "Canada": "CAN",
    "Hungary": "HUN",
    "Bulgaria": "BGR",
    "Romania": "ROU",
    "Uruguay": "URY",
    "Turkey": "TUR",
    "Slovenia": "SVN",
    "Georgia": "GEO",
    "Croatia": "HRV",
    "Mexico": "MEX",
    "Moldova": "MDA",
    "Brazil": "BRA",
    "Lebanon": "LBN",
    "Morocco": "MAR",
    "Peru": "PER",
    "Ukraine": "UKR",
    "Macedonia": "MKD",
    "Czech Republic": "CZE",
    "Cyprus": "CYP",
    "India": "IND",
    "Serbia": "SRB",
    "Switzerland": "CHE",
    "Luxembourg": "LUX",
    "Armenia": "ARM",
    "Bosnia and Herzegovina": "BIH",
    "Slovakia": "SVK",
    "China": "CHN",
    "Egypt": "EGY",
    "Lithuania": "LTU",
    "South Korea": "KOR",
    "Japan": "JPN",
}

YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
LAB_RENAME = {
    "fixed acidity": "FixedAcidity",
    "volatile acidity": "VolatileAcidity",
    "citric acid": "CitricAcid",
    "residual sugar": "ResidualSugar",
    "chlorides": "Chlorides",
    "free sulfur dioxide": "FreeSulfurDioxide",
    "total sulfur dioxide": "TotalSulfurDioxide",
    "density": "Density",
    "pH": "Ph",
    "sulphates": "Sulphates",
    "alcohol": "Alcohol",
    "quality": "Quality",
}


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "PowerBI-portfolio"})
    with urllib.request.urlopen(request, timeout=120) as response, dest.open("wb") as out:
        out.write(response.read())


def vintage_from_title(title: object) -> float:
    if not isinstance(title, str):
        return float("nan")
    for match in YEAR_RE.finditer(title):
        year = int(match.group(0))
        if 1950 <= year <= 2017:
            return float(year)
    return float("nan")


def blank_to_unknown(series: pd.Series) -> pd.Series:
    text = series.fillna("").astype(str).str.strip()
    return text.mask(text.eq("") | text.str.lower().eq("nan"), "Unknown")


def build_bottles() -> pd.DataFrame:
    path = RAW / "winemag-data-130k-v2.csv"
    download(REVIEWS_URL, path)
    frame = pd.read_csv(path)
    frame = frame.drop(columns=[c for c in frame.columns if str(c).startswith("Unnamed")], errors="ignore")
    country = blank_to_unknown(frame["country"])
    bottles = pd.DataFrame(
        {
            "ReviewId": range(1, len(frame) + 1),
            "Country": country,
            "CountryCode": country.map(REVIEW_ISO3),
            "Province": blank_to_unknown(frame["province"]),
            "Region": blank_to_unknown(frame["region_1"]),
            "Winery": blank_to_unknown(frame["winery"]),
            "Variety": blank_to_unknown(frame["variety"]),
            "Vintage": frame["title"].map(vintage_from_title),
            "Points": pd.to_numeric(frame["points"], errors="coerce"),
            "Price": pd.to_numeric(frame["price"], errors="coerce"),
            "Taster": blank_to_unknown(frame["taster_name"]),
            "Title": frame["title"].fillna("").astype(str),
        }
    )
    bottles = bottles.dropna(subset=["Points"]).copy()
    bottles["ReviewId"] = range(1, len(bottles) + 1)
    bottles["Vintage"] = bottles["Vintage"].astype("Int64")
    unmapped = (
        bottles.loc[bottles["CountryCode"].isna() & bottles["Country"].ne("Unknown"), "Country"]
        .value_counts()
        .head(12)
    )
    if len(unmapped):
        print("review countries without an ISO3 code:")
        print(unmapped.to_string())
    return bottles


def build_production() -> pd.DataFrame:
    path = RAW / "wine-production.csv"
    download(PRODUCTION_URL, path)
    frame = pd.read_csv(path)
    value = [c for c in frame.columns if c not in {"Entity", "Code", "Year"}]
    if len(value) != 1:
        raise SystemExit(f"expected one production measure, got {value}")
    out = frame.rename(columns={"Entity": "Country", "Code": "CountryCode", value[0]: "ProductionTonnes"})
    code = out["CountryCode"].fillna("").astype(str)
    keep = code.str.fullmatch(r"[A-Z]{3}")
    out = out.loc[keep].copy()
    out["Year"] = pd.to_numeric(out["Year"], errors="coerce")
    out["ProductionTonnes"] = pd.to_numeric(out["ProductionTonnes"], errors="coerce")
    out = out.dropna(subset=["Year", "ProductionTonnes", "CountryCode"])
    out["Year"] = out["Year"].astype(int)
    return out[["CountryCode", "Country", "Year", "ProductionTonnes"]]


def build_country(bottles: pd.DataFrame, production: pd.DataFrame) -> pd.DataFrame:
    from_reviews = (
        bottles.dropna(subset=["CountryCode"])
        .groupby("CountryCode", as_index=False)
        .agg(ReviewCountry=("Country", "first"))
    )
    from_production = (
        production.groupby("CountryCode", as_index=False)
        .agg(ProductionCountry=("Country", "first"))
    )
    dim = from_reviews.merge(from_production, on="CountryCode", how="outer")
    return dim.sort_values("CountryCode")


def build_lab() -> pd.DataFrame:
    red_path = RAW / "winequality-red.csv"
    white_path = RAW / "winequality-white.csv"
    download(UCI_RED, red_path)
    download(UCI_WHITE, white_path)
    parts = []
    for color, path in (("Red", red_path), ("White", white_path)):
        frame = pd.read_csv(path, sep=";")
        frame = frame.rename(columns=LAB_RENAME)
        frame["Color"] = color
        parts.append(frame)
    lab = pd.concat(parts, ignore_index=True)
    lab.insert(0, "SampleId", range(1, len(lab) + 1))
    columns = ["SampleId", "Color", *LAB_RENAME.values()]
    return lab[columns]


def main() -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    bottles = build_bottles()
    production = build_production()
    country = build_country(bottles, production)
    lab = build_lab()
    if len(bottles) < 100_000:
        raise SystemExit(f"expected about 130k reviews, got {len(bottles)}")
    if bottles["Points"].min() < 80 or bottles["Points"].max() > 100:
        raise SystemExit("points fell outside the published 80-100 scale")
    if len(production) < 1_000:
        raise SystemExit(f"production grain is too small: {len(production)}")
    if len(lab) < 6_000:
        raise SystemExit(f"lab grain is too small: {len(lab)}")
    bottles.to_csv(GOLD / "FactBottle.csv", index=False)
    production.to_csv(GOLD / "FactCountryYear.csv", index=False)
    country.to_csv(GOLD / "DimCountry.csv", index=False)
    lab.to_csv(GOLD / "FactLab.csv", index=False)
    priced = int(bottles["Price"].notna().sum())
    vintaged = int(bottles["Vintage"].notna().sum())
    print(
        "GOLD_OK"
        f" bottles={len(bottles)}"
        f" priced={priced}"
        f" vintaged={vintaged}"
        f" production={len(production)}"
        f" countries={len(country)}"
        f" lab={len(lab)}"
    )


if __name__ == "__main__":
    sys.exit(main())

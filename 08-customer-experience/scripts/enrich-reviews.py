"""Translate Olist review comments PT→EN, tag themes, write Experience Pulse gold.

Outputs (data/gold/):
  FactReviews.csv       — review grain + EN text + primary theme + score bands
  FactReviewTheme.csv   — review × theme bridge (multi-label for matrices)
  DimTheme.csv          — theme catalog
  FactThemeQuotes.csv   — exemplar EN quotes for report callouts
  translate_cache.json  — unique-message EN cache (resume-safe)
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import pandas as pd
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"
RAW_LOCAL = ROOT / "data" / "raw"
RAW_OLIST = ROOT.parent / "04-supply-chain" / "data" / "raw"
ORDERS_GOLD = ROOT.parent / "04-supply-chain" / "data" / "gold" / "FactOrders.csv"
CACHE_PATH = GOLD / "translate_cache.json"
BATCH_FLUSH = 200

# Keyword rules scored on lowercased PT original + EN translation.
THEME_RULES: dict[str, list[str]] = {
    "Delivery": [
        r"\bentrega\b",
        r"\bprazo\b",
        r"\bdemora",
        r"\batras",
        r"\bchegou\b",
        r"\brecebi\b",
        r"\brastre",
        r"\bcorreio",
        r"\bfrete\b",
        r"\bdelivery\b",
        r"\blate\b",
        r"\bdelay",
        r"\bshipping\b",
        r"\barrived\b",
        r"\bdeadline\b",
        r"\btrack",
    ],
    "Product quality": [
        r"\bproduto\b",
        r"\bqualidade\b",
        r"\bdefeito",
        r"\bquebr",
        r"\bfuncion",
        r"\bqualidade",
        r"\bdiferente\b",
        r"\bquality\b",
        r"\bbroken\b",
        r"\bdefect",
        r"\bwork(s|ed|ing)?\b",
        r"\bitem\b",
        r"\bproduct\b",
    ],
    "Packaging": [
        r"\bembalag",
        r"\bcaixa\b",
        r"\bdanific",
        r"\bamassad",
        r"\bpackag",
        r"\bbox\b",
        r"\bdamaged\b",
        r"\bcrushed\b",
        r"\bseal",
    ],
    "Customer service": [
        r"\batendiment",
        r"\bloja\b",
        r"\bvendedor",
        r"\bsuporte\b",
        r"\bcontact",
        r"\bseller\b",
        r"\bstore\b",
        r"\bsupport\b",
        r"\bservice\b",
        r"\bconfi[aá]vel",
        r"\breliable\b",
    ],
    "Price & value": [
        r"\bpre[cç]o\b",
        r"\bcaro\b",
        r"\bbarato\b",
        r"\bcusto\b",
        r"\bvale\b",
        r"\bexpensive\b",
        r"\bcheap\b",
        r"\bprice\b",
        r"\bvalue\b",
        r"\bcost\b",
        r"\bfreight\b",
    ],
}

THEME_ORDER = [
    "Delivery",
    "Product quality",
    "Packaging",
    "Customer service",
    "Price & value",
    "General praise",
    "General complaint",
    "Other",
]


def resolve_reviews_csv() -> Path:
    for p in (
        RAW_LOCAL / "olist_order_reviews_dataset.csv",
        RAW_OLIST / "olist_order_reviews_dataset.csv",
    ):
        if p.exists():
            return p
    raise FileNotFoundError("olist_order_reviews_dataset.csv not found in raw folders")


def clean_text(s: object) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    t = str(s).replace("\r\n", " ").replace("\n", " ").strip()
    t = re.sub(r"\s+", " ", t)
    return t


def score_band(score: int) -> str:
    """Severity band for queues (not NPS vocabulary)."""
    if score <= 2:
        return "Low"
    if score == 3:
        return "Mid"
    return "High"


def proxy_nps_class(score: int) -> str:
    """CSAT 1–5 mapped to NPS-like buckets (documented as proxy)."""
    if score == 5:
        return "Promoter"
    if score == 4:
        return "Passive"
    return "Detractor"


def delivery_outcome(late_flag: int, lead_days: int) -> str:
    """On-time / Late / Very late. Late cut uses 30d lead (≈ late-order median)."""
    if int(late_flag) == 0:
        return "On-time"
    if int(lead_days) <= 30:
        return "Late"
    return "Very late"


DELIVERY_OUTCOME_ORDER = {"On-time": 1, "Late": 2, "Very late": 3}


def theme_hits(text: str) -> dict[str, int]:
    low = text.lower()
    hits: dict[str, int] = {}
    for theme, patterns in THEME_RULES.items():
        n = 0
        for pat in patterns:
            n += len(re.findall(pat, low, flags=re.IGNORECASE))
        if n:
            hits[theme] = n
    return hits


def assign_themes(pt: str, en: str, score: int) -> list[str]:
    hits = theme_hits(f"{pt} {en}")
    if hits:
        ranked = sorted(hits.items(), key=lambda kv: (-kv[1], THEME_ORDER.index(kv[0])))
        # keep themes within 1 hit of the top score (multi-label)
        top = ranked[0][1]
        return [t for t, n in ranked if n >= top - 1][:3]
    if not pt and not en:
        return ["Other"]
    if score >= 4:
        return ["General praise"]
    if score <= 2:
        return ["General complaint"]
    return ["Other"]


def ensure_argos_engine():
    """Return (tokenizer, ctranslate2.Translator) after lazy model load."""
    import argostranslate.package
    import argostranslate.translate

    try:
        langs = argostranslate.translate.get_installed_languages()
        pt = next(l for l in langs if l.code == "pt")
        en = next(l for l in langs if l.code == "en")
        underlying = pt.get_translation(en).underlying
    except Exception:
        argostranslate.package.update_package_index()
        available = argostranslate.package.get_available_packages()
        pkg = next(p for p in available if p.from_code == "pt" and p.to_code == "en")
        argostranslate.package.install_from_path(pkg.download())
        langs = argostranslate.translate.get_installed_languages()
        pt = next(l for l in langs if l.code == "pt")
        en = next(l for l in langs if l.code == "en")
        underlying = pt.get_translation(en).underlying

    # Force model load (stanza path once) then reuse CT2 batch API
    _ = underlying.translate("teste")
    if underlying.translator is None:
        raise RuntimeError("Argos CT2 translator failed to load")
    return underlying.pkg.tokenizer, underlying.translator


def translate_unique(messages: list[str], cache: dict[str, str]) -> dict[str, str]:
    pending = [m for m in messages if m and m not in cache]
    if not pending:
        print(f"Translate cache hit for all {len(messages):,} unique messages")
        return cache

    print(f"Translating {len(pending):,} unique messages (cache had {len(cache):,})…")
    tokenizer, translator = ensure_argos_engine()

    batch_size = 128
    ok = 0
    fail = 0
    for start in tqdm(range(0, len(pending), batch_size), unit="batch"):
        chunk = pending[start : start + batch_size]
        try:
            truncated = [(m if len(m) <= 500 else m[:500]) for m in chunk]
            src = [tokenizer.encode(m) for m in truncated]
            results = translator.translate_batch(
                src, beam_size=1, max_batch_size=batch_size
            )
            for msg, res in zip(chunk, results, strict=True):
                hyp = res.hypotheses[0] if res.hypotheses else []
                en = tokenizer.decode(hyp).strip() if hyp else msg
                cache[msg] = en if en else msg
                ok += 1
        except Exception as exc:  # noqa: BLE001 — resume-safe
            fail += len(chunk)
            for msg in chunk:
                cache[msg] = msg
            if fail <= batch_size * 2:
                print(f"  batch fail: {exc}")
        if (start // batch_size) % 5 == 0:
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print(f"Translated ok={ok:,} fail/fallback={fail:,}")
    return cache


def ensure_argos() -> None:
    ensure_argos_engine()


def pick_quotes(df: pd.DataFrame, n: int = 3) -> pd.DataFrame:
    """Exemplar EN quotes per Theme × ScoreBand for report callouts."""
    rows = []
    usable = df[
        (df["HasComment"] == 1)
        & (df["CommentEN"].str.len() >= 20)
        & (df["CommentEN"].str.len() <= 220)
    ].copy()
    for theme in THEME_ORDER:
        for band in ("Detractor", "Passive", "Promoter"):
            sub = usable[(usable["ThemePrimary"] == theme) & (usable["ProxyNPSClass"] == band)]
            if sub.empty:
                continue
            # prefer longer, more specific comments
            sub = sub.assign(_len=sub["CommentEN"].str.len()).sort_values(
                ["ReviewScore", "_len"], ascending=[True if band == "Detractor" else False, False]
            )
            for _, r in sub.head(n).iterrows():
                rows.append(
                    {
                        "Theme": theme,
                        "ProxyNPSClass": band,
                        "ReviewScore": int(r["ReviewScore"]),
                        "QuoteEN": r["CommentEN"],
                        "OrderID": r["OrderID"],
                        "LateFlag": int(r["LateFlag"]),
                    }
                )
    return pd.DataFrame(rows)


def main() -> None:
    t0 = time.time()
    GOLD.mkdir(parents=True, exist_ok=True)

    reviews_path = resolve_reviews_csv()
    print(f"Reviews: {reviews_path}")
    if not ORDERS_GOLD.exists():
        raise FileNotFoundError(f"Missing {ORDERS_GOLD} — run 04-supply-chain build-gold first")

    reviews = pd.read_csv(reviews_path)
    orders = pd.read_csv(ORDERS_GOLD)

    reviews["review_comment_message"] = reviews["review_comment_message"].map(clean_text)
    reviews["review_comment_title"] = reviews["review_comment_title"].map(clean_text)
    reviews["CommentPT"] = reviews.apply(
        lambda r: " — ".join(
            p for p in (r["review_comment_title"], r["review_comment_message"]) if p
        ),
        axis=1,
    )
    reviews["HasComment"] = (reviews["CommentPT"].str.len() > 0).astype(int)
    reviews["ReviewScore"] = pd.to_numeric(reviews["review_score"], errors="coerce").astype("Int64")
    reviews = reviews.dropna(subset=["ReviewScore"])
    reviews["ReviewScore"] = reviews["ReviewScore"].astype(int)

    # Join delivered ops grain
    fact = reviews.merge(orders, left_on="order_id", right_on="OrderID", how="inner")
    print(f"Joined reviews->orders: {len(fact):,} / {len(reviews):,} reviews")

    # Olist reuses some review_id values across different order_ids (~800 raw dups).
    # Fact grain must be unique ReviewID for theme-bridge many-to-one.
    before = len(fact)
    fact = fact.sort_values(
        ["review_id", "LateFlag", "review_score", "LeadTimeDays"],
        ascending=[True, False, True, False],
    )
    fact = fact.drop_duplicates(subset=["review_id"], keep="first")
    print(f"Deduped ReviewID: {before:,} -> {len(fact):,} (kept latest/late/lowest-score row)")

    # Translation cache for unique non-empty comments
    cache: dict[str, str] = {}
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    unique_msgs = sorted({m for m in fact.loc[fact["HasComment"] == 1, "CommentPT"].tolist() if m})
    cache = translate_unique(unique_msgs, cache)

    fact["CommentEN"] = fact["CommentPT"].map(lambda s: cache.get(s, "") if s else "")
    fact["ScoreBand"] = fact["ReviewScore"].map(score_band)
    fact["ProxyNPSClass"] = fact["ReviewScore"].map(proxy_nps_class)
    fact["DeliveryOutcome"] = [
        delivery_outcome(lf, lt)
        for lf, lt in zip(fact["LateFlag"], fact["LeadTimeDays"], strict=True)
    ]
    fact["DeliveryOutcomeSort"] = fact["DeliveryOutcome"].map(DELIVERY_OUTCOME_ORDER)

    themes_list = [
        assign_themes(pt, en, sc)
        for pt, en, sc in zip(fact["CommentPT"], fact["CommentEN"], fact["ReviewScore"], strict=True)
    ]
    fact["ThemePrimary"] = [t[0] for t in themes_list]
    fact["ThemeCount"] = [len(t) for t in themes_list]

    fact["ReviewDate"] = pd.to_datetime(fact["review_creation_date"], errors="coerce").dt.strftime(
        "%Y-%m-%d"
    )

    fact_out = pd.DataFrame(
        {
            "ReviewID": fact["review_id"],
            "OrderID": fact["OrderID"],
            "CustomerID": fact["CustomerID"],
            "SellerID": fact["SellerID"],
            "Category": fact["Category"],
            "CustomerState": fact["CustomerState"],
            "OrderDate": fact["OrderDate"],
            "ReviewDate": fact["ReviewDate"],
            "ReviewScore": fact["ReviewScore"],
            "ScoreBand": fact["ScoreBand"],
            "ProxyNPSClass": fact["ProxyNPSClass"],
            "DeliveryOutcome": fact["DeliveryOutcome"],
            "DeliveryOutcomeSort": fact["DeliveryOutcomeSort"].astype(int),
            "OnTime": fact["OnTime"].astype(int),
            "LateFlag": fact["LateFlag"].astype(int),
            "LeadTimeDays": fact["LeadTimeDays"].astype(int),
            "Freight": fact["Freight"],
            "HasComment": fact["HasComment"].astype(int),
            "CommentPT": fact["CommentPT"],
            "CommentEN": fact["CommentEN"],
            "ThemePrimary": fact["ThemePrimary"],
            "ThemeCount": fact["ThemeCount"],
        }
    )
    fact_out.to_csv(GOLD / "FactReviews.csv", index=False)
    print(f"FactReviews: {len(fact_out):,}")

    # Multi-label bridge
    bridge_rows = []
    for rid, themes in zip(fact_out["ReviewID"], themes_list, strict=True):
        for th in themes:
            bridge_rows.append({"ReviewID": rid, "Theme": th})
    bridge = pd.DataFrame(bridge_rows)
    bridge.to_csv(GOLD / "FactReviewTheme.csv", index=False)
    print(f"FactReviewTheme: {len(bridge):,}")

    # DimTheme
    primary_counts = fact_out["ThemePrimary"].value_counts()
    dim_theme = pd.DataFrame(
        {
            "Theme": THEME_ORDER,
            "ThemeSort": list(range(1, len(THEME_ORDER) + 1)),
            "PrimaryReviewN": [int(primary_counts.get(t, 0)) for t in THEME_ORDER],
        }
    )
    dim_theme.to_csv(GOLD / "DimTheme.csv", index=False)

    quotes = pick_quotes(fact_out, n=3)
    quotes.to_csv(GOLD / "FactThemeQuotes.csv", index=False)
    print(f"FactThemeQuotes: {len(quotes):,}")

    # Lightweight copy of orders dims used by CX report (same folder for PBIP)
    for name in ("FactOrders.csv", "DimDate.csv", "DimSeller.csv", "DimProduct.csv"):
        src = ORDERS_GOLD.parent / name
        if src.exists():
            dest = GOLD / name
            if not dest.exists() or src.stat().st_mtime > dest.stat().st_mtime:
                dest.write_bytes(src.read_bytes())
                print(f"Synced {name}")

    # Summary metrics for README / DQ
    with_c = fact_out[fact_out["HasComment"] == 1]
    late_mean = fact_out.loc[fact_out["LateFlag"] == 1, "ReviewScore"].mean()
    ontime_mean = fact_out.loc[fact_out["LateFlag"] == 0, "ReviewScore"].mean()
    theme_mix = fact_out["ThemePrimary"].value_counts(normalize=True).head(8)

    dq = GOLD / "DQ_NOTES.md"
    dq.write_text(
        f"""# Gold DQ notes — Experience Pulse (reviews)

Generated by `scripts/enrich-reviews.py`.

| Check | Result |
|-------|--------|
| Reviews joined to delivered orders | {len(fact_out):,} |
| Unique ReviewID (deduped) | {fact_out["ReviewID"].nunique():,} |
| With free-text comment | {len(with_c):,} ({100 * len(with_c) / len(fact_out):.1f}%) |
| Unique comments translated | {len(unique_msgs):,} |
| Translator | Argos Translate PT→EN (offline) |
| Themes | Keyword rules on PT+EN |
| Avg score on-time | {ontime_mean:.2f} |
| Avg score late | {late_mean:.2f} |

## Primary theme mix

```
{theme_mix.to_string()}
```

## Metric notes

- **ReviewScore** is marketplace 1–5 (CSAT-like), not a 0–10 NPS survey.
- **ProxyNPSClass** maps 5→Promoter, 4→Passive, 1–3→Detractor for optional NPS storytelling — label as proxy on Context.
- **ScoreBand** is severity Low(1–2) / Mid(3) / High(4–5) for queues — not NPS vocabulary.
- **DeliveryOutcome** is On-time / Late (late ∧ lead ≤ 30d) / Very late (late ∧ lead > 30d).
- Olist reuses some `review_id` values across orders; gold **dedupes to one row per ReviewID** (prefer late / lower score).
- Comment English is machine translation; keep Portuguese available for audit.
""",
        encoding="utf-8",
    )

    print("\nTheme mix (primary %):")
    print((theme_mix * 100).round(1).to_string())
    print(f"\nDone in {time.time() - t0:.0f}s → {GOLD}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted — cache flushed periodically; re-run to resume.", file=sys.stderr)
        sys.exit(130)

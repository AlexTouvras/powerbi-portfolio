"""Build basket edges from FactSales and score them with the shared analyst.

An edge is two products on the same order. The weight is how many orders
contain that pair. The analyst scores the graph. This file does not
reimplement the score.
"""
from __future__ import annotations

import subprocess
import sys
from itertools import combinations
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "data" / "gold"
BRAIN = Path(__file__).resolve().parents[2] / "_shared" / "analyst" / "brain.py"


def write_edges() -> Path:
    sales = pd.read_csv(GOLD / "FactSales.csv", usecols=["OrderNumber", "ProductKey"])
    products = pd.read_csv(GOLD / "DimProduct.csv", usecols=["ProductKey", "ProductName"])
    names = dict(zip(products["ProductKey"], products["ProductName"]))
    counts: dict[tuple[str, str], int] = {}
    for keys in sales.groupby("OrderNumber")["ProductKey"].apply(lambda s: sorted(set(s))):
        if len(keys) < 2:
            continue
        labels = [str(names.get(key, key)) for key in keys]
        for left, right in combinations(labels, 2):
            pair = (left, right) if left <= right else (right, left)
            counts[pair] = counts.get(pair, 0) + 1
    edges = pd.DataFrame(
        [(a, b, n) for (a, b), n in counts.items()],
        columns=["Source", "Target", "Orders"],
    ).sort_values(["Orders", "Source", "Target"], ascending=[False, True, True])
    path = GOLD / "FactBasketEdge.csv"
    edges.to_csv(path, index=False)
    print(f"FactBasketEdge: {len(edges):,} pairs")
    return path


def main() -> None:
    edges = write_edges()
    subprocess.check_call(
        [
            sys.executable,
            str(BRAIN),
            "network",
            "--edges",
            str(edges),
            "--source",
            "Source",
            "--target",
            "Target",
            "--weight",
            "Orders=Orders",
            "--undirected",
            "--node-column",
            "Product",
            "--output",
            str(GOLD / "DimBasketNetwork.csv"),
        ]
    )


if __name__ == "__main__":
    main()

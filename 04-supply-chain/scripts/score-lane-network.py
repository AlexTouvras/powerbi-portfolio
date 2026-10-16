"""Score the Olist corridor graph for Logistics Pulse.

Reads data/gold/FactCorridor.csv and writes data/gold/DimLaneNetwork.csv.
A directed lane is kept when its weight is positive. Self-loops are dropped.
Weight decides which lanes exist. Betweenness then counts shortest paths
and does not use the weight as a distance. Cut points are articulation
points of that same graph, treated as undirected.

This matches the OpenBI 0.3.14 NETWORK.NODES result on these lanes
(unweighted directed betweenness, zero-weight edges omitted).
"""
from __future__ import annotations

from pathlib import Path

import networkx as nx
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"

NAMES = {
    "AC": "Acre",
    "AL": "Alagoas",
    "AP": "Amapa",
    "AM": "Amazonas",
    "BA": "Bahia",
    "CE": "Ceara",
    "DF": "Distrito Federal",
    "ES": "Espirito Santo",
    "GO": "Goias",
    "MA": "Maranhao",
    "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais",
    "PA": "Para",
    "PB": "Paraiba",
    "PR": "Parana",
    "PE": "Pernambuco",
    "PI": "Piaui",
    "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul",
    "RO": "Rondonia",
    "RR": "Roraima",
    "SC": "Santa Catarina",
    "SP": "Sao Paulo",
    "SE": "Sergipe",
    "TO": "Tocantins",
}


def digraph(corridor: pd.DataFrame, weight: str) -> nx.DiGraph:
    graph = nx.DiGraph()
    for row in corridor.itertuples(index=False):
        seller = row.SellerState
        customer = row.CustomerState
        if seller == customer:
            continue
        value = float(row.Orders) if weight == "orders" else float(row.Orders) * float(row.LateRate)
        if value <= 0:
            continue
        if graph.has_edge(seller, customer):
            graph[seller][customer]["weight"] += value
        else:
            graph.add_edge(seller, customer, weight=value)
    return graph


def score(graph: nx.DiGraph, prefix: str) -> pd.DataFrame:
    between = nx.betweenness_centrality(graph, normalized=False, weight=None)
    cuts = set(nx.articulation_points(graph.to_undirected()))
    frame = pd.DataFrame(
        {
            "State": list(between),
            f"{prefix}Betweenness": [between[state] for state in between],
            f"IsCutPoint{prefix}": [1 if state in cuts else 0 for state in between],
        }
    )
    frame[f"{prefix}Rank"] = (
        frame[f"{prefix}Betweenness"].rank(method="dense", ascending=False).astype(int)
    )
    return frame


def write_lane_network(source: Path | None = None, target: Path | None = None) -> pd.DataFrame:
    source = source or (GOLD / "FactCorridor.csv")
    target = target or (GOLD / "DimLaneNetwork.csv")
    corridor = pd.read_csv(source)
    late = score(digraph(corridor, "late"), "Late")
    orders = score(digraph(corridor, "orders"), "Order")
    out = late.merge(orders, on="State", how="outer")
    out["StateName"] = out["State"].map(NAMES).fillna(out["State"])
    for column in ("LateBetweenness", "OrderBetweenness"):
        out[column] = out[column].fillna(0).round(4)
    for column in ("IsCutPointLate", "IsCutPointOrder", "LateRank", "OrderRank"):
        out[column] = out[column].fillna(0).astype(int)
    out = out[
        [
            "State",
            "StateName",
            "LateBetweenness",
            "OrderBetweenness",
            "LateRank",
            "OrderRank",
            "IsCutPointLate",
            "IsCutPointOrder",
        ]
    ].sort_values(["LateRank", "State"])
    target.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(target, index=False)
    cut = ", ".join(out.loc[out["IsCutPointLate"] == 1, "State"]) or "(none)"
    print(f"DimLaneNetwork: {len(out):,} states, late cut point {cut} -> {target.name}")
    return out


def main() -> None:
    write_lane_network()


if __name__ == "__main__":
    main()

"""Portfolio analyst. One entry point for every report.

Reports pass an edge table and column names. This module scores the graph.
It does not know which report it is serving.

    python _shared/analyst/brain.py network \
        --edges <gold.csv> --source <col> --target <col> \
        --weight <Name>=<col> [--weight <Name>=<col>*<col> ...] \
        --output <score.csv>

A positive weight keeps a directed edge. A self-loop is dropped. Betweenness
counts shortest paths and does not treat the weight as a distance. A cut
point is an articulation point of that graph, read as undirected.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import networkx as nx
import pandas as pd


def parse_weight(spec: str) -> tuple[str, list[str]]:
    if "=" not in spec:
        raise SystemExit(f"weight must look like Name=Column or Name=Column*Column, got {spec!r}")
    name, expr = spec.split("=", 1)
    name = name.strip()
    columns = [part.strip() for part in expr.split("*") if part.strip()]
    if not name or not columns:
        raise SystemExit(f"weight must look like Name=Column or Name=Column*Column, got {spec!r}")
    return name, columns


def digraph(edges: pd.DataFrame, source: str, target: str, columns: list[str]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for row in edges.itertuples(index=False):
        as_dict = row._asdict()
        origin = as_dict[source]
        dest = as_dict[target]
        if origin == dest or pd.isna(origin) or pd.isna(dest):
            continue
        value = 1.0
        for column in columns:
            value *= float(as_dict[column])
        if value <= 0:
            continue
        origin = str(origin)
        dest = str(dest)
        if graph.has_edge(origin, dest):
            graph[origin][dest]["weight"] += value
        else:
            graph.add_edge(origin, dest, weight=value)
    return graph


def score_graph(graph: nx.DiGraph, name: str) -> pd.DataFrame:
    between = nx.betweenness_centrality(graph, normalized=False, weight=None)
    cuts = set(nx.articulation_points(graph.to_undirected()))
    nodes = list(between)
    frame = pd.DataFrame(
        {
            "Node": nodes,
            f"{name}Betweenness": [between[node] for node in nodes],
            f"IsCutPoint{name}": [1 if node in cuts else 0 for node in nodes],
        }
    )
    frame[f"{name}Rank"] = frame[f"{name}Betweenness"].rank(method="dense", ascending=False).astype(int)
    return frame


def score_network(
    edges: pd.DataFrame,
    source: str,
    target: str,
    weights: list[tuple[str, list[str]]],
    node_column: str,
) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for name, columns in weights:
        missing = [column for column in columns if column not in edges.columns]
        if missing:
            raise SystemExit(f"weight {name} needs columns {missing} on the edge table")
        if source not in edges.columns or target not in edges.columns:
            raise SystemExit(f"edge table needs {source!r} and {target!r}")
        scored = score_graph(digraph(edges, source, target, columns), name)
        frames.append(scored)
    out = frames[0]
    for frame in frames[1:]:
        out = out.merge(frame, on="Node", how="outer")
    out = out.rename(columns={"Node": node_column})
    for name, _columns in weights:
        out[f"{name}Betweenness"] = out[f"{name}Betweenness"].fillna(0).round(4)
        out[f"{name}Rank"] = out[f"{name}Rank"].fillna(0).astype(int)
        out[f"IsCutPoint{name}"] = out[f"IsCutPoint{name}"].fillna(0).astype(int)
    first = weights[0][0]
    column_order = [node_column]
    column_order += [f"{name}Betweenness" for name, _columns in weights]
    column_order += [f"{name}Rank" for name, _columns in weights]
    column_order += [f"IsCutPoint{name}" for name, _columns in weights]
    return out[column_order].sort_values([f"{first}Rank", node_column])


def apply_labels(scored: pd.DataFrame, node_column: str, label_map: Path, label_key: str, label_column: str) -> pd.DataFrame:
    labels = pd.read_csv(label_map)
    if label_key not in labels.columns or label_column not in labels.columns:
        raise SystemExit(f"label map needs columns {label_key!r} and {label_column!r}")
    merged = scored.merge(
        labels[[label_key, label_column]].drop_duplicates(label_key),
        left_on=node_column,
        right_on=label_key,
        how="left",
    )
    if label_key != node_column:
        merged = merged.drop(columns=[label_key])
    merged[label_column] = merged[label_column].fillna(merged[node_column])
    ordered = [node_column, label_column] + [column for column in scored.columns if column != node_column]
    return merged[ordered]


def write_network(args: argparse.Namespace) -> pd.DataFrame:
    weights = [parse_weight(spec) for spec in args.weight]
    edges = pd.read_csv(args.edges)
    scored = score_network(edges, args.source, args.target, weights, args.node_column)
    if args.label_map:
        scored = apply_labels(scored, args.node_column, Path(args.label_map), args.label_key, args.label_column)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    scored.to_csv(output, index=False)
    cut_column = f"IsCutPoint{weights[0][0]}"
    cuts = ", ".join(scored.loc[scored[cut_column] == 1, args.node_column].astype(str)) or "(none)"
    print(f"network: {len(scored):,} nodes, cut point {cuts} -> {output}")
    return scored


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Score a report table before it enters Power BI.")
    sub = parser.add_subparsers(dest="command", required=True)
    network = sub.add_parser("network", help="Directed betweenness and cut points for an edge table.")
    network.add_argument("--edges", required=True, help="CSV of edges.")
    network.add_argument("--source", required=True, help="Column for the start of an edge.")
    network.add_argument("--target", required=True, help="Column for the end of an edge.")
    network.add_argument(
        "--weight",
        action="append",
        required=True,
        help="Name=Column or Name=Column*Column. Repeat for each weighting. The first names the sort and the cut-point printout.",
    )
    network.add_argument("--node-column", default="Node", help="Name of the node column in the score table.")
    network.add_argument("--label-map", help="Optional CSV of display names, joined onto the node.")
    network.add_argument("--label-key", default="State", help="Key column in the label map.")
    network.add_argument("--label-column", default="StateName", help="Display-name column in the label map and the score table.")
    network.add_argument("--output", required=True, help="Score CSV to write.")
    network.set_defaults(func=write_network)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])

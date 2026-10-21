"""The line on every figure that says what was counted.

The line names the caller's columns, the latest time in the table, and the
first eight characters of the fit hash. ``render`` writes the same line to
``figures.json`` so an argument page can show it under the chart. The hash is
the one in ``fit_hash.txt``.
"""

from __future__ import annotations

import json
import textwrap
from pathlib import Path

import numpy as np

from analytics_engine.fit import FitResult

HASH_PREFIX = 8


def follow_up(result: FitResult) -> float:
    """Latest time in the Kaplan–Meier table. That is the latest observed time."""

    times = result.tables["FactKm"]["Time"].to_numpy(dtype=float)
    finite = times[np.isfinite(times)]
    if finite.size == 0:
        raise ValueError("the fit has no follow-up times")
    return float(finite.max())


def format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.6g}"


def binding(result: FitResult) -> str:
    """Column contract, follow-up, and hash prefix. One line, shared by every figure."""

    outcome = result.outcome
    parts = [f"time = {outcome.time}", f"event = {outcome.event}"]
    if outcome.strata:
        parts.append(f"strata = {outcome.strata}")
    if outcome.covariates:
        parts.append("covariates = " + ", ".join(outcome.covariates))
    if outcome.horizon is not None:
        parts.append(f"horizon = {format_number(float(outcome.horizon))}")
    for column, level in outcome.reference.items():
        parts.append(f"reference {column} = {level}")
    parts.append(f"follow-up through {format_number(follow_up(result))}")
    parts.append(f"fit {result.content_hash[:HASH_PREFIX]}")
    return " · ".join(parts)


def caption(text: str, result: FitResult, width: int | None = None) -> str:
    """Method sentence, then the binding on its own line."""

    line = binding(result)
    if width is None:
        return text.rstrip() + "\n" + line
    filled = textwrap.fill(text, width=width, break_long_words=False, break_on_hyphens=False)
    bound = textwrap.fill(line, width=width, break_long_words=False, break_on_hyphens=False)
    return filled + "\n" + bound


def write_manifest(result: FitResult, directory: str | Path, written: dict[str, Path]) -> Path:
    """Write ``figures.json`` beside the pngs. The binding matches the figure footer."""

    payload = {
        "binding": binding(result),
        "hash": result.content_hash,
        "follow_up": follow_up(result),
        "figures": {name: item.name for name, item in written.items()},
    }
    target = Path(directory) / "figures.json"
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return target

"""Figures for the estimands in ``diagnostics``.

These are not summaries of the recorded time. The hazard is a kernel smooth of
the Nelson–Aalen increments. The nomogram, the calibration plot, the Cox–Snell
plot, and the decision curve are checks and readings of the Cox model. The
Aalen plot is the cumulative additive hazard. The restricted-mean contrast is
a difference of areas under the Kaplan–Meier curve, with an interval.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.figure import Figure

from analytics_engine.fit import FitResult
from analytics_engine.stamp import caption
from analytics_engine.style import INK, MUTED, PALETTE, RULE

FORM_NAMES = (
    "hazard",
    "cox-snell",
    "calibration",
    "aalen",
    "decision-curve",
    "nomogram",
    "rmst",
)

_DASH = (0, (3, 2))


def render_forms(result: FitResult, directory: Path) -> dict[str, Path]:
    specs: list[tuple[str, Figure | None]] = [
        ("hazard", _hazard(result) if not result.tables["FactHazard"].empty else None),
        ("cox-snell", _cox_snell(result) if not result.tables["FactCoxSnell"].empty else None),
        ("calibration", _calibration(result) if not result.tables["FactCalibration"].empty else None),
        ("aalen", _aalen(result) if not result.tables["FactAalen"].empty else None),
        ("decision-curve", _decision(result) if not result.tables["FactDecision"].empty else None),
        ("nomogram", _nomogram(result) if not result.tables["FactNomogram"].empty else None),
        ("rmst", _rmst(result)),
    ]
    written: dict[str, Path] = {}
    for name, figure in specs:
        if figure is None:
            continue
        target = directory / f"{name}.png"
        figure.savefig(target, dpi=140, bbox_inches="tight", pad_inches=0.28)
        plt.close(figure)
        written[name] = target
    return written


def _hazard(result: FitResult) -> Figure:
    table = result.tables["FactHazard"]
    bandwidth = float(table["Bandwidth"].iloc[0])
    strata = list(dict.fromkeys(table["Stratum"].astype(str)))
    cols = min(3, len(strata))
    rows = int(np.ceil(len(strata) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.6 * cols, 3.0 * rows + 1.8), squeeze=False, sharex=True, sharey=True)
    flat = list(axes.ravel())
    drawn: list[pd.DataFrame] = []
    for name in strata:
        part = _central(table[table["Stratum"].astype(str) == name])
        part = _finite_band(part, "Hazard")
        drawn.append(part)
    ceiling = max((float(np.nanmax(part["Hi"])) for part in drawn if not part.empty), default=1.0)
    for ax, name, part in zip(flat, strata, drawn, strict=False):
        color = PALETTE[strata.index(name) % len(PALETTE)]
        if not part.empty:
            ax.plot(part["Time"], part["Hazard"], color=color, lw=1.5)
            ax.fill_between(part["Time"], part["Lo"], part["Hi"], color=color, alpha=0.16, linewidth=0)
        ax.set_title(name, loc="left", fontsize=9)
        ax.set_xlabel("Time")
        ax.set_ylim(0, ceiling * 1.08)
        ax.yaxis.grid(True, color=RULE, lw=0.6)
        ax.set_axisbelow(True)
    flat[0].set_ylabel("Hazard")
    for ax in flat[len(strata) :]:
        ax.set_visible(False)
    _finish(
        fig,
        f"Kernel-smoothed hazard from the Nelson–Aalen estimator. Epanechnikov kernel, half-width {bandwidth:.2g}, the same width in every stratum. The band is the pointwise 95% interval. Drawn on the central 90 percent of follow-up in each stratum. A point is omitted when its upper band is more than three times that stratum's typical hazard, so one unstable tail does not set the scale. This is the instantaneous rate, not a survival probability.",
        result,
    )
    return fig


def _cox_snell(result: FitResult) -> Figure:
    table = _central(result.tables["FactCoxSnell"], "Residual").replace([np.inf, -np.inf], np.nan).dropna()
    fig, ax = _canvas(
        6.6,
        7.2,
        "Cox–Snell residual. The step is the Nelson–Aalen cumulative hazard of the residuals, and the band is its 95% interval. The dashed line is y = x. A Cox model that fits follows that line. The axis stops at the 95th percentile of the residual so the last jump does not set the scale.",
        result,
    )
    if not table.empty:
        ax.step(table["Residual"], table["Cumulative"], where="post", color=PALETTE[0], lw=1.6)
        ax.fill_between(table["Residual"], table["Lo"], table["Hi"], step="post", color=PALETTE[0], alpha=0.16, linewidth=0)
        limit = float(max(table["Residual"].max(), table["Cumulative"].max(), table["Hi"].max()))
        limit = max(limit, 1e-3)
        ax.plot([0, limit], [0, limit], color=INK, lw=0.8, ls=_DASH)
        ax.set_xlim(0, limit)
        ax.set_ylim(0, limit)
    ax.set_box_aspect(1)
    ax.set_xlabel("Cox–Snell residual")
    ax.set_ylabel("Cumulative hazard of the residual")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _calibration(result: FitResult) -> Figure:
    table = result.tables["FactCalibration"].sort_values("Predicted")
    when = float(table["Time"].iloc[0])
    fig, ax = _canvas(
        6.8,
        7.4,
        f"Calibration at time {when:.2g}. Each point is a quantile group of predicted risk"
        + (
            f", {int(table['N'].iloc[0])} rows in every group"
            if table["N"].nunique() == 1
            else ""
        )
        + ". Horizontal position is the mean Cox probability of the event by that time. Vertical position is one minus the Kaplan–Meier survival in that group, with the log-log band. The dashed line is perfect calibration.",
        result,
    )
    predicted = table["Predicted"].to_numpy(dtype=float)
    observed = table["Observed"].to_numpy(dtype=float)
    low = table["Lo"].to_numpy(dtype=float)
    high = table["Hi"].to_numpy(dtype=float)
    ax.errorbar(
        predicted,
        observed,
        yerr=[np.clip(observed - low, 0, None), np.clip(high - observed, 0, None)],
        fmt="o",
        color=PALETTE[0],
        ecolor=PALETTE[0],
        elinewidth=1.1,
        capsize=3,
        ms=6,
    )
    ax.plot([0, 1], [0, 1], color=INK, lw=0.8, ls=_DASH)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_box_aspect(1)
    ax.set_xlabel("Predicted risk of the event")
    ax.set_ylabel("Observed risk of the event")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _aalen(result: FitResult) -> Figure:
    table = result.tables["FactAalen"]
    terms = list(dict.fromkeys(table["Term"].astype(str)))
    cols = min(3, len(terms))
    rows = int(np.ceil(len(terms) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.5 * cols, 3.0 * rows + 1.8), squeeze=False)
    flat = list(axes.ravel())
    for ax, term in zip(flat, terms, strict=False):
        part = _central(table[table["Term"].astype(str) == term])
        part = part.replace([np.inf, -np.inf], np.nan).dropna(subset=["Cumulative"])
        color = PALETTE[0]
        if not part.empty:
            ax.step(part["Time"], part["Cumulative"], where="post", color=color, lw=1.4)
            band = part.dropna(subset=["Lo", "Hi"])
            if not band.empty:
                ax.fill_between(band["Time"], band["Lo"], band["Hi"], step="post", color=color, alpha=0.16, linewidth=0)
            finite = np.concatenate([part["Cumulative"].to_numpy(), band["Lo"].to_numpy(), band["Hi"].to_numpy()])
            finite = finite[np.isfinite(finite)]
            if finite.size:
                pad = 0.08 * (float(finite.max() - finite.min()) or 1.0)
                ax.set_ylim(min(0.0, float(finite.min())) - pad, max(0.0, float(finite.max())) + pad)
        ax.axhline(0, color=INK, lw=0.7, ls=_DASH)
        ax.set_title("baseline cumulative hazard" if term == "baseline" else term, loc="left", fontsize=8)
        ax.set_xlabel("Time")
        ax.yaxis.grid(True, color=RULE, lw=0.6)
        ax.set_axisbelow(True)
    flat[0].set_ylabel("Cumulative coefficient")
    for ax in flat[len(terms) :]:
        ax.set_visible(False)
    _finish(
        fig,
        "Aalen additive hazard. The step is the cumulative regression coefficient, and the band is the pointwise 95% interval. A flat stretch is a period that adds no hazard. The line at 0 is no effect. The baseline panel is the cumulative hazard when every covariate is at 0. Drawn on the central 90 percent of event time.",
        result,
    )
    return fig


def _decision(result: FitResult) -> Figure:
    table = result.tables["FactDecision"]
    when = float(table["Time"].iloc[0])
    fig, ax = _canvas(
        8.2,
        6.2,
        f"Decision curve at time {when:.2g}. Net benefit of acting when the Cox probability of the event by that time exceeds the threshold. True and false positives are Kaplan–Meier rates, so a censored row is not counted as a survivor or as an event. Treat all acts on the whole cohort. Treat none is the line at 0. Above both lines, the model has the higher net benefit.",
        result,
    )
    styles = {"Model": (PALETTE[0], "-"), "Treat all": (PALETTE[1], "-"), "Treat none": (INK, _DASH)}
    for name, (color, style) in styles.items():
        part = table[table["Strategy"] == name].sort_values("Threshold")
        ax.plot(part["Threshold"], part["NetBenefit"], color=color, lw=1.6, ls=style, label=name)
    ax.axhline(0, color=INK, lw=0.6)
    ax.set_xlabel("Threshold probability")
    ax.set_ylabel("Net benefit")
    ax.legend(frameon=False)
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _nomogram(result: FitResult) -> Figure:
    table = result.tables["FactNomogram"]
    axes_order = (
        table[["Axis", "Order"]]
        .drop_duplicates()
        .sort_values("Order", ascending=False)
    )
    names = list(axes_order["Axis"].astype(str))
    fig, ax = _canvas(
        8.8,
        max(5.4, 0.72 * len(names) + 2.8),
        "Cox nomogram. Each covariate axis is scaled so the term with the widest effect spans the full points ruler. Read a value across to the points axis, add the points, and read the sum on the total-points axis. Survival is the baseline survival, at the time named on that axis, raised to the partial hazard. A reversed covariate axis is a protective term.",
        result,
        wrap=96,
    )
    positions = {name: index for index, name in enumerate(names)}
    for name in names:
        y = positions[name]
        part = table[table["Axis"].astype(str) == name]
        left = 0.0 if name in {"Points", "Total points"} or name.startswith("Survival") else float(part["Points"].min())
        right = 100.0 if name in {"Points", "Total points"} or name.startswith("Survival") else float(part["Points"].max())
        ax.plot([left, right], [y, y], color=INK, lw=0.8, solid_capstyle="butt")
        for row in part.itertuples(index=False):
            ax.plot([row.Points, row.Points], [y - 0.12, y + 0.12], color=INK, lw=0.6)
            ax.text(row.Points, y + 0.18, str(row.Label), ha="center", va="bottom", fontsize=8, color=INK)
    ax.set_yticks([positions[name] for name in names], names)
    ax.set_xlim(-2, 104)
    ax.set_ylim(-0.45, len(names) - 0.35)
    ax.tick_params(axis="y", length=0)
    ax.set_xticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    _seal(fig)
    return fig


def _rmst(result: FitResult) -> Figure | None:
    summary = result.tables["StratumSummary"].dropna(subset=["Difference", "DiffLo", "DiffHi"])
    if summary.empty:
        return None
    summary = summary.sort_values("Difference")
    tau = float(summary["Tau"].iloc[0])
    reference = _reference_name(result)
    fig, ax = _canvas(
        8.4,
        max(4.2, 0.55 * len(summary) + 3.0),
        f"Difference in restricted mean time versus {reference}. Both areas stop at {tau:.2g}, the latest time at which every stratum still has at least a tenth of its rows at risk. The line at 0 is no difference. The interval uses the Greenwood variance of the area under the Kaplan–Meier curve. A negative difference is a shorter mean time without the event.",
        result,
        wrap=96,
    )
    y = np.arange(len(summary))
    difference = summary["Difference"].to_numpy(dtype=float)
    low = summary["DiffLo"].to_numpy(dtype=float)
    high = summary["DiffHi"].to_numpy(dtype=float)
    ax.errorbar(
        difference,
        y,
        xerr=[difference - low, high - difference],
        fmt="o",
        color=PALETTE[0],
        ecolor=PALETTE[0],
        elinewidth=1.2,
        capsize=3,
        ms=5,
    )
    ax.axvline(0, color=INK, lw=0.7, ls=_DASH)
    ax.set_yticks(y, summary["Stratum"].astype(str))
    span = float(np.nanmax(high) - np.nanmin(low))
    span = max(span, 1e-6)
    ax.set_xlim(min(float(np.nanmin(low)), 0.0) - span * 0.12, max(float(np.nanmax(high)), 0.0) + span * 0.08)
    for index, row in enumerate(summary.itertuples(index=False)):
        ax.text(
            1.02,
            index,
            f"{row.Difference:.2f}  ({row.DiffLo:.2f}–{row.DiffHi:.2f})",
            transform=ax.get_yaxis_transform(),
            va="center",
            ha="left",
            fontsize=8,
            color=MUTED,
            clip_on=False,
        )
    ax.set_xlabel("Difference in restricted mean time")
    ax.xaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig, right=0.72)
    return fig


def _reference_name(result: FitResult) -> str:
    summary = result.tables["StratumSummary"]
    named = summary.loc[summary["Difference"].isna(), "Stratum"]
    if len(named):
        return str(named.iloc[0])
    strata = result.outcome.strata
    if strata:
        return str(result.outcome.reference.get(strata, "the reference"))
    return "the reference"


def _central(table: pd.DataFrame, column: str = "Time") -> pd.DataFrame:
    if table.empty:
        return table
    low, high = np.quantile(table[column].to_numpy(dtype=float), [0.05, 0.95])
    return table[(table[column] >= low) & (table[column] <= high)].sort_values(column)


def _finite_band(table: pd.DataFrame, value: str) -> pd.DataFrame:
    part = table.replace([np.inf, -np.inf], np.nan).dropna(subset=[value, "Lo", "Hi"])
    if part.empty:
        return part
    typical = float(np.median(part.loc[part[value] > 0, value])) if (part[value] > 0).any() else 1.0
    return part[part["Hi"] <= max(typical * 3.0, 1e-6)]


def _canvas(
    width: float, height: float, text: str, result: FitResult, wrap: int = 88
) -> tuple[Figure, Axes]:
    fig = plt.figure(figsize=(width, height))
    ax = fig.add_subplot(111)
    fig._form_caption = caption(text, result, width=wrap)  # type: ignore[attr-defined]
    return fig, ax


def _seal(fig: Figure, right: float = 1.0) -> None:
    wrapped = fig._form_caption  # type: ignore[attr-defined]
    lines = wrapped.count("\n") + 1
    height = float(fig.get_size_inches()[1])
    bottom = min(0.58, max(0.16, (0.42 + 0.28 * lines) / height))
    fig.tight_layout(rect=(0, bottom, right, 1))
    fig.text(0.01, 0.015, wrapped, ha="left", va="bottom", fontsize=9, color=MUTED, linespacing=1.35)


def _finish(fig: Figure, text: str, result: FitResult) -> None:
    fig._form_caption = caption(text, result, width=96)  # type: ignore[attr-defined]
    _seal(fig)

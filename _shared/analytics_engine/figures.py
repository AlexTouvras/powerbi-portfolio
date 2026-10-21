"""Figure templates drawn from the fit tables and captioned from the fit."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.figure import Figure

from analytics_engine.cite import CitationError, cite, format_measure
from analytics_engine.fit import FitResult
from analytics_engine.forms import render_forms
from analytics_engine.gallery import render_gallery
from analytics_engine.stamp import caption, write_manifest
from analytics_engine.style import INK, MUTED, PALETTE, RULE


def render(result: FitResult, directory: str | Path) -> dict[str, Path]:
    """Write the figures the fit can support. A draft raises before any file is written.

    Each figure ends with the column binding. The same line is written to
    ``figures.json`` in ``directory``.
    """

    if not result.released:
        raise CitationError("a draft fit cannot be drawn; release it after approval")
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    km = _kaplan_meier(result)
    km_path = path / "kaplan-meier.png"
    km.savefig(km_path, dpi=140, bbox_inches="tight")
    plt.close(km)
    written["kaplan-meier"] = km_path
    if not result.tables["FactCox"].empty:
        forest = _forest(result)
        forest_path = path / "forest.png"
        forest.savefig(forest_path, dpi=140, bbox_inches="tight")
        plt.close(forest)
        written["forest"] = forest_path
        beta = _beta(result)
        beta_path = path / "beta-time.png"
        beta.savefig(beta_path, dpi=140, bbox_inches="tight")
        plt.close(beta)
        written["beta-time"] = beta_path
    written.update(render_gallery(result, path))
    written.update(render_forms(result, path))
    written["manifest"] = write_manifest(result, path, written)
    return written


def _kaplan_meier(result: FitResult) -> Figure:
    curve = result.tables["FactKm"]
    strata = list(dict.fromkeys(curve["Stratum"].astype(str)))
    fig = plt.figure(figsize=(8.4, 6.8))
    grid = fig.add_gridspec(2, 1, height_ratios=[5.0, 1.3], hspace=0.55)
    ax = fig.add_subplot(grid[0])
    table_ax = fig.add_subplot(grid[1], sharex=ax)
    tmax = float(np.quantile(curve["Time"], 0.98)) if len(curve) else 1.0
    ticks = np.linspace(0, max(tmax, 1e-9), 5)
    risk_rows = []
    for i, name in enumerate(strata):
        part = curve[curve["Stratum"].astype(str) == name].sort_values("Time")
        color = PALETTE[i % len(PALETTE)]
        ax.step(part["Time"], part["Survival"], where="post", color=color, lw=1.6, label=name)
        ax.fill_between(
            part["Time"],
            part["Lo"],
            part["Hi"],
            step="post",
            color=color,
            alpha=0.16,
            linewidth=0,
        )
        risk_rows.append([_at_risk(part, t) for t in ticks])
    ax.set_xlim(0, ticks[-1])
    ax.set_ylim(0, 1.02)
    ax.set_ylabel("Still without the event")
    ax.set_xlabel("Time")
    ax.legend(frameon=False, loc="best")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _risk_table(table_ax, strata, ticks, risk_rows)
    fig.text(0.01, 0.01, _km_caption(result), ha="left", va="bottom", fontsize=9, color=MUTED, wrap=True)
    fig.subplots_adjust(left=0.16, bottom=0.20)
    return fig


def _forest(result: FitResult) -> Figure:
    terms = result.tables["FactCox"].copy()
    terms = terms.replace([np.inf, -np.inf], np.nan).dropna(subset=["HazardRatio", "Lo", "Hi"])
    terms = terms[terms["HazardRatio"] > 0].sort_values("HazardRatio")
    footer = 1.85
    plot = max(2.3, 0.48 * max(len(terms), 1) + 0.6)
    height = plot + footer
    fig = plt.figure(figsize=(8.6, height))
    ax = fig.add_axes((0.18, footer / height, 0.78, plot / height * 0.96))
    y = np.arange(len(terms))
    ax.errorbar(
        terms["HazardRatio"],
        y,
        xerr=[terms["HazardRatio"] - terms["Lo"], terms["Hi"] - terms["HazardRatio"]],
        fmt="o",
        color=PALETTE[0],
        ecolor=PALETTE[0],
        elinewidth=1.2,
        capsize=3,
        ms=5,
    )
    ax.axvline(1, color=INK, lw=0.7, ls=(0, (3, 2)))
    ax.set_yticks(y, terms["Term"].astype(str))
    ax.set_xscale("log")
    ax.set_xlabel("Hazard ratio")
    ax.xaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    for i, row in enumerate(terms.itertuples(index=False)):
        ax.text(
            row.Hi * 1.08,
            i,
            f"{row.HazardRatio:.2f}  ({row.Lo:.2f}–{row.Hi:.2f})",
            va="center",
            ha="left",
            fontsize=8,
            color=MUTED,
        )
    lo = float(terms["Lo"].min()) if len(terms) else 0.5
    hi = float(terms["Hi"].max()) if len(terms) else 2
    ax.set_xlim(min(lo, 1.0) / 1.7, max(hi, 1.0) * 4.0)
    fig.text(0.02, 0.03, _forest_caption(result), ha="left", va="bottom", fontsize=9, color=MUTED, wrap=True)
    return fig


def _beta(result: FitResult) -> Figure:
    beta = result.tables["FactBetaT"]
    ph = result.tables["FactPh"].set_index("Term")
    terms = list(dict.fromkeys(beta["Term"].astype(str)))
    cols = min(4, max(1, len(terms)))
    rows = int(np.ceil(len(terms) / cols))
    footer = 1.7
    plot = 3.15 * rows
    fig, axes = plt.subplots(rows, cols, figsize=(3.5 * cols, plot + footer), squeeze=False)
    flat: list[Axes] = list(axes.ravel())
    for ax, term in zip(flat, terms, strict=False):
        part = beta[beta["Term"].astype(str) == term]
        points = part[part["Kind"] == "residual"]
        smooth = part[part["Kind"] == "smooth"].sort_values("Time")
        plotted = points["Beta"] + points["Residual"]
        ax.scatter(points["Time"], plotted, s=10, color=PALETTE[0], alpha=0.35, linewidths=0)
        if not smooth.empty:
            ax.plot(smooth["Time"], smooth["Beta"], color=PALETTE[0], lw=1.4)
            ax.fill_between(smooth["Time"], smooth["Lo"], smooth["Hi"], color=PALETTE[0], alpha=0.15, linewidth=0)
        coef = float(points["Beta"].iloc[0]) if not points.empty else np.nan
        if np.isfinite(coef):
            ax.axhline(coef, color=INK, lw=0.7, ls=(0, (3, 2)))
        ax.set_xscale("log")
        ax.set_xlabel("Time")
        ax.set_ylabel("Beta(t)")
        p_value = float(ph.loc[term, "P"]) if term in ph.index else np.nan
        verdict = str(ph.loc[term, "Verdict"]) if term in ph.index else ""
        if verdict == "changes":
            title = f"the effect of {term} changes over time"
        else:
            title = f"no sign that the effect of {term} changes over time"
        if np.isfinite(p_value):
            title = f"{title}\n(p = {format_measure('LogRankP', p_value)})"
        ax.set_title(title, fontsize=8, loc="left", color=INK)
    for ax in flat[len(terms) :]:
        ax.set_visible(False)
    fig.subplots_adjust(
        left=0.08,
        right=0.98,
        top=0.88,
        bottom=footer / (plot + footer),
        hspace=0.55,
        wspace=0.32,
    )
    fig.text(
        0.01,
        0.01,
        caption(
            "Proportional hazards (Grambsch–Therneau), Kaplan–Meier time transform. "
            "Dashed line: the Cox coefficient. Band: pointwise 95% interval of a cubic smooth on log time.",
            result,
        ),
        ha="left",
        va="bottom",
        fontsize=9,
        color=MUTED,
        wrap=True,
    )
    return fig


def _risk_table(ax: Axes, strata: list[str], ticks: np.ndarray, rows: list[list[int]]) -> None:
    ax.set_ylim(len(strata) - 0.4, -0.8)
    ax.set_yticks([])
    ax.tick_params(axis="x", labelbottom=False, length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    label = ax.get_yaxis_transform()
    ax.text(-0.06, -0.55, "At risk", fontsize=8, color=MUTED, ha="right", va="center", transform=label, clip_on=False)
    for r, (name, counts) in enumerate(zip(strata, rows, strict=True)):
        color = PALETTE[r % len(PALETTE)]
        ax.text(-0.06, r, name, fontsize=8, color=color, ha="right", va="center", transform=label, clip_on=False)
        for i, (tick, count) in enumerate(zip(ticks, counts, strict=True)):
            ax.text(tick, r, str(count), fontsize=8, color=INK, ha="left" if i == 0 else "center", va="center")


def _at_risk(part: pd.DataFrame, time: float) -> int:
    eligible = part[part["Time"] <= time]
    if eligible.empty:
        return int(part["NRisk"].iloc[0]) if len(part) else 0
    return int(eligible["NRisk"].iloc[-1])


def _km_caption(result: FitResult) -> str:
    text = cite("Kaplan–Meier, log-log 95% bands. N = {N}. Events = {Events}.", result)
    if "LogRankP" in result.measures:
        text += " " + cite("Log-rank p = {LogRankP}.", result)
    return caption(text, result)


def _forest_caption(result: FitResult) -> str:
    text = cite(
        "Cox model, Efron ties. Hazard ratios with 95% intervals; the line at 1 is no association. Concordance {Concordance}.",
        result,
    )
    if "ExpectedExits" in result.measures:
        text += " " + cite(
            "Of the {NAtRisk} still at risk, about {ExpectedExits} are expected to have the event within {Horizon}.",
            result,
        )
    return caption(text, result)

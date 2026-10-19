"""The rest of the publication set that sits beside Kaplan–Meier, the forest, and β(t).

The shapes follow the survminer gallery: ``ggsurvplot(fun="cumhaz")``,
``ggsurvplot(fun="event")``, the complementary log-log plot, ``ggcoxdiagnostics``
for martingale and deviance residuals, dfbeta influence, ``ggadjustedcurves``,
and the reverse Kaplan–Meier of the censoring time.
"""

from __future__ import annotations

from pathlib import Path

import textwrap

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.figure import Figure
from statsmodels.nonparametric.smoothers_lowess import lowess

from analytics_engine.cite import cite
from analytics_engine.fit import FitResult
from analytics_engine.style import INK, MUTED, PALETTE, RULE

_DASH = (0, (3, 2))
# Same floor as the complementary log-log plot. Below it, −log(S) is the last
# jump to zero, which draws as a vertical spike rather than a cumulative hazard.
_SURVIVAL_FLOOR = 0.02


def render_gallery(result: FitResult, directory: Path) -> dict[str, Path]:
    written: dict[str, Path] = {}
    specs: list[tuple[str, Figure | None]] = [
        ("cumulative-hazard", _cumulative_hazard(result)),
        ("cumulative-events", _cumulative_events(result)),
        ("log-cumulative-hazard", _log_cumulative_hazard(result)),
        ("censoring", _censoring(result) if not result.tables["FactCensor"].empty else None),
        ("martingale", _martingale(result) if not result.tables["FactResidual"].empty else None),
        ("deviance", _deviance(result) if not result.tables["FactResidual"].empty else None),
        ("influence", _influence(result) if not result.tables["FactInfluence"].empty else None),
        ("adjusted-survival", _adjusted(result) if not result.tables["FactAdjusted"].empty else None),
    ]
    for name, figure in specs:
        if figure is None:
            continue
        target = directory / f"{name}.png"
        figure.savefig(target, dpi=140, bbox_inches="tight", pad_inches=0.35)
        plt.close(figure)
        written[name] = target
    return written


def cumulative_hazard_frame(curve: pd.DataFrame) -> pd.DataFrame:
    """−log of the Kaplan–Meier estimate, stopped at the survival floor.

    The last step of a stratum often lands on survival 0. Logging that step
    sends the curve to infinity. Rows below the floor are omitted. The upper
    band is left blank wherever the lower survival limit is below the floor,
    so a confidence limit of 0 is not drawn as a spike. The survival band
    swaps when it is logged.
    """

    kept = curve.loc[curve["Survival"] >= _SURVIVAL_FLOOR].copy()
    survival = np.clip(kept["Survival"].to_numpy(dtype=float), _SURVIVAL_FLOOR, 1.0)
    lower = kept["Lo"].to_numpy(dtype=float)
    upper = np.clip(kept["Hi"].to_numpy(dtype=float), 1e-12, 1.0)
    out = kept[["Stratum", "Time"]].copy()
    out["Hazard"] = -np.log(survival)
    out["Lo"] = -np.log(upper)
    hi = np.full(len(kept), np.nan)
    ok = np.isfinite(lower) & (lower >= _SURVIVAL_FLOOR)
    hi[ok] = -np.log(np.clip(lower[ok], _SURVIVAL_FLOOR, 1.0))
    out["Hi"] = hi
    return out


def _cumulative_hazard(result: FitResult) -> Figure:
    hazard = cumulative_hazard_frame(result.tables["FactKm"])
    fig, ax = _panel()
    _step_bands(ax, hazard, "Hazard", "Lo", "Hi", "Cumulative hazard", legend="upper left")
    ax.set_xlabel("Time")
    _foot(
        fig,
        "Cumulative hazard, minus the log of the Kaplan–Meier estimate, drawn while survival stays at or above 0.02. The band is the log-log survival band, transformed, and it stops at the same floor. One event type.",
    )
    return fig


def _cumulative_events(result: FitResult) -> Figure:
    curve = result.tables["FactKm"].copy()
    curve["Events"] = 1.0 - curve["Survival"]
    curve["BandLo"] = 1.0 - curve["Hi"]
    curve["BandHi"] = 1.0 - curve["Lo"]
    fig, ax = _panel()
    _step_bands(ax, curve, "Events", "BandLo", "BandHi", "Share who have had the event")
    ax.set_ylim(0, 1.02)
    ax.set_xlabel("Time")
    _foot(
        fig,
        "One minus the Kaplan–Meier estimate. With a single event type this is the cumulative incidence. It is not a competing-risk estimator.",
    )
    return fig


def _log_cumulative_hazard(result: FitResult) -> Figure:
    fig, ax = _panel()
    curve = result.tables["FactKm"]
    strata = list(dict.fromkeys(curve["Stratum"].astype(str)))
    drawn = False
    for i, name in enumerate(strata):
        part = curve[curve["Stratum"].astype(str) == name]
        mask = (part["Time"] > 0) & (part["Survival"] > 0.02) & (part["Survival"] < 0.98)
        part = part.loc[mask]
        if part.empty:
            continue
        drawn = True
        y = np.log(-np.log(part["Survival"].to_numpy(dtype=float)))
        ax.step(part["Time"], y, where="post", color=PALETTE[i % len(PALETTE)], lw=1.5, label=name)
    if drawn:
        ax.set_xscale("log")
        ax.legend(frameon=False)
    ax.set_xlabel("Time")
    ax.set_ylabel("log(−log survival)")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _foot(fig, "Complementary log-log of the Kaplan–Meier estimate. Proportional hazards look like parallel curves.")
    return fig


def _censoring(result: FitResult) -> Figure:
    fig, ax = _panel()
    _step_bands(ax, result.tables["FactCensor"], "Survival", "Lo", "Hi", "Still under follow-up")
    ax.set_ylim(0, 1.02)
    ax.set_xlabel("Time")
    text = cite("Reverse Kaplan–Meier of the censoring time. N = {N}. A drop is follow-up ending, not the event.", result)
    _foot(fig, text)
    return fig


def _martingale(result: FitResult) -> Figure:
    return _residual_plot(
        result,
        "Martingale",
        "Martingale residual",
        "Martingale residuals against the linear predictor. A bend means a covariate's shape is wrong. The line at 0 is a residual with nothing left to explain.",
    )


def _deviance(result: FitResult) -> Figure:
    return _residual_plot(
        result,
        "Deviance",
        "Deviance residual",
        "Deviance residuals. Filled points had the event. Open points were censored. A large negative point is a censored row the model expected to fail.",
    )


def _residual_plot(result: FitResult, column: str, ylabel: str, caption: str) -> Figure:
    residual = result.tables["FactResidual"].dropna(subset=["LinearPredictor", column])
    fig, ax = _panel()
    events = residual[residual["Event"] == 1]
    censored = residual[residual["Event"] == 0]
    ax.scatter(events["LinearPredictor"], events[column], s=14, color=PALETTE[0], alpha=0.45, linewidths=0, label="Event", zorder=2)
    ax.scatter(
        censored["LinearPredictor"],
        censored[column],
        s=16,
        facecolors="none",
        edgecolors=PALETTE[1],
        linewidths=0.8,
        label="Censored",
        zorder=2,
    )
    _lowess(ax, residual["LinearPredictor"].to_numpy(dtype=float), residual[column].to_numpy(dtype=float))
    ax.axhline(0, color=INK, lw=0.7, ls=_DASH, zorder=1)
    ax.set_xlabel("Linear predictor")
    ax.set_ylabel(ylabel)
    ax.legend(frameon=False)
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _foot(fig, caption)
    return fig


def _influence(result: FitResult) -> Figure:
    influence = result.tables["FactInfluence"].replace([np.inf, -np.inf], np.nan).dropna()
    terms = list(dict.fromkeys(influence["Term"].astype(str)))
    cols = min(3, max(1, len(terms)))
    rows = int(np.ceil(len(terms) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.6 * cols, 3.0 * rows), squeeze=False)
    flat = list(axes.ravel())
    for ax, term in zip(flat, terms, strict=False):
        part = influence[influence["Term"].astype(str) == term]
        ax.scatter(part["Time"], part["DeltaBeta"], s=12, color=PALETTE[0], alpha=0.4, linewidths=0)
        ax.axhline(0, color=INK, lw=0.7, ls=_DASH)
        ax.set_title(term, fontsize=9, loc="left")
        ax.set_xlabel("Time")
        ax.set_ylabel("dfbeta")
    for ax in flat[len(terms) :]:
        ax.set_visible(False)
    caption = textwrap.fill(
        "Approximate change in each coefficient when that row is omitted. A point far from the line at 0 is an influential row.",
        width=max(42, 32 * cols),
    )
    lines = caption.count("\n") + 1
    fig.tight_layout(rect=(0, 0.06 + 0.045 * lines, 1, 1))
    fig.text(0.01, 0.02, caption, ha="left", va="bottom", fontsize=9, color=MUTED)
    return fig


def _adjusted(result: FitResult) -> Figure:
    fig, ax = _panel()
    curves = result.tables["FactAdjusted"]
    profiles = list(dict.fromkeys(curves["Profile"].astype(str)))
    for i, name in enumerate(profiles):
        part = curves[curves["Profile"].astype(str) == name].sort_values("Time")
        ax.step(part["Time"], part["Survival"], where="post", color=PALETTE[i % len(PALETTE)], lw=1.6, label=name)
    ax.set_ylim(0, 1.02)
    ax.set_xlabel("Time")
    ax.set_ylabel("Predicted survival")
    ax.legend(frameon=False, title="Profile")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _foot(
        fig,
        "Cox predicted survival. Each line is one stratum at the reference level of the other categories, numeric covariates at their mean. These are the model's curves.",
    )
    return fig


def _step_bands(
    ax: Axes,
    curve: pd.DataFrame,
    value: str,
    lower: str,
    upper: str,
    ylabel: str,
    legend: str = "best",
) -> None:
    strata = list(dict.fromkeys(curve["Stratum"].astype(str)))
    for i, name in enumerate(strata):
        part = curve[curve["Stratum"].astype(str) == name].sort_values("Time")
        color = PALETTE[i % len(PALETTE)]
        ax.step(part["Time"], part[value], where="post", color=color, lw=1.6, label=name)
        ax.fill_between(part["Time"], part[lower], part[upper], step="post", color=color, alpha=0.16, linewidth=0)
    ax.set_ylabel(ylabel)
    ax.legend(frameon=False, loc=legend)
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)


def _lowess(ax: Axes, x: np.ndarray, y: np.ndarray) -> None:
    mask = np.isfinite(x) & np.isfinite(y)
    if mask.sum() < 12 or np.unique(x[mask]).size < 4:
        return
    smooth = lowess(y[mask], x[mask], frac=0.4, return_sorted=True)
    ax.plot(smooth[:, 0], smooth[:, 1], color=INK, lw=1.5, zorder=3, label="Smooth")


def _panel() -> tuple[Figure, Axes]:
    fig = plt.figure(figsize=(8.2, 5.4))
    ax = fig.add_axes((0.10, 0.22, 0.84, 0.70))
    return fig, ax


def _foot(fig: Figure, text: str) -> None:
    fig.text(0.10, 0.04, text, ha="left", va="bottom", fontsize=9, color=MUTED, wrap=True)

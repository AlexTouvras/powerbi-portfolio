"""Chart forms that are not step curves or residual scatters.

The geometries follow the Financial Times visual vocabulary — XY heatmap,
histogram, violin, barcode, Priestley timeline, proportional stacked bar,
column, lollipop, dot plot, diverging bar — plus the clinical swimmer plot
and a hexbin for a residual cloud that would overplot as a scatter.
Each one is a display of a table the fit already wrote. None of them is a
new estimator.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.figure import Figure
from matplotlib.patches import Rectangle
from scipy.stats import gaussian_kde

from analytics_engine.fit import FitResult
from analytics_engine.style import INK, MUTED, PALETTE, RULE

FORM_NAMES = (
    "risk-heatmap",
    "histogram",
    "raincloud",
    "barcode",
    "swimmer",
    "composition",
    "event-columns",
    "restricted-mean",
    "landmark-dots",
    "residual-hexbin",
    "influence-bars",
)

_SWIMMER_CAP = 12
_RAIN_CAP = 80
_INFLUENCE_CAP = 12
_HEAT = LinearSegmentedColormap.from_list("board-teal", ["#E6EEF2", "#2F5F73"])
_DASH = (0, (3, 2))


def render_forms(result: FitResult, directory: Path) -> dict[str, Path]:
    followup = result.tables["FactFollowup"]
    influence = result.tables["FactInfluence"]
    residual = result.tables["FactResidual"]
    specs: list[tuple[str, Figure | None]] = [
        ("risk-heatmap", _risk_heatmap(result)),
        ("histogram", _histogram(result) if not followup.empty else None),
        ("raincloud", _raincloud(result) if not followup.empty else None),
        ("barcode", _barcode(result) if not followup.empty else None),
        ("swimmer", _swimmer(result) if not followup.empty else None),
        ("composition", _composition(result) if not result.tables["StratumSummary"].empty else None),
        ("event-columns", _event_columns(result)),
        ("restricted-mean", _restricted_mean(result)),
        ("landmark-dots", _landmark(result) if not followup.empty else None),
        ("residual-hexbin", _hexbin(result) if _hexbin_ready(residual) else None),
        ("influence-bars", _influence_bars(result) if not influence.empty else None),
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


def risk_grid(curve: pd.DataFrame, times: np.ndarray) -> pd.DataFrame:
    """Number at risk for each stratum at each display time, read off the Kaplan–Meier step."""

    rows: list[dict[str, float | str]] = []
    for name in _strata(curve):
        part = curve[curve["Stratum"].astype(str) == name].sort_values("Time")
        for observed in times:
            rows.append({"Stratum": name, "Time": float(observed), "NRisk": _step_value(part, float(observed), "NRisk")})
    return pd.DataFrame(rows)


def event_bin_counts(curve: pd.DataFrame, edges: np.ndarray) -> pd.DataFrame:
    """Events from the Kaplan–Meier table, summed inside each time bin."""

    rows: list[dict[str, float | str]] = []
    cuts = edges[1:-1]
    for name in _strata(curve):
        part = curve[curve["Stratum"].astype(str) == name]
        times = part["Time"].to_numpy(dtype=float)
        counts = part["NEvent"].to_numpy(dtype=float)
        inside = (times >= edges[0]) & (times <= edges[-1])
        bins = np.digitize(times[inside], cuts, right=True)
        counts = counts[inside]
        for index in range(len(edges) - 1):
            rows.append(
                {
                    "Stratum": name,
                    "Left": float(edges[index]),
                    "Right": float(edges[index + 1]),
                    "Events": float(counts[bins == index].sum()),
                }
            )
    return pd.DataFrame(rows)


def composition_frame(summary: pd.DataFrame) -> pd.DataFrame:
    """Width is the stratum's share of the cohort. The split is event against censoring."""

    out = summary.copy()
    out["Censored"] = out["N"] - out["Events"]
    total = float(out["N"].sum())
    out["Width"] = out["N"] / total if total else 0.0
    out["EventShare"] = np.where(out["N"] > 0, out["Events"] / out["N"], np.nan)
    return out


def landmark_frame(curve: pd.DataFrame, times: tuple[float, float]) -> pd.DataFrame:
    """Kaplan–Meier survival at two times. The value is the last step at or before that time."""

    rows: list[dict[str, float | str]] = []
    for name in _strata(curve):
        part = curve[curve["Stratum"].astype(str) == name].sort_values("Time")
        for observed in times:
            rows.append(
                {
                    "Stratum": name,
                    "Time": float(observed),
                    "Survival": _step_value(part, float(observed), "Survival"),
                    "Lo": _step_value(part, float(observed), "Lo"),
                    "Hi": _step_value(part, float(observed), "Hi"),
                }
            )
    return pd.DataFrame(rows)


def _risk_heatmap(result: FitResult) -> Figure:
    curve = result.tables["FactKm"]
    times = _time_grid(curve, 8)
    grid = risk_grid(curve, times)
    strata = _strata(grid)
    values = np.vstack(
        [grid.loc[grid["Stratum"] == name, "NRisk"].to_numpy(dtype=float) for name in strata]
    )
    fig, ax = _canvas(
        8.4,
        max(3.8, 0.55 * len(strata) + 2.6),
        "Number still at risk, the same count as the Kaplan–Meier risk table, at eight times spread across follow-up. Color repeats the count. It is not a hazard.",
    )
    image = ax.imshow(values, aspect="auto", cmap=_HEAT, vmin=0, vmax=max(float(values.max()), 1))
    ax.set_xticks(range(len(times)), [f"{t:.2g}" for t in times])
    ax.set_yticks(range(len(strata)), strata)
    ax.set_xlabel("Time")
    threshold = float(values.max()) * 0.62
    for row in range(values.shape[0]):
        for col in range(values.shape[1]):
            count = values[row, col]
            ax.text(
                col,
                row,
                f"{int(round(count))}",
                ha="center",
                va="center",
                fontsize=8,
                color="white" if count >= threshold else INK,
            )
    cbar = fig.colorbar(image, ax=ax, fraction=0.046, pad=0.03)
    cbar.set_label("At risk")
    cbar.outline.set_linewidth(0.4)
    _seal(fig)
    return fig


def _histogram(result: FitResult) -> Figure:
    followup = result.tables["FactFollowup"]
    strata = _strata(followup)
    edges = _bin_edges(followup["Time"].to_numpy(dtype=float), 10)
    width = float(edges[1] - edges[0]) * 0.92
    centers = (edges[:-1] + edges[1:]) / 2
    cols = min(3, len(strata))
    rows = int(np.ceil(len(strata) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.5 * cols, 2.7 * rows + 0.9), squeeze=False, sharex=True, sharey=True)
    flat = list(axes.ravel())
    ceiling = 1
    for ax, name in zip(flat, strata, strict=False):
        part = followup[followup["Stratum"].astype(str) == name]
        times = part["Time"].to_numpy(dtype=float)
        events = times[part["Event"].to_numpy(dtype=float) == 1]
        censored = times[part["Event"].to_numpy(dtype=float) == 0]
        event_counts, _ = np.histogram(events, bins=edges)
        censor_counts, _ = np.histogram(censored, bins=edges)
        ceiling = max(ceiling, int((event_counts + censor_counts).max()))
        ax.bar(centers, event_counts, width=width, color=PALETTE[0], label="Event")
        ax.bar(centers, censor_counts, width=width, bottom=event_counts, color=PALETTE[1], label="Censored")
        ax.set_title(name, loc="left", fontsize=9)
        ax.set_xlabel("Follow-up time")
        ax.set_ylabel("Rows")
        ax.set_axisbelow(True)
        ax.yaxis.grid(True, color=RULE, lw=0.6)
    for ax in flat[len(strata) :]:
        ax.set_visible(False)
    for ax in flat[: len(strata)]:
        ax.set_ylim(0, ceiling * 1.08)
    _finish_grid(
        fig,
        "Histogram of follow-up time. The lower segment had the event. The upper segment was censored. Column height is a count of rows, not a hazard. The panels share one vertical scale.",
    )
    return fig


def _raincloud(result: FitResult) -> Figure:
    followup = result.tables["FactFollowup"]
    strata = _strata(followup)
    fig, ax = _canvas(
        8.4,
        max(4.6, 1.7 * len(strata) + 1.8),
        "Follow-up time by stratum. The violin is the density of every row. The box is the median and the quartiles. Filled points had the event and open points were censored. When a stratum has more than 80 rows, the points are a sample of 80. The axis stops at the 98th percentile of follow-up time so a few very long rows do not set the scale.",
        wrap=92,
    )
    rng = np.random.default_rng(0)
    spacing = 1.35
    for index, name in enumerate(strata):
        part = followup[followup["Stratum"].astype(str) == name]
        y = (len(strata) - 1 - index) * spacing
        color = PALETTE[index % len(PALETTE)]
        values = part["Time"].to_numpy(dtype=float)
        _half_violin(ax, values, y + 0.08, color)
        ax.boxplot(
            values,
            orientation="horizontal",
            positions=[y],
            widths=0.16,
            manage_ticks=False,
            patch_artist=True,
            showfliers=False,
            boxprops={"facecolor": "white", "edgecolor": color, "linewidth": 0.8},
            medianprops={"color": INK, "linewidth": 1.2},
            whiskerprops={"color": color, "linewidth": 0.8},
            capprops={"color": color, "linewidth": 0.8},
        )
        take = min(_RAIN_CAP, len(part))
        chosen = rng.choice(len(part), size=take, replace=False)
        sample = part.iloc[chosen]
        jitter = rng.uniform(-0.28, -0.08, size=take)
        times = sample["Time"].to_numpy(dtype=float)
        events = sample["Event"].to_numpy(dtype=float) == 1
        ax.scatter(times[events], y + jitter[events], s=12, color=color, alpha=0.55, linewidths=0, zorder=3)
        ax.scatter(
            times[~events],
            y + jitter[~events],
            s=14,
            facecolors="none",
            edgecolors=color,
            linewidths=0.7,
            alpha=0.8,
            zorder=3,
        )
    ax.set_yticks([(len(strata) - 1 - i) * spacing for i in range(len(strata))], strata)
    ax.set_ylim(-0.55, (len(strata) - 1) * spacing + 0.55)
    ax.set_xlabel("Follow-up time")
    high = float(np.quantile(followup["Time"].to_numpy(dtype=float), 0.98))
    ax.set_xlim(0, max(high, 1e-6) * 1.04)
    _seal(fig)
    return fig


def _barcode(result: FitResult) -> Figure:
    followup = result.tables["FactFollowup"]
    strata = _strata(followup)
    fig, ax = _canvas(
        8.4,
        max(3.6, 0.85 * len(strata) + 2.2),
        "Every row is a tick, so this is the whole cohort. Teal ticks had the event. Copper ticks were censored. A dark band is many rows ending at that time.",
    )
    for index, name in enumerate(strata):
        part = followup[followup["Stratum"].astype(str) == name]
        y = len(strata) - 1 - index
        events = part.loc[part["Event"] == 1, "Time"].to_numpy(dtype=float)
        censored = part.loc[part["Event"] == 0, "Time"].to_numpy(dtype=float)
        ax.vlines(censored, y - 0.34, y + 0.34, color=PALETTE[1], lw=0.45, alpha=0.45)
        ax.vlines(events, y - 0.34, y + 0.34, color=PALETTE[0], lw=0.45, alpha=0.7)
    ax.set_yticks(range(len(strata)), strata[::-1])
    ax.set_ylim(-0.6, len(strata) - 0.4)
    ax.set_xlim(left=0)
    ax.set_xlabel("Follow-up time")
    _seal(fig)
    return fig


def _swimmer(result: FitResult) -> Figure:
    followup = result.tables["FactFollowup"]
    strata = _strata(followup)
    lanes = sum(min(_SWIMMER_CAP, int((followup["Stratum"].astype(str) == name).sum())) for name in strata)
    fig, ax = _canvas(
        8.6,
        max(4.8, 0.32 * lanes + 0.45 * len(strata) + 1.8),
        f"Each bar is one row's follow-up, a Priestley timeline of the kind a swimmer plot uses. Filled square: the event. Open circle: censored. At most {_SWIMMER_CAP} rows per stratum, the longest follow-ups, so a larger cohort is not all shown here. The barcode shows every row.",
        wrap=96,
    )
    y = 0
    centers: list[float] = []
    for index, name in enumerate(strata):
        part = followup[followup["Stratum"].astype(str) == name].nlargest(_SWIMMER_CAP, "Time")
        color = PALETTE[index % len(PALETTE)]
        start = y
        for row in part.itertuples(index=False):
            ax.barh(y, row.Time, height=0.62, color=color, alpha=0.88)
            event = float(row.Event) == 1
            ax.plot(
                row.Time,
                y,
                marker="s" if event else "o",
                markersize=5.5,
                markerfacecolor=color if event else "white",
                markeredgecolor=color,
                markeredgewidth=0.9,
                linestyle="none",
                zorder=3,
            )
            y += 1
        if y > start:
            centers.append((start + y - 1) / 2)
        y += 0.7
    ax.set_yticks(centers, strata)
    ax.set_ylim(y - 0.4, -0.8)
    ax.set_xlim(left=0)
    ax.set_xlabel("Follow-up time")
    _seal(fig)
    return fig


def _composition(result: FitResult) -> Figure:
    frame = composition_frame(result.tables["StratumSummary"])
    fig, ax = _canvas(
        8.4,
        5.2,
        "Proportional stacked bar. The width of a column is that stratum's share of the cohort. The split is rows that had the event against rows that were censored. Area is a count of rows. This is the cohort composition, not a survival estimate.",
        wrap=90,
    )
    x = 0.0
    centers: list[float] = []
    labels: list[str] = []
    for index, row in enumerate(frame.itertuples(index=False)):
        width = float(row.Width)
        event_share = float(row.EventShare)
        ax.add_patch(Rectangle((x, 0), width, event_share, facecolor=PALETTE[0], edgecolor="white", linewidth=0.6))
        ax.add_patch(
            Rectangle((x, event_share), width, 1 - event_share, facecolor=PALETTE[1], edgecolor="white", linewidth=0.6)
        )
        if event_share > 0.14 and width > 0.08:
            ax.text(x + width / 2, event_share / 2, f"{int(row.Events)} event", ha="center", va="center", color="white", fontsize=8)
        if (1 - event_share) > 0.14 and width > 0.08:
            ax.text(
                x + width / 2,
                event_share + (1 - event_share) / 2,
                f"{int(row.Censored)} censored",
                ha="center",
                va="center",
                color="white",
                fontsize=8,
            )
        centers.append(x + width / 2)
        labels.append(str(row.Stratum))
        x += width
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks(centers, labels)
    ax.set_ylabel("Share of the stratum")
    ax.set_xlabel("Share of the cohort")
    _seal(fig)
    return fig


def _event_columns(result: FitResult) -> Figure:
    curve = result.tables["FactKm"]
    edges = _bin_edges(curve["Time"].to_numpy(dtype=float), 6)
    counts = event_bin_counts(curve, edges)
    strata = _strata(counts)
    fig, ax = _canvas(
        8.4,
        5.0,
        "Events in each time bin up to the 98th percentile of observed time, summed from the Kaplan–Meier event table. Later events are left out. Column height is a count of events. It is not a hazard and it is not a survival probability.",
    )
    positions = np.arange(len(edges) - 1)
    width = 0.8 / max(len(strata), 1)
    for index, name in enumerate(strata):
        part = counts[counts["Stratum"] == name]
        offset = (index - (len(strata) - 1) / 2) * width
        ax.bar(
            positions + offset,
            part["Events"].to_numpy(dtype=float),
            width=width * 0.92,
            color=PALETTE[index % len(PALETTE)],
            label=name,
        )
    labels = [f"{left:.2g}–{right:.2g}" for left, right in zip(edges[:-1], edges[1:], strict=True)]
    ax.set_xticks(positions, labels)
    ax.set_ylabel("Events")
    ax.set_xlabel("Time")
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False, ncol=min(len(strata), 4), loc="upper right")
    ax.yaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _restricted_mean(result: FitResult) -> Figure | None:
    summary = result.tables["StratumSummary"].replace([np.inf, -np.inf], np.nan).dropna(subset=["RestrictedMean"]).copy()
    if summary.empty:
        return None
    summary = summary.sort_values(["RestrictedMean", "Stratum"], ascending=[False, True])
    values = summary["RestrictedMean"].to_numpy(dtype=float)
    span = float(values.max()) if len(values) else 1.0
    if not np.isfinite(span) or span <= 0:
        return None
    fig, ax = _canvas(
        8.2,
        max(3.6, 0.55 * len(summary) + 2.2),
        "Restricted mean time without the event, the area under the Kaplan–Meier curve up to the last observed time. Ordered lollipop. The axis starts at zero because the length is a magnitude.",
    )
    y = np.arange(len(summary))[::-1]
    ax.hlines(y, 0, values, color=PALETTE[0], lw=1.4)
    ax.scatter(values, y, s=36, color=PALETTE[0], zorder=3)
    for y_pos, value in zip(y, values, strict=True):
        ax.text(value + span * 0.02, y_pos, f"{value:.2f}", va="center", ha="left", fontsize=8, color=MUTED)
    ax.set_yticks(y, summary["Stratum"].astype(str))
    ax.set_xlim(0, span * 1.32)
    ax.set_xlabel("Restricted mean time")
    ax.xaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _landmark(result: FitResult) -> Figure | None:
    followup = result.tables["FactFollowup"]
    times = np.quantile(followup["Time"].to_numpy(dtype=float), [0.25, 0.75])
    early, late = float(times[0]), float(times[1])
    if not np.isfinite(early) or not np.isfinite(late) or late <= early:
        return None
    frame = landmark_frame(result.tables["FactKm"], (early, late))
    strata = _strata(frame)
    fig, ax = _canvas(
        8.2,
        max(3.8, 0.7 * len(strata) + 2.4),
        f"Dot plot of Kaplan–Meier survival at two landmarks. Teal is survival at {early:.2g}, the 25th percentile of follow-up time. Copper is survival at {late:.2g}, the 75th percentile. The connector is the drop between those times. Whiskers are the log-log band.",
        wrap=92,
    )
    for index, name in enumerate(strata):
        part = frame[frame["Stratum"] == name]
        y = len(strata) - 1 - index
        early_row = part[np.isclose(part["Time"], early)].iloc[0]
        late_row = part[np.isclose(part["Time"], late)].iloc[0]
        ax.plot([early_row["Survival"], late_row["Survival"]], [y, y], color=INK, lw=1.2, zorder=2)
        for row, color in ((early_row, PALETTE[0]), (late_row, PALETTE[1])):
            survival = float(row["Survival"])
            low = min(float(row["Lo"]), survival)
            high = max(float(row["Hi"]), survival)
            ax.errorbar(
                survival,
                y,
                xerr=[[survival - low], [high - survival]],
                fmt="o",
                color=color,
                ecolor=color,
                elinewidth=0.8,
                capsize=2,
                ms=6,
                alpha=0.95,
                zorder=3,
            )
    ax.set_yticks(range(len(strata)), strata[::-1])
    ax.set_xlim(0, 1.02)
    ax.set_xlabel("Still without the event")
    ax.xaxis.grid(True, color=RULE, lw=0.6)
    ax.set_axisbelow(True)
    _seal(fig)
    return fig


def _hexbin(result: FitResult) -> Figure:
    residual = result.tables["FactResidual"].dropna(subset=["LinearPredictor", "Martingale"])
    fig, ax = _canvas(
        8.2,
        5.6,
        "Martingale residual against the linear predictor, counted in hexagonal cells. A dark cell is many rows, which a scatter would draw on top of each other. The line at 0 is a residual with nothing left to explain.",
    )
    bins = ax.hexbin(
        residual["LinearPredictor"],
        residual["Martingale"],
        gridsize=22,
        cmap=_HEAT,
        mincnt=1,
        linewidths=0.15,
        edgecolors="white",
    )
    ax.axhline(0, color=INK, lw=0.7, ls=_DASH, zorder=3)
    ax.set_xlabel("Linear predictor")
    ax.set_ylabel("Martingale residual")
    cbar = fig.colorbar(bins, ax=ax, fraction=0.046, pad=0.03)
    cbar.set_label("Rows")
    cbar.outline.set_linewidth(0.4)
    _seal(fig)
    return fig


def _influence_bars(result: FitResult) -> Figure:
    influence = result.tables["FactInfluence"].replace([np.inf, -np.inf], np.nan).dropna()
    terms = list(dict.fromkeys(influence["Term"].astype(str)))
    cols = min(3, max(1, len(terms)))
    rows = int(np.ceil(len(terms) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(3.6 * cols, 3.1 * rows + 0.8), squeeze=False)
    flat = list(axes.ravel())
    for ax, term in zip(flat, terms, strict=False):
        part = influence[influence["Term"].astype(str) == term]
        part = part.reindex(part["DeltaBeta"].abs().sort_values(ascending=False).index).head(_INFLUENCE_CAP)
        part = part.sort_values("DeltaBeta")
        colors = [PALETTE[0] if value >= 0 else PALETTE[1] for value in part["DeltaBeta"]]
        y = np.arange(len(part))
        ax.barh(y, part["DeltaBeta"], color=colors, height=0.72)
        ax.axvline(0, color=INK, lw=0.7, ls=_DASH)
        ax.set_yticks([])
        ax.set_title(term, fontsize=9, loc="left")
        ax.set_xlabel("dfbeta", labelpad=8)
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda value, _pos: f"{value:.3f}"))
        ax.tick_params(axis="x", labelsize=8)
        ax.xaxis.grid(True, color=RULE, lw=0.6)
        ax.set_axisbelow(True)
    for ax in flat[len(terms) :]:
        ax.set_visible(False)
    _finish_grid(
        fig,
        f"Diverging bars of signed dfbeta, the approximate change in the coefficient when that row is omitted. Each panel keeps the {_INFLUENCE_CAP} largest absolute values, so rows near zero are left out. A bar far from the line at 0 is an influential row.",
    )
    return fig


def _hexbin_ready(residual: pd.DataFrame) -> bool:
    if residual.empty or len(residual) < 20:
        return False
    predictor = residual["LinearPredictor"].to_numpy(dtype=float)
    return bool(np.isfinite(predictor).sum() >= 20 and np.nanstd(predictor) > 1e-8)


def _half_violin(ax: Axes, values: np.ndarray, y: float, color: str) -> None:
    if len(values) < 5 or float(np.std(values)) < 1e-8:
        return
    try:
        density = gaussian_kde(values)
    except (np.linalg.LinAlgError, ValueError):
        return
    xs = np.linspace(float(values.min()), float(values.max()), 160)
    ys = density(xs)
    peak = float(ys.max())
    if peak <= 0:
        return
    ys = ys / peak * 0.42
    ax.fill_between(xs, y, y + ys, color=color, alpha=0.28, linewidth=0)
    ax.plot(xs, y + ys, color=color, lw=1.0)


def _step_value(part: pd.DataFrame, time: float, column: str) -> float:
    eligible = part[part["Time"] <= time]
    chosen = eligible if not eligible.empty else part
    return float(chosen.iloc[-1][column])


def _time_grid(curve: pd.DataFrame, count: int) -> np.ndarray:
    tmax = float(np.quantile(curve["Time"].to_numpy(dtype=float), 0.98))
    if tmax <= 0:
        tmax = float(curve["Time"].max()) or 1.0
    return np.linspace(0, tmax, count)


def _bin_edges(times: np.ndarray, count: int) -> np.ndarray:
    finite = times[np.isfinite(times)]
    if len(finite) == 0:
        return np.linspace(0, 1, count + 1)
    high = float(np.quantile(finite, 0.98))
    if high <= 0:
        high = float(finite.max()) or 1.0
    return np.linspace(0, high, count + 1)


def _strata(frame: pd.DataFrame) -> list[str]:
    return sorted(set(frame["Stratum"].astype(str)))


def _canvas(width: float, height: float, caption: str, wrap: int = 88) -> tuple[Figure, Axes]:
    fig = plt.figure(figsize=(width, height))
    ax = fig.add_subplot(111)
    fig._form_caption = textwrap.fill(caption, width=wrap)  # type: ignore[attr-defined]
    return fig, ax


def _seal(fig: Figure) -> None:
    """Pack the axes above the caption, after labels and colorbars exist."""

    wrapped = fig._form_caption  # type: ignore[attr-defined]
    lines = wrapped.count("\n") + 1
    height = float(fig.get_size_inches()[1])
    bottom = min(0.48, max(0.14, (0.46 + 0.26 * lines) / height))
    fig.tight_layout(rect=(0, bottom, 1, 1))
    fig.text(0.01, 0.015, wrapped, ha="left", va="bottom", fontsize=9, color=MUTED, linespacing=1.35)


def _finish_grid(fig: Figure, caption: str) -> None:
    wrapped = textwrap.fill(caption, width=96)
    lines = wrapped.count("\n") + 1
    height = float(fig.get_size_inches()[1])
    bottom = min(0.36, max(0.14, (0.34 + 0.22 * lines) / height))
    fig.tight_layout(rect=(0, bottom, 1, 1))
    fig.text(0.02, 0.02, wrapped, ha="left", va="bottom", fontsize=9, color=MUTED, linespacing=1.3)

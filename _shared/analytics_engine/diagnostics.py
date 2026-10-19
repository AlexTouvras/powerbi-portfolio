"""Estimands that sit past the Kaplan–Meier curve and the Cox table.

Smoothed hazard, Cox–Snell residual, calibration, Aalen cumulative
coefficients, a decision curve, and a nomogram. Each one respects censoring.
A histogram of the recorded time does not: a censored row is not an event time.
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from lifelines import AalenAdditiveFitter, CoxPHFitter, KaplanMeierFitter, NelsonAalenFitter
from scipy.integrate import IntegrationWarning
from scipy.stats import norm

from analytics_engine.outcome import Outcome

Z95 = float(norm.ppf(0.975))

HAZARD_COLUMNS = ["Stratum", "Time", "Hazard", "Lo", "Hi", "Bandwidth"]
COXSNELL_COLUMNS = ["Residual", "Cumulative", "Lo", "Hi"]
CALIBRATION_COLUMNS = ["Bin", "N", "Predicted", "Observed", "Lo", "Hi", "Time"]
AALEN_COLUMNS = ["Term", "Time", "Cumulative", "Lo", "Hi"]
DECISION_COLUMNS = ["Threshold", "Strategy", "NetBenefit", "Time"]
NOMOGRAM_COLUMNS = ["Axis", "Label", "Points", "Order"]


def rmst_contrast(
    summary: pd.DataFrame,
    fitters: dict[str, KaplanMeierFitter],
    work: pd.DataFrame,
    outcome: Outcome,
) -> pd.DataFrame:
    """Restricted mean on one shared clock, and the difference versus the reference stratum."""

    if outcome.strata:
        names = [str(value) for value in summary["Stratum"]]
        reference = outcome.reference.get(outcome.strata)
        if reference not in names:
            reference = sorted(names)[0]
    else:
        reference = None
    tau = _shared_tau(fitters)
    moments = {str(name): _rmst(fitter, tau) for name, fitter in fitters.items()}
    ref_mean, ref_var = moments.get(reference, (np.nan, np.nan)) if reference else (np.nan, np.nan)
    rows: list[dict] = []
    for _, row in summary.iterrows():
        name = str(row["Stratum"])
        mean, variance = moments[name]
        difference = low = high = np.nan
        if reference is not None and name != reference and np.isfinite(mean) and np.isfinite(ref_mean):
            difference = mean - ref_mean
            if np.isfinite(variance) and np.isfinite(ref_var):
                error = Z95 * np.sqrt(max(variance, 0.0) + max(ref_var, 0.0))
                low = difference - error
                high = difference + error
        rows.append(
            {
                "Stratum": name,
                "N": int(row["N"]),
                "Events": int(row["Events"]),
                "Median": float(row["Median"]) if pd.notna(row["Median"]) else np.nan,
                "RestrictedMean": mean,
                "Tau": float(tau),
                "Difference": difference,
                "DiffLo": low,
                "DiffHi": high,
            }
        )
    return pd.DataFrame(rows)


def _shared_tau(fitters: dict[str, KaplanMeierFitter]) -> float:
    """Latest time at which every stratum still has a tenth of its rows at risk."""

    supports: list[float] = []
    for fitter in fitters.values():
        table = fitter.event_table
        floor = max(10, int(0.1 * float(table["at_risk"].iloc[0])))
        eligible = table[table["at_risk"] >= floor]
        supports.append(float(eligible.index.max()) if not eligible.empty else float(table.index.min()))
    return float(min(supports)) if supports else 0.0


def _rmst(fitter: KaplanMeierFitter, tau: float) -> tuple[float, float]:
    """Area under the Kaplan–Meier curve, and its Greenwood variance.

    lifelines' ``return_variance`` is the variance of the restricted lifetime, not
    the variance of this estimator.
    """

    survival = fitter.survival_function_.iloc[:, 0]
    times = survival.index.to_numpy(dtype=float)
    values = survival.to_numpy(dtype=float)

    def area(start: float) -> float:
        knots = [start, *[float(time) for time in times if start < time < tau], tau]
        total = 0.0
        for left, right in zip(knots[:-1], knots[1:], strict=True):
            eligible = np.flatnonzero(times <= left + 1e-12)
            height = float(values[eligible[-1]]) if eligible.size else 1.0
            total += height * (right - left)
        return total

    variance = 0.0
    for observed, row in fitter.event_table.iterrows():
        event_time = float(observed)
        deaths = float(row["observed"])
        at_risk = float(row["at_risk"])
        if event_time > tau or deaths <= 0 or at_risk <= deaths:
            continue
        integral = area(event_time)
        variance += integral**2 * deaths / (at_risk * (at_risk - deaths))
    return area(0.0), float(variance)


def clock(work: pd.DataFrame, outcome: Outcome) -> float:
    """The time the horizon figures use. The caller's horizon, otherwise the median follow-up."""

    if outcome.horizon is not None:
        return float(outcome.horizon)
    return float(np.median(work[outcome.time].to_numpy(dtype=float)))


def hazard_table(work: pd.DataFrame, outcome: Outcome) -> pd.DataFrame:
    """Epanechnikov smooth of the Nelson–Aalen increments. One bandwidth for every stratum."""

    event = work[outcome.event].to_numpy(dtype=float) == 1
    event_times = work.loc[event, outcome.time].to_numpy(dtype=float)
    if event_times.size < 8:
        return pd.DataFrame(columns=HAZARD_COLUMNS)
    span = np.quantile(event_times, [0.1, 0.9])
    bandwidth = max(0.2 * float(span[1] - span[0]), 1e-3)
    rows: list[dict] = []
    for name, part in _groups(work, outcome).items():
        if int(part[outcome.event].sum()) < 8:
            continue
        fitter = NelsonAalenFitter(alpha=0.05)
        fitter.fit(part[outcome.time], part[outcome.event], label=name)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            smooth = fitter.smoothed_hazard_(bandwidth)
            band = fitter.smoothed_hazard_confidence_intervals_(bandwidth)
        estimate = smooth.iloc[:, 0].to_numpy(dtype=float)
        lower = band.iloc[:, 0].to_numpy(dtype=float)
        upper = band.iloc[:, 1].to_numpy(dtype=float)
        # lifelines names the two smoothed bounds in reverse of the cumulative-hazard bounds.
        lo = np.fmin(lower, upper)
        hi = np.fmax(lower, upper)
        times = smooth.index.to_numpy(dtype=float)
        for observed, value, low, high in zip(times, estimate, lo, hi, strict=True):
            if not np.isfinite(value) or value < 0:
                continue
            rows.append(
                {
                    "Stratum": name,
                    "Time": float(observed),
                    "Hazard": float(value),
                    "Lo": float(low) if np.isfinite(low) else np.nan,
                    "Hi": float(high) if np.isfinite(high) else np.nan,
                    "Bandwidth": bandwidth,
                }
            )
    if not rows:
        return pd.DataFrame(columns=HAZARD_COLUMNS)
    return pd.DataFrame(rows)[HAZARD_COLUMNS]


def cox_snell_table(fitter: CoxPHFitter | None, train: pd.DataFrame | None, outcome: Outcome) -> pd.DataFrame:
    """Nelson–Aalen cumulative hazard of the Cox–Snell residuals. A fitting model tracks the line y = x."""

    if fitter is None or train is None:
        return pd.DataFrame(columns=COXSNELL_COLUMNS)
    baseline = fitter.baseline_cumulative_hazard_
    timeline = baseline.index.to_numpy(dtype=float)
    height = baseline.iloc[:, 0].to_numpy(dtype=float)
    times = train[outcome.time].to_numpy(dtype=float)
    partial = np.asarray(fitter.predict_partial_hazard(train), dtype=float).reshape(-1)
    residual = np.interp(times, timeline, height, left=0.0, right=float(height[-1])) * partial
    residual = np.clip(residual, 0, None)
    if not np.isfinite(residual).any():
        return pd.DataFrame(columns=COXSNELL_COLUMNS)
    nelson = NelsonAalenFitter(alpha=0.05).fit(residual, train[outcome.event])
    curve = nelson.cumulative_hazard_.iloc[:, 0]
    band = nelson.confidence_interval_cumulative_hazard_
    frame = pd.DataFrame(
        {
            "Residual": curve.index.to_numpy(dtype=float),
            "Cumulative": curve.to_numpy(dtype=float),
            "Lo": band.iloc[:, 0].to_numpy(dtype=float),
            "Hi": band.iloc[:, 1].to_numpy(dtype=float),
        }
    )
    finite = np.isfinite(frame["Cumulative"])
    return frame.loc[finite, COXSNELL_COLUMNS]


def calibration_table(
    fitter: CoxPHFitter | None,
    train: pd.DataFrame | None,
    outcome: Outcome,
    when: float,
) -> pd.DataFrame:
    """Observed Kaplan–Meier event rate against mean predicted risk, in quantile groups."""

    empty = pd.DataFrame(columns=CALIBRATION_COLUMNS)
    if fitter is None or train is None or not np.isfinite(when):
        return empty
    survival = fitter.predict_survival_function(train, times=[when])
    risk = (1.0 - survival.iloc[0].astype(float)).clip(0, 1)
    if float(risk.std()) < 1e-6:
        return empty
    groups = 4 if len(train) < 400 else 5
    try:
        buckets = pd.qcut(risk, groups, duplicates="drop")
    except ValueError:
        return empty
    rows: list[dict] = []
    for index, (_, part) in enumerate(train.groupby(buckets, observed=True), start=1):
        if len(part) < 8:
            continue
        estimate = _km_event(part[outcome.time], part[outcome.event], when)
        if estimate is None:
            continue
        observed, low, high = estimate
        rows.append(
            {
                "Bin": index,
                "N": int(len(part)),
                "Predicted": float(risk.loc[part.index].mean()),
                "Observed": observed,
                "Lo": low,
                "Hi": high,
                "Time": float(when),
            }
        )
    if len(rows) < 3:
        return empty
    return pd.DataFrame(rows)[CALIBRATION_COLUMNS]


def aalen_table(train: pd.DataFrame | None, outcome: Outcome) -> pd.DataFrame:
    """Cumulative coefficients of the Aalen additive hazard. The slope is the added hazard."""

    empty = pd.DataFrame(columns=AALEN_COLUMNS)
    if train is None or train.empty:
        return empty
    try:
        fitter = AalenAdditiveFitter(coef_penalizer=0.0, smoothing_penalizer=0.0)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fitter.fit(train, outcome.time, outcome.event)
    except (ValueError, np.linalg.LinAlgError, FloatingPointError):
        return empty
    cumulative = fitter.cumulative_hazards_
    intervals = fitter.confidence_intervals_
    rows: list[dict] = []
    for column in cumulative.columns:
        term = "baseline" if column == "Intercept" else str(column)
        lower = intervals[column].xs("95% lower-bound", level=0)
        upper = intervals[column].xs("95% upper-bound", level=0)
        for observed, value, low, high in zip(
            cumulative.index.to_numpy(dtype=float),
            cumulative[column].to_numpy(dtype=float),
            lower.to_numpy(dtype=float),
            upper.to_numpy(dtype=float),
            strict=False,
        ):
            if not np.isfinite(value):
                continue
            rows.append(
                {
                    "Term": term,
                    "Time": float(observed),
                    "Cumulative": float(value),
                    "Lo": float(min(low, high)) if np.isfinite(low) and np.isfinite(high) else np.nan,
                    "Hi": float(max(low, high)) if np.isfinite(low) and np.isfinite(high) else np.nan,
                }
            )
    if not rows:
        return empty
    return pd.DataFrame(rows)[AALEN_COLUMNS]


def decision_table(
    fitter: CoxPHFitter | None,
    train: pd.DataFrame | None,
    outcome: Outcome,
    when: float,
) -> pd.DataFrame:
    """Net benefit of acting when predicted risk exceeds a threshold. Censoring stays inside the Kaplan–Meier rates."""

    empty = pd.DataFrame(columns=DECISION_COLUMNS)
    if fitter is None or train is None or not np.isfinite(when):
        return empty
    survival = fitter.predict_survival_function(train, times=[when])
    risk = (1.0 - survival.iloc[0].astype(float)).clip(0, 1)
    overall = _km_event(train[outcome.time], train[outcome.event], when)
    if overall is None:
        return empty
    high = float(np.quantile(risk.to_numpy(dtype=float), 0.9))
    thresholds = np.linspace(0.05, max(0.2, min(0.8, high)), 21)
    rows: list[dict] = []
    event_rate, _, _ = overall
    for threshold in thresholds:
        odds = float(threshold) / (1.0 - float(threshold))
        rows.append({"Threshold": float(threshold), "Strategy": "Treat all", "NetBenefit": event_rate - (1.0 - event_rate) * odds, "Time": float(when)})
        rows.append({"Threshold": float(threshold), "Strategy": "Treat none", "NetBenefit": 0.0, "Time": float(when)})
        chosen = train.loc[risk >= threshold]
        if len(chosen) < 8:
            rows.append({"Threshold": float(threshold), "Strategy": "Model", "NetBenefit": 0.0, "Time": float(when)})
            continue
        inside = _km_event(chosen[outcome.time], chosen[outcome.event], when)
        if inside is None:
            continue
        rate, _, _ = inside
        share = len(chosen) / len(train)
        benefit = share * rate - share * (1.0 - rate) * odds
        rows.append({"Threshold": float(threshold), "Strategy": "Model", "NetBenefit": float(benefit), "Time": float(when)})
    return pd.DataFrame(rows)[DECISION_COLUMNS]


def nomogram_table(
    fitter: CoxPHFitter | None,
    design: pd.DataFrame,
    references: dict[str, str],
    outcome: Outcome,
    when: float,
) -> pd.DataFrame:
    """Aligned scales for a Cox model. Points are an affine map of the linear predictor."""

    empty = pd.DataFrame(columns=NOMOGRAM_COLUMNS)
    if fitter is None or design.empty or not np.isfinite(when):
        return empty
    beta = fitter.params_
    anchors = _anchors(design, references)
    spans = []
    for term, points in anchors.items():
        if term not in beta.index:
            continue
        contributions = [float(beta[term]) * value for _, value in points]
        spans.append((term, min(contributions), max(contributions)))
    if not spans:
        return empty
    scale = max(high - low for _, low, high in spans)
    if scale < 1e-8:
        return empty
    offset = float(sum(low for _, low, _ in spans))
    rows: list[dict] = []
    order = 0
    for label, position in (("0", 0.0), ("20", 20.0), ("40", 40.0), ("60", 60.0), ("80", 80.0), ("100", 100.0)):
        rows.append({"Axis": "Points", "Label": label, "Points": position, "Order": order})
    order += 1
    for term, low, high in spans:
        kept = _thin([(100.0 * (float(beta[term]) * value - low) / scale, text) for text, value in anchors[term]])
        for position, text in kept:
            rows.append({"Axis": term, "Label": text, "Points": position, "Order": order})
        order += 1
    max_total = float(sum(100.0 * (high - low) / scale for _, low, high in spans))
    if max_total <= 0:
        return empty
    for total in _total_ticks(max_total):
        rows.append({"Axis": "Total points", "Label": f"{total:.0f}", "Points": 100.0 * total / max_total, "Order": order})
    order += 1
    baseline = fitter.baseline_cumulative_hazard_
    height = float(np.interp(when, baseline.index.to_numpy(dtype=float), baseline.iloc[:, 0].to_numpy(dtype=float)))
    baseline_survival = float(np.exp(-height))
    survival_rows = _survival_ticks(baseline_survival, offset, scale, max_total)
    if survival_rows:
        for position, text in survival_rows:
            rows.append({"Axis": f"Survival at {when:.2g}", "Label": text, "Points": position, "Order": order})
    return pd.DataFrame(rows)[NOMOGRAM_COLUMNS]


def _groups(work: pd.DataFrame, outcome: Outcome) -> dict[str, pd.DataFrame]:
    if not outcome.strata:
        return {"All": work}
    names = sorted(work[outcome.strata].astype(str).unique())
    return {name: work[work[outcome.strata].astype(str) == name] for name in names}


def _km_event(time: pd.Series, event: pd.Series, when: float) -> tuple[float, float, float] | None:
    if len(time) < 8 or float(time.max()) <= 0:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", IntegrationWarning)
        fitter = KaplanMeierFitter(alpha=0.05).fit(time, event)
    survival = fitter.survival_function_.iloc[:, 0]
    band = fitter.confidence_interval_survival_function_
    eligible = survival.index.to_numpy(dtype=float) <= when
    if not eligible.any():
        return None
    chosen = survival.index[eligible][-1]
    estimate = float(survival.loc[chosen])
    low = float(band.iloc[:, 0].loc[chosen])
    high = float(band.iloc[:, 1].loc[chosen])
    observed = 1.0 - estimate
    return observed, 1.0 - max(low, high), 1.0 - min(low, high)


def _anchors(design: pd.DataFrame, references: dict[str, str]) -> dict[str, list[tuple[str, float]]]:
    found: dict[str, list[tuple[str, float]]] = {}
    for column in design.columns:
        series = design[column]
        if set(np.unique(np.round(series.to_numpy(dtype=float), 6))).issubset({0.0, 1.0}):
            level = _level_name(str(column))
            reference = references.get(level[0], "0") if level else "0"
            found[str(column)] = [(reference, 0.0), (level[1] if level else "1", 1.0)]
            continue
        quantiles = series.quantile([0.1, 0.5, 0.9]).to_numpy(dtype=float)
        ticks = []
        seen: set[str] = set()
        for value in quantiles:
            text = f"{value:.2g}"
            if text in seen:
                continue
            seen.add(text)
            ticks.append((text, float(value)))
        if len(ticks) >= 2:
            found[str(column)] = ticks
    return found


def _level_name(term: str) -> tuple[str, str] | None:
    if "[" not in term or not term.endswith("]"):
        return None
    name, _, level = term.partition("[")
    return name, level[:-1]


def _thin(ticks: list[tuple[float, str]], gap: float = 9.0) -> list[tuple[float, str]]:
    ordered = sorted(ticks)
    kept: list[tuple[float, str]] = []
    for position, text in ordered:
        if kept and position - kept[-1][0] < gap:
            continue
        kept.append((position, text))
    if ordered and (not kept or kept[-1][0] != ordered[-1][0]):
        if kept and ordered[-1][0] - kept[-1][0] < gap:
            kept[-1] = ordered[-1]
        else:
            kept.append(ordered[-1])
    return kept


def _total_ticks(maximum: float) -> list[float]:
    if maximum <= 0:
        return []
    step = 50.0 if maximum > 180 else 25.0 if maximum > 80 else 20.0
    raw = [float(value) for value in np.arange(0.0, maximum + step * 0.01, step) if value <= maximum + 1e-6]
    if not raw or raw[-1] < maximum - step * 0.25:
        raw.append(float(maximum))
    thinned = _thin([(100.0 * value / maximum, f"{value:.0f}") for value in raw], gap=12)
    return [float(text) for _, text in thinned]


def _survival_ticks(baseline: float, offset: float, scale: float, max_total: float) -> list[tuple[float, str]]:
    if not 0.02 < baseline < 0.98 or max_total <= 0 or scale == 0:
        return []
    placed: list[tuple[float, str]] = []
    for survival in (0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05):
        display = _survival_display(survival, baseline, offset, scale, max_total)
        if display is None or not 0.0 <= display <= 100.0:
            continue
        placed.append((display, _survival_label(survival)))
    end = _survival_at(100.0, baseline, offset, scale, max_total)
    if np.isfinite(end) and 0.02 < end < 0.98:
        label = _survival_label(end)
        if not placed or placed[-1][1] != label:
            placed.append((100.0, label))
    return _thin(placed, gap=8)


def _survival_display(
    survival: float,
    baseline: float,
    offset: float,
    scale: float,
    max_total: float,
) -> float | None:
    if survival <= 0 or survival >= 1 or baseline <= 0 or baseline >= 1:
        return None
    ratio = np.log(survival) / np.log(baseline)
    if not np.isfinite(ratio) or ratio <= 0:
        return None
    total = (float(np.log(ratio)) - offset) * 100.0 / scale
    return 100.0 * total / max_total


def _survival_at(display: float, baseline: float, offset: float, scale: float, max_total: float) -> float:
    total = display / 100.0 * max_total
    eta = total * scale / 100.0 + offset
    return float(baseline ** np.exp(eta))


def _survival_label(survival: float) -> str:
    return f"{survival:.2f}".rstrip("0").rstrip(".")

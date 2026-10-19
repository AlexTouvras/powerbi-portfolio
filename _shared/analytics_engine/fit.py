"""Fit a duration table to the tables an argument page may quote.

The input is whatever table the caller passes. Kaplan–Meier uses a log-log
95% band. The Cox model uses Efron ties. Proportional hazards are judged with
the Grambsch–Therneau test on the Kaplan–Meier time transform, which is the
transform current R ``cox.zph`` uses. lifelines' own default is the rank
transform, and lifelines does not add the Cox coefficient onto the scaled
Schoenfeld residual the way R's ``residuals(..., "scaledsch")`` does. The
beta(t) table stores the residual lifelines returns, and the figure adds the
coefficient back.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.statistics import multivariate_logrank_test, proportional_hazard_test
from lifelines.utils import restricted_mean_survival_time

from analytics_engine.outcome import Outcome, RouteError, route

PH_ALPHA = 0.05
TIME_TRANSFORM = "km"
TABLES = (
    "FactKm",
    "StratumSummary",
    "FactCensor",
    "FactCox",
    "FactPh",
    "FactBetaT",
    "FactResidual",
    "FactInfluence",
    "FactAdjusted",
    "FactPrediction",
    "ModelMetrics",
)

_KM_COLUMNS = ["Stratum", "Time", "Survival", "Lo", "Hi", "NRisk", "NEvent", "NCensor"]
_STRATUM_COLUMNS = ["Stratum", "N", "Events", "Median", "RestrictedMean"]
_COX_COLUMNS = ["Term", "HazardRatio", "Lo", "Hi", "P", "Reference", "Kind"]
_PH_COLUMNS = ["Term", "Test", "P", "Verdict", "TimeTransform"]
_BETA_COLUMNS = ["Term", "Time", "Beta", "Lo", "Hi", "Residual", "Kind"]
_PRED_COLUMNS = ["Horizon", "NAtRisk", "ExpectedExits"]
_METRIC_COLUMNS = ["N", "Events", "NCensored", "Concordance", "LogRankP"]
_RESIDUAL_COLUMNS = ["Time", "Event", "LinearPredictor", "Martingale", "Deviance"]
_INFLUENCE_COLUMNS = ["Term", "Time", "DeltaBeta"]
_ADJUSTED_COLUMNS = ["Profile", "Time", "Survival"]


@dataclass(frozen=True)
class FitResult:
    outcome: Outcome
    tables: dict[str, pd.DataFrame]
    measures: dict[str, float]
    notes: tuple[str, ...]
    content_hash: str
    released: bool = False


def fit(frame: pd.DataFrame, outcome: Outcome) -> FitResult:
    """Fit a draft. The result cannot be cited or drawn until :func:`release`."""

    kind = route(outcome)
    if kind != "duration":
        raise RouteError(
            f"a {kind} outcome stays on the existing report scripts; "
            "this engine fits a clock and a censoring flag"
        )
    work, design, references = _prepare(frame, outcome)
    km, summary, km_fitters = _kaplan_meier(work, outcome)
    logrank_p = _logrank(work, outcome)
    cox, ph, beta, concordance, notes, fitter, train = _cox(work, design, references)
    prediction = _prediction(
        work, outcome, design, km_fitters, fitter, cox_was_fit=concordance is not None
    )
    censor = _censoring(work, outcome)
    residual, influence, adjusted = _model_curves(outcome, design, references, fitter, train)
    metrics = pd.DataFrame(
        [
            {
                "N": int(len(work)),
                "Events": int(work[outcome.event].sum()),
                "NCensored": int((work[outcome.event] == 0).sum()),
                "Concordance": concordance,
                "LogRankP": logrank_p,
            }
        ],
        columns=_METRIC_COLUMNS,
    )
    tables = {
        "FactKm": km,
        "StratumSummary": summary,
        "FactCensor": censor,
        "FactCox": cox,
        "FactPh": ph,
        "FactBetaT": beta,
        "FactResidual": residual,
        "FactInfluence": influence,
        "FactAdjusted": adjusted,
        "FactPrediction": prediction,
        "ModelMetrics": metrics,
    }
    measures = _measures(tables, summary)
    notes = (
        "Cox ties: Efron",
        f"Proportional-hazards time transform: {TIME_TRANSFORM}",
        "Scaled Schoenfeld residuals are stored as lifelines returns them (mean zero). "
        "The figure adds the Cox coefficient, matching R's scaled Schoenfeld residual.",
        "Cumulative hazard and the log-log plot are transforms of FactKm. "
        "FactCensor is the reverse Kaplan–Meier, with censoring treated as the event.",
        *notes,
    )
    return FitResult(
        outcome=outcome,
        tables=tables,
        measures=measures,
        notes=notes,
        content_hash=_hash_tables(tables),
        released=False,
    )


def release(result: FitResult) -> FitResult:
    """Mark a fit citeable. Agents use the CLI, which has no way to call this."""

    return replace(result, released=True)


def write_fit(result: FitResult, directory: str | Path) -> Path:
    """Write the draft tables and ``fit_hash.txt``. Never writes ``APPROVED``."""

    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    for name in TABLES:
        result.tables[name].to_csv(path / f"{name}.csv", index=False, na_rep="")
    digest = hash_directory(path)
    (path / "fit_hash.txt").write_text(digest + "\n", encoding="utf-8")
    payload = {
        "status": "draft" if not result.released else "released-in-memory",
        "hash": digest,
        "outcome": {
            "kind": result.outcome.kind,
            "time": result.outcome.time,
            "event": result.outcome.event,
            "strata": result.outcome.strata,
            "covariates": list(result.outcome.covariates),
            "horizon": result.outcome.horizon,
            "reference": result.outcome.reference,
        },
        "measures": result.measures,
        "notes": list(result.notes),
    }
    (path / "draft.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def read_fit(directory: str | Path) -> FitResult:
    """Load a draft from a directory written by :func:`write_fit`."""

    path = Path(directory)
    tables = {name: pd.read_csv(path / f"{name}.csv") for name in TABLES}
    meta = json.loads((path / "draft.json").read_text(encoding="utf-8"))
    outcome_meta = meta["outcome"]
    outcome = Outcome(
        kind=outcome_meta["kind"],
        time=outcome_meta.get("time"),
        event=outcome_meta.get("event"),
        strata=outcome_meta.get("strata"),
        covariates=tuple(outcome_meta.get("covariates") or ()),
        horizon=outcome_meta.get("horizon"),
        reference=dict(outcome_meta.get("reference") or {}),
    )
    digest = hash_directory(path)
    recorded = (path / "fit_hash.txt").read_text(encoding="utf-8").strip()
    if digest != recorded:
        raise ValueError("fit_hash.txt does not match the tables on disk")
    summary = tables["StratumSummary"]
    return FitResult(
        outcome=outcome,
        tables=tables,
        measures=_measures(tables, summary),
        notes=tuple(meta.get("notes") or ()),
        content_hash=digest,
        released=False,
    )


def hash_directory(directory: str | Path) -> str:
    path = Path(directory)
    digest = hashlib.sha256()
    for name in TABLES:
        digest.update(name.encode())
        digest.update((path / f"{name}.csv").read_bytes())
    return digest.hexdigest()


def approval_matches(directory: str | Path) -> bool:
    path = Path(directory)
    approved = path / "APPROVED"
    if not approved.is_file():
        return False
    return approved.read_text(encoding="utf-8").strip() == hash_directory(path)


def _prepare(
    frame: pd.DataFrame, outcome: Outcome
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, str]]:
    missing = [c for c in (outcome.time, outcome.event, outcome.strata, *outcome.covariates) if c and c not in frame.columns]
    if missing:
        raise ValueError(f"columns not in the table: {missing}")
    if outcome.time in outcome.covariates or outcome.event in outcome.covariates:
        raise ValueError("time and event are not covariates")
    if outcome.strata in (outcome.time, outcome.event):
        raise ValueError("strata cannot be the time or event column")
    work = frame.copy().reset_index(drop=True)
    work[outcome.time] = pd.to_numeric(work[outcome.time], errors="coerce")
    work[outcome.event] = pd.to_numeric(work[outcome.event], errors="coerce")
    if work[outcome.time].isna().any() or work[outcome.event].isna().any():
        raise ValueError("time and event must be numeric")
    if (work[outcome.time] < 0).any() or not np.isfinite(work[outcome.time]).all():
        raise ValueError("time must be finite and at least 0")
    events = set(work[outcome.event].unique())
    if not events <= {0, 1}:
        raise ValueError("event must be 0 or 1")
    if work[outcome.event].sum() < 1:
        raise ValueError("the table has no events")
    if len(work) < 2:
        raise ValueError("the table needs at least two rows")

    covariates = list(outcome.covariates)
    if outcome.strata and outcome.strata not in covariates:
        covariates = [outcome.strata, *covariates]
    pieces: list[pd.Series] = []
    references: dict[str, str] = {}
    for column in covariates:
        series = work[column]
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            numeric = pd.to_numeric(series, errors="coerce")
            if numeric.isna().any():
                raise ValueError(f"{column} has non-numeric values")
            if float(numeric.std(ddof=0)) == 0.0:
                continue
            pieces.append(numeric.astype(float).rename(column))
            continue
        levels = sorted(series.astype(str).unique())
        if len(levels) < 2:
            continue
        ref = outcome.reference.get(column, levels[0])
        if ref not in levels:
            raise ValueError(f"reference {ref!r} is not a level of {column}")
        references[column] = ref
        for level in levels:
            if level == ref:
                continue
            name = f"{column}[{level}]"
            pieces.append((series.astype(str) == level).astype(float).rename(name))
    design = pd.concat(pieces, axis=1) if pieces else pd.DataFrame(index=work.index)
    if design.columns.duplicated().any():
        raise ValueError("covariate encoding produced duplicate column names")
    overlap = set(design.columns) & {outcome.time, outcome.event}
    if overlap:
        raise ValueError(f"encoded covariates collide with time or event: {sorted(overlap)}")
    work.attrs["time"] = outcome.time
    work.attrs["event"] = outcome.event
    return work, design, references


def _kaplan_meier(
    work: pd.DataFrame, outcome: Outcome
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, KaplanMeierFitter]]:
    if outcome.strata:
        groups = [str(v) for v in sorted(work[outcome.strata].astype(str).unique())]
        grouped = {name: work[work[outcome.strata].astype(str) == name] for name in groups}
    else:
        grouped = {"All": work}
    curves: list[pd.DataFrame] = []
    summaries: list[dict] = []
    fitters: dict[str, KaplanMeierFitter] = {}
    for name, part in grouped.items():
        fitter = KaplanMeierFitter(alpha=0.05)
        fitter.fit(part[outcome.time], part[outcome.event], label=name)
        fitters[name] = fitter
        sf = fitter.survival_function_[name]
        ci = fitter.confidence_interval_survival_function_
        table = fitter.event_table.reindex(sf.index)
        curves.append(
            pd.DataFrame(
                {
                    "Stratum": name,
                    "Time": sf.index.astype(float),
                    "Survival": sf.to_numpy(dtype=float),
                    "Lo": ci.iloc[:, 0].to_numpy(dtype=float),
                    "Hi": ci.iloc[:, 1].to_numpy(dtype=float),
                    "NRisk": table["at_risk"].to_numpy(dtype=float),
                    "NEvent": table["observed"].fillna(0).to_numpy(dtype=float),
                    "NCensor": table["censored"].fillna(0).to_numpy(dtype=float),
                }
            )
        )
        median = float(fitter.median_survival_time_)
        if not np.isfinite(median):
            median = np.nan
        summaries.append(
            {
                "Stratum": name,
                "N": int(len(part)),
                "Events": int(part[outcome.event].sum()),
                "Median": median,
                "RestrictedMean": float(restricted_mean_survival_time(fitter)),
            }
        )
    return (
        pd.concat(curves, ignore_index=True)[_KM_COLUMNS],
        pd.DataFrame(summaries)[_STRATUM_COLUMNS],
        fitters,
    )


def _logrank(work: pd.DataFrame, outcome: Outcome) -> float | None:
    if not outcome.strata:
        return None
    labels = work[outcome.strata].astype(str)
    if labels.nunique() < 2:
        return None
    result = multivariate_logrank_test(work[outcome.time], labels, work[outcome.event])
    return float(result.p_value)


def _cox(
    work: pd.DataFrame,
    design: pd.DataFrame,
    references: dict[str, str],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, float | None, tuple[str, ...], CoxPHFitter | None, pd.DataFrame | None]:
    empty_cox = pd.DataFrame(columns=_COX_COLUMNS)
    empty_ph = pd.DataFrame(columns=_PH_COLUMNS)
    empty_beta = pd.DataFrame(columns=_BETA_COLUMNS)
    if design.empty:
        return empty_cox, empty_ph, empty_beta, None, ("No covariates with variation, so no Cox model.",), None, None
    time_col = work.attrs["time"]
    event_col = work.attrs["event"]
    train = design.copy()
    train.insert(0, event_col, work[event_col].to_numpy())
    train.insert(0, time_col, work[time_col].to_numpy())
    fitter = CoxPHFitter()
    fitter.fit(train, duration_col=time_col, event_col=event_col)
    summary = fitter.summary
    cox_rows = []
    for term in summary.index:
        reference, kind = _term_reference(str(term), references)
        cox_rows.append(
            {
                "Term": str(term),
                "HazardRatio": float(summary.loc[term, "exp(coef)"]),
                "Lo": float(summary.loc[term, "exp(coef) lower 95%"]),
                "Hi": float(summary.loc[term, "exp(coef) upper 95%"]),
                "P": float(summary.loc[term, "p"]),
                "Reference": reference,
                "Kind": kind,
            }
        )
    ph_result = proportional_hazard_test(fitter, train, time_transform=TIME_TRANSFORM)
    ph_rows = []
    for term in ph_result.summary.index:
        p_value = float(ph_result.summary.loc[term, "p"])
        ph_rows.append(
            {
                "Term": str(term),
                "Test": "grambsch-therneau",
                "P": p_value,
                "Verdict": "holds" if p_value >= PH_ALPHA else "changes",
                "TimeTransform": TIME_TRANSFORM,
            }
        )
    beta = _beta_table(fitter, train, time_col, event_col)
    return (
        pd.DataFrame(cox_rows)[_COX_COLUMNS],
        pd.DataFrame(ph_rows)[_PH_COLUMNS],
        beta,
        float(fitter.concordance_index_),
        (),
        fitter,
        train,
    )


def _term_reference(term: str, references: dict[str, str]) -> tuple[str, str]:
    if "[" in term and term.endswith("]"):
        column, level = term[:-1].split("[", 1)
        return references.get(column, ""), "level"
    return "", "numeric"


def _beta_table(fitter: CoxPHFitter, train: pd.DataFrame, time_col: str, event_col: str) -> pd.DataFrame:
    residuals = fitter.compute_residuals(train, kind="scaled_schoenfeld")
    times = train.loc[residuals.index, time_col]
    rows: list[dict] = []
    for term in residuals.columns:
        beta = float(fitter.params_[term])
        observed = times.to_numpy(dtype=float)
        scaled = residuals[term].to_numpy(dtype=float)
        for t, value in zip(observed, scaled, strict=True):
            rows.append(
                {
                    "Term": str(term),
                    "Time": float(t),
                    "Beta": beta,
                    "Lo": np.nan,
                    "Hi": np.nan,
                    "Residual": float(value),
                    "Kind": "residual",
                }
            )
        for row in _smooth(str(term), observed, scaled, beta):
            rows.append(row)
    if not rows:
        return pd.DataFrame(columns=_BETA_COLUMNS)
    return pd.DataFrame(rows)[_BETA_COLUMNS]


def _smooth(term: str, time: np.ndarray, scaled: np.ndarray, beta: float) -> list[dict]:
    mask = np.isfinite(time) & np.isfinite(scaled) & (time > 0)
    time = time[mask]
    scaled = scaled[mask]
    if len(time) < 8:
        return []
    log_t = np.log(time)
    degree = 3 if len(time) >= 20 else 2
    low, high = np.quantile(log_t, [0.05, 0.95])
    powers = [np.ones(len(log_t))]
    for d in range(1, degree + 1):
        powers.append(log_t**d)
    try:
        fitted = sm.OLS(scaled, np.column_stack(powers)).fit()
    except (ValueError, np.linalg.LinAlgError):
        return []
    grid = np.linspace(float(low), float(high), 40)
    grid_powers = [np.ones(len(grid))]
    for d in range(1, degree + 1):
        grid_powers.append(grid**d)
    frame = fitted.get_prediction(np.column_stack(grid_powers)).summary_frame(alpha=0.05)
    out = []
    for x, mean, lo, hi in zip(
        np.exp(grid),
        frame["mean"].to_numpy(),
        frame["mean_ci_lower"].to_numpy(),
        frame["mean_ci_upper"].to_numpy(),
        strict=True,
    ):
        out.append(
            {
                "Term": term,
                "Time": float(x),
                "Beta": float(beta + mean),
                "Lo": float(beta + lo),
                "Hi": float(beta + hi),
                "Residual": np.nan,
                "Kind": "smooth",
            }
        )
    return out


def _censoring(work: pd.DataFrame, outcome: Outcome) -> pd.DataFrame:
    """Reverse Kaplan–Meier: censoring is the event, and the original event censors follow-up."""

    if int((work[outcome.event] == 0).sum()) < 1:
        return pd.DataFrame(columns=_KM_COLUMNS)
    flipped = work.copy()
    flipped[outcome.event] = (work[outcome.event] == 0).astype(int)
    curve, _, _ = _kaplan_meier(flipped, outcome)
    return curve


def _model_curves(
    outcome: Outcome,
    design: pd.DataFrame,
    references: dict[str, str],
    fitter: CoxPHFitter | None,
    train: pd.DataFrame | None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    empty_residual = pd.DataFrame(columns=_RESIDUAL_COLUMNS)
    empty_influence = pd.DataFrame(columns=_INFLUENCE_COLUMNS)
    empty_adjusted = pd.DataFrame(columns=_ADJUSTED_COLUMNS)
    if fitter is None or train is None:
        return empty_residual, empty_influence, empty_adjusted
    time_col = outcome.time
    event_col = outcome.event
    martingale = fitter.compute_residuals(train, "martingale")
    deviance = fitter.compute_residuals(train, "deviance").reindex(martingale.index)
    linear = fitter.predict_log_partial_hazard(train).reindex(martingale.index)
    residual = pd.DataFrame(
        {
            "Time": train.loc[martingale.index, time_col].to_numpy(dtype=float),
            "Event": train.loc[martingale.index, event_col].to_numpy(dtype=float),
            "LinearPredictor": linear.to_numpy(dtype=float),
            "Martingale": martingale["martingale"].to_numpy(dtype=float),
            "Deviance": deviance["deviance"].to_numpy(dtype=float),
        }
    )
    delta = fitter.compute_residuals(train, "delta_beta")
    times = train.loc[delta.index, time_col]
    influence_rows = []
    for term in delta.columns:
        for observed, value in zip(times.to_numpy(dtype=float), delta[term].to_numpy(dtype=float), strict=True):
            influence_rows.append({"Term": str(term), "Time": float(observed), "DeltaBeta": float(value)})
    influence = pd.DataFrame(influence_rows)[_INFLUENCE_COLUMNS] if influence_rows else empty_influence
    adjusted = _adjusted(fitter, train, design, outcome, references)
    return residual[_RESIDUAL_COLUMNS], influence, adjusted


def _adjusted(
    fitter: CoxPHFitter,
    train: pd.DataFrame,
    design: pd.DataFrame,
    outcome: Outcome,
    references: dict[str, str],
) -> pd.DataFrame:
    times = np.unique(np.quantile(train[outcome.time].to_numpy(dtype=float), np.linspace(0, 0.98, 36)))
    times = np.unique(np.r_[0.0, times])
    profiles = _profiles(design, outcome, references)
    rows: list[dict] = []
    for name, values in profiles:
        covariates = pd.DataFrame([values], columns=list(design.columns))
        survival = fitter.predict_survival_function(covariates, times=times)
        for observed, estimate in zip(survival.index.to_numpy(dtype=float), survival.iloc[:, 0].to_numpy(dtype=float), strict=True):
            rows.append({"Profile": name, "Time": float(observed), "Survival": float(estimate)})
    if not rows:
        return pd.DataFrame(columns=_ADJUSTED_COLUMNS)
    return pd.DataFrame(rows)[_ADJUSTED_COLUMNS]


def _profiles(
    design: pd.DataFrame, outcome: Outcome, references: dict[str, str]
) -> list[tuple[str, dict[str, float]]]:
    if design.empty:
        return []
    means = {column: float(design[column].mean()) for column in design.columns}
    strata = outcome.strata
    dummy_prefix = f"{strata}[" if strata else ""
    dummy_columns = [column for column in design.columns if dummy_prefix and column.startswith(dummy_prefix)]
    numeric_means = {column: value for column, value in means.items() if column not in dummy_columns}

    def row_for(level: str | None) -> dict[str, float]:
        values = dict(numeric_means)
        for column in design.columns:
            if column in numeric_means:
                continue
            if strata and column.startswith(dummy_prefix):
                values[column] = 1.0 if level is not None and column == f"{strata}[{level}]" else 0.0
            else:
                values[column] = 0.0
        return values

    if strata and strata in references and dummy_columns:
        levels = [references[strata]]
        for column in dummy_columns:
            level = column[len(dummy_prefix) : -1]
            if level not in levels:
                levels.append(level)
        return [(level, row_for(level)) for level in levels]
    return [("average", row_for(None))]


def _prediction(
    work: pd.DataFrame,
    outcome: Outcome,
    design: pd.DataFrame,
    km_fitters: dict[str, KaplanMeierFitter],
    fitter: CoxPHFitter | None,
    cox_was_fit: bool,
) -> pd.DataFrame:
    if outcome.horizon is None:
        return pd.DataFrame(columns=_PRED_COLUMNS)
    at_risk = work[work[outcome.event] == 0]
    if at_risk.empty:
        return pd.DataFrame(
            [{"Horizon": outcome.horizon, "NAtRisk": 0, "ExpectedExits": 0.0}],
            columns=_PRED_COLUMNS,
        )
    if cox_was_fit and fitter is not None:
        expected = _cox_expected_exits(fitter, work, outcome, design, at_risk)
    else:
        expected = _km_expected_exits(at_risk, outcome, km_fitters)
    return pd.DataFrame(
        [{"Horizon": float(outcome.horizon), "NAtRisk": int(len(at_risk)), "ExpectedExits": float(expected)}],
        columns=_PRED_COLUMNS,
    )


def _cox_expected_exits(
    fitter: CoxPHFitter,
    work: pd.DataFrame,
    outcome: Outcome,
    design: pd.DataFrame,
    at_risk: pd.DataFrame,
) -> float:
    time_col = work.attrs["time"]
    rows = design.loc[at_risk.index]
    lived = at_risk[time_col].to_numpy(dtype=float)
    survival = fitter.predict_survival_function(rows, times=[float(outcome.horizon)], conditional_after=lived)
    remaining = survival.iloc[0].to_numpy(dtype=float)
    return float(np.nansum(1.0 - remaining))


def _km_expected_exits(
    at_risk: pd.DataFrame, outcome: Outcome, km_fitters: dict[str, KaplanMeierFitter]
) -> float:
    total = 0.0
    horizon = float(outcome.horizon)
    if outcome.strata:
        names = at_risk[outcome.strata].astype(str)
    else:
        names = pd.Series("All", index=at_risk.index)
    for name, fitter in km_fitters.items():
        part = at_risk.loc[names == name, outcome.time]
        if part.empty:
            continue
        now = _step_survival(fitter, name, part.to_numpy(dtype=float))
        later = _step_survival(fitter, name, part.to_numpy(dtype=float) + horizon)
        with np.errstate(divide="ignore", invalid="ignore"):
            conditional = np.where(now > 0, later / now, np.nan)
        total += float(np.nansum(1.0 - conditional))
    return total


def _step_survival(fitter: KaplanMeierFitter, label: str, times: np.ndarray) -> np.ndarray:
    sf = fitter.survival_function_[label]
    index = sf.index.to_numpy(dtype=float)
    values = sf.to_numpy(dtype=float)
    pos = np.searchsorted(index, times, side="right") - 1
    out = np.ones(len(times), dtype=float)
    valid = pos >= 0
    out[valid] = values[pos[valid]]
    return out


def _measures(tables: dict[str, pd.DataFrame], summary: pd.DataFrame) -> dict[str, float]:
    metrics = tables["ModelMetrics"].iloc[0]
    measures: dict[str, float] = {}
    for name in _METRIC_COLUMNS:
        value = metrics[name]
        if pd.notna(value):
            measures[name] = float(value)
    prediction = tables["FactPrediction"]
    if not prediction.empty:
        row = prediction.iloc[0]
        for name in _PRED_COLUMNS:
            if pd.notna(row[name]):
                measures[name] = float(row[name])
    for _, row in summary.iterrows():
        if pd.isna(row["Median"]):
            continue
        measures[f"Median_{_token(row['Stratum'])}"] = float(row["Median"])
    return measures


def _token(value: object) -> str:
    text = "".join(ch if ch.isalnum() else "_" for ch in str(value)).strip("_")
    if not text or text[0].isdigit():
        text = f"S_{text}"
    return text


def _hash_tables(tables: dict[str, pd.DataFrame]) -> str:
    digest = hashlib.sha256()
    for name in TABLES:
        digest.update(name.encode())
        digest.update(tables[name].to_csv(index=False, na_rep="").encode())
    return digest.hexdigest()

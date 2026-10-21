"""Weekly demand forecast band for Logistics Pulse.

Reads FactDemandWeekly.csv → writes FactForecast.csv + ModelMetrics.csv
plus FactSeasonalDecomp.csv (trend / seasonal / remainder) and a three-panel
matplotlib PNG for catalogue #19.

Uses SARIMAX when available; falls back to seasonal-naive.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"
VERIFY = ROOT / "_verify"
HOLDOUT_WEEKS = 12
HORIZON_WEEKS = 8
SEASON = 52
# Match SARIMAX seasonal period used below (weekly series is short)
DECOMP_PERIOD = 12


def seasonal_naive_forecast(y: np.ndarray, horizon: int, season: int = SEASON):
    """Point forecast + crude PI from seasonal residual std."""
    if len(y) < season + 2:
        season = min(12, max(2, len(y) // 3))
    hist = y[-season:]
    reps = int(np.ceil(horizon / len(hist)))
    point = np.tile(hist, reps)[:horizon].astype(float)
    if len(y) > season:
        resid = y[season:] - y[:-season]
        sigma = float(np.std(resid, ddof=1)) if len(resid) > 1 else float(np.std(y))
    else:
        sigma = float(np.std(y)) if len(y) else 1.0
    sigma = max(sigma, 1.0)
    z80, z95 = 1.2816, 1.96
    return point, point - z80 * sigma, point + z80 * sigma, point - z95 * sigma, point + z95 * sigma, "seasonal-naive"


def sarimax_forecast(y: np.ndarray, horizon: int):
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX
    except ImportError:
        return None

    # Weekly series is short (~100 weeks) — keep seasonal period modest
    season = 12 if len(y) >= 40 else 0
    order = (1, 1, 1)
    seasonal_order = (1, 0, 1, season) if season else (0, 0, 0, 0)
    try:
        model = SARIMAX(
            y,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        fit = model.fit(disp=False, maxiter=200)
        pred = fit.get_forecast(steps=horizon)
        mean = np.asarray(pred.predicted_mean, dtype=float)
        ci80 = np.asarray(pred.conf_int(alpha=0.20))
        ci95 = np.asarray(pred.conf_int(alpha=0.05))
        return mean, ci80[:, 0], ci80[:, 1], ci95[:, 0], ci95[:, 1], "SARIMAX"
    except Exception as exc:  # noqa: BLE001 — fall back cleanly
        print(f"SARIMAX failed ({exc}); using seasonal-naive")
        return None


def mape(actual: np.ndarray, pred: np.ndarray) -> float:
    mask = actual != 0
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((actual[mask] - pred[mask]) / actual[mask])))


def coverage(actual: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> float:
    if len(actual) == 0:
        return float("nan")
    return float(np.mean((actual >= lo) & (actual <= hi)))


def seasonal_decomposition(
    weeks: pd.Series, y: np.ndarray, period: int = DECOMP_PERIOD
) -> tuple[pd.DataFrame, str]:
    """Trend / seasonal / remainder on the same stable window as the forecast.

    Prefer STL; fall back to classical seasonal_decompose; last resort: rolling
    trend + seasonal-mean residual split so gold always writes.
    """
    idx = pd.DatetimeIndex(pd.to_datetime(weeks))
    series = pd.Series(y, index=idx, name="Orders")
    method = "STL"

    try:
        from statsmodels.tsa.seasonal import STL

        stl = STL(series, period=period, robust=True)
        res = stl.fit()
        trend = np.asarray(res.trend, dtype=float)
        seasonal = np.asarray(res.seasonal, dtype=float)
        remainder = np.asarray(res.resid, dtype=float)
    except Exception as exc:  # noqa: BLE001
        print(f"STL failed ({exc}); trying seasonal_decompose")
        method = "seasonal_decompose"
        try:
            from statsmodels.tsa.seasonal import seasonal_decompose

            res = seasonal_decompose(series, model="additive", period=period, extrapolate_trend="freq")
            trend = np.asarray(res.trend, dtype=float)
            seasonal = np.asarray(res.seasonal, dtype=float)
            remainder = np.asarray(res.resid, dtype=float)
        except Exception as exc2:  # noqa: BLE001
            print(f"seasonal_decompose failed ({exc2}); using rolling split")
            method = "rolling-split"
            win = max(period, 3)
            trend = (
                pd.Series(y).rolling(win, center=True, min_periods=1).mean().to_numpy(dtype=float)
            )
            detrended = y - trend
            seasonal = np.zeros_like(y, dtype=float)
            for k in range(period):
                mask = np.arange(len(y)) % period == k
                seasonal[mask] = float(np.nanmean(detrended[mask])) if mask.any() else 0.0
            remainder = y - trend - seasonal

    frame = pd.DataFrame(
        {
            "WeekStart": idx.strftime("%Y-%m-%d"),
            "Observed": y.astype(float).round(1),
            "Trend": np.round(trend, 1),
            "Seasonal": np.round(seasonal, 1),
            "Remainder": np.round(remainder, 1),
        }
    )
    return frame, method


def write_decomp_figure(frame: pd.DataFrame, method: str, out_path: Path) -> None:
    """Three-panel matplotlib figure — catalogue #19 reference artifact."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed — skip decomp PNG")
        return

    x = pd.to_datetime(frame["WeekStart"])
    panels = [
        ("Observed", frame["Observed"], "#0F1C24"),
        ("Trend", frame["Trend"], "#2F5F73"),
        ("Seasonal", frame["Seasonal"], "#C17B3A"),
        ("Remainder", frame["Remainder"], "#4A6B5C"),
    ]
    # Catalogue asks for trend / season / remainder as three panels; keep Observed as a thin top context row
    fig, axes = plt.subplots(4, 1, figsize=(10, 7.2), sharex=True, gridspec_kw={"height_ratios": [1.1, 1, 1, 1]})
    fig.patch.set_facecolor("#F7F9FA")
    for ax, (label, vals, color) in zip(axes, panels):
        ax.plot(x, vals, color=color, lw=1.6)
        ax.fill_between(x, vals, 0 if label in ("Seasonal", "Remainder") else vals.min(), color=color, alpha=0.08)
        ax.set_ylabel(label, fontsize=9, color="#5A6B75")
        ax.tick_params(labelsize=8, colors="#5A6B75")
        ax.set_facecolor("#FFFFFF")
        for spine in ax.spines.values():
            spine.set_color("#E8EEF2")
        ax.grid(True, axis="y", color="#EEF2F5", lw=0.8)
    axes[0].set_title(
        f"Seasonal decomposition ({method}, period={DECOMP_PERIOD}) — not one collapsed line",
        fontsize=11,
        color="#0F1C24",
        pad=8,
    )
    axes[-1].set_xlabel("Week start", fontsize=9, color="#5A6B75")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=144, bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote {out_path}")


def main() -> None:
    weekly_path = GOLD / "FactDemandWeekly.csv"
    if not weekly_path.exists():
        raise FileNotFoundError(f"Missing {weekly_path} — run build-gold.py first")

    weekly = pd.read_csv(weekly_path, parse_dates=["WeekStart"]).sort_values("WeekStart")
    weekly = weekly[weekly["Orders"] > 0].reset_index(drop=True)

    # Drop early ramp: keep from first week that clears a volume floor and stays dense
    floor = max(200, int(weekly["Orders"].median() * 0.25))
    start_idx = 0
    for i, n in enumerate(weekly["Orders"]):
        if n >= floor:
            start_idx = i
            break
    weekly = weekly.iloc[start_idx:].reset_index(drop=True)

    # Drop trailing stub (Olist sample wind-down — last week is often ~100 orders)
    med = float(weekly["Orders"].median())
    while len(weekly) > HOLDOUT_WEEKS + 20 and weekly.iloc[-1]["Orders"] < 0.35 * med:
        weekly = weekly.iloc[:-1].reset_index(drop=True)

    if len(weekly) < HOLDOUT_WEEKS + 20:
        raise SystemExit(f"Not enough weeks ({len(weekly)}) for holdout forecast")
    print(
        f"Stable window: {weekly.iloc[0]['WeekStart'].date()} -> "
        f"{weekly.iloc[-1]['WeekStart'].date()} ({len(weekly)} weeks)"
    )

    y = weekly["Orders"].to_numpy(dtype=float)
    weeks = weekly["WeekStart"]

    train_y = y[:-HOLDOUT_WEEKS]
    hold_y = y[-HOLDOUT_WEEKS:]
    hold_weeks = weeks.iloc[-HOLDOUT_WEEKS:]

    # Holdout backtest
    bt = sarimax_forecast(train_y, HOLDOUT_WEEKS)
    if bt is None:
        bt = seasonal_naive_forecast(train_y, HOLDOUT_WEEKS)
    bt_mean, bt_lo80, bt_hi80, bt_lo95, bt_hi95, method_bt = bt
    # clip floors
    for arr in (bt_mean, bt_lo80, bt_hi80, bt_lo95, bt_hi95):
        np.maximum(arr, 0, out=arr)

    hold_mape = mape(hold_y, bt_mean)
    cov80 = coverage(hold_y, bt_lo80, bt_hi80)
    cov95 = coverage(hold_y, bt_lo95, bt_hi95)

    # Full-history forward forecast
    fwd = sarimax_forecast(y, HORIZON_WEEKS)
    if fwd is None:
        fwd = seasonal_naive_forecast(y, HORIZON_WEEKS)
    f_mean, f_lo80, f_hi80, f_lo95, f_hi95, method = fwd
    for arr in (f_mean, f_lo80, f_hi80, f_lo95, f_hi95):
        np.maximum(arr, 0, out=arr)

    last_week = weeks.iloc[-1]
    future_weeks = pd.date_range(last_week + pd.Timedelta(days=7), periods=HORIZON_WEEKS, freq="W-MON")
    # align to Monday week starts used by pandas period W-SUN start → often Monday
    # Use previous frequency from history
    step = (weeks.iloc[-1] - weeks.iloc[-2]) if len(weeks) > 1 else pd.Timedelta(days=7)
    future_weeks = [last_week + step * (i + 1) for i in range(HORIZON_WEEKS)]

    rows = []
    # History with in-sample actuals; attach backtest preds on holdout window
    hold_idx_start = len(weekly) - HOLDOUT_WEEKS
    for i, row in weekly.iterrows():
        rec = {
            "WeekStart": row["WeekStart"].strftime("%Y-%m-%d"),
            "Actual": int(row["Orders"]),
            "Forecast": np.nan,
            "Lo80": np.nan,
            "Hi80": np.nan,
            "Lo95": np.nan,
            "Hi95": np.nan,
            "BandWidth": np.nan,
            "IsFuture": 0,
        }
        if i >= hold_idx_start:
            j = i - hold_idx_start
            lo80 = float(bt_lo80[j])
            hi80 = float(bt_hi80[j])
            rec["Forecast"] = round(float(bt_mean[j]), 1)
            rec["Lo80"] = round(lo80, 1)
            rec["Hi80"] = round(hi80, 1)
            rec["Lo95"] = round(float(bt_lo95[j]), 1)
            rec["Hi95"] = round(float(bt_hi95[j]), 1)
            rec["BandWidth"] = round(max(hi80 - lo80, 0), 1)
        rows.append(rec)

    for j, w in enumerate(future_weeks):
        lo80 = float(f_lo80[j])
        hi80 = float(f_hi80[j])
        rows.append(
            {
                "WeekStart": pd.Timestamp(w).strftime("%Y-%m-%d"),
                "Actual": np.nan,
                "Forecast": round(float(f_mean[j]), 1),
                "Lo80": round(lo80, 1),
                "Hi80": round(hi80, 1),
                "Lo95": round(float(f_lo95[j]), 1),
                "Hi95": round(float(f_hi95[j]), 1),
                "BandWidth": round(max(hi80 - lo80, 0), 1),
                "IsFuture": 1,
            }
        )

    fact_fc = pd.DataFrame(rows)

    decomp, decomp_method = seasonal_decomposition(weeks, y, DECOMP_PERIOD)
    # Keep decomp on FactForecast (same WeekStart grain) so Desktop refresh
    # only needs existing-table columns — new TMDL tables get wiped on reopen.
    decomp_by_week = decomp.set_index("WeekStart")
    for col in ("Observed", "Trend", "Seasonal", "Remainder"):
        fact_fc[col] = fact_fc["WeekStart"].map(
            lambda w, c=col: float(decomp_by_week.loc[w, c]) if w in decomp_by_week.index else np.nan
        )
    fact_fc.to_csv(GOLD / "FactForecast.csv", index=False)
    decomp.to_csv(GOLD / "FactSeasonalDecomp.csv", index=False)
    write_decomp_figure(decomp, decomp_method, VERIFY / "seasonal-decomposition.png")

    metrics = pd.DataFrame(
        [
            {
                "HoldoutMAPE": round(hold_mape, 4),
                "Coverage80": round(cov80, 4),
                "Coverage95": round(cov95, 4),
                "Method": method,
                "DecompMethod": decomp_method,
                "DecompPeriod": DECOMP_PERIOD,
                "HorizonWeeks": HORIZON_WEEKS,
                "HoldoutWeeks": HOLDOUT_WEEKS,
                "SampleN": int(y.sum()),
                "WeekCount": int(len(y)),
            }
        ]
    )
    metrics.to_csv(GOLD / "ModelMetrics.csv", index=False)

    print(f"Method: {method} (backtest used {method_bt})")
    print(f"Holdout MAPE: {hold_mape:.1%}  Coverage80: {cov80:.1%}  Coverage95: {cov95:.1%}")
    print(f"FactForecast rows: {len(fact_fc)}  forward sum: {f_mean.sum():.0f}")
    print(f"Decomp rows: {len(decomp)}  method: {decomp_method}")
    print("Wrote FactForecast.csv (+ decomp cols) + FactSeasonalDecomp.csv + ModelMetrics.csv")


if __name__ == "__main__":
    main()

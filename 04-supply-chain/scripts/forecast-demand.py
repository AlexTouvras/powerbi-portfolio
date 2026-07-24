"""Weekly demand forecast band for Logistics Pulse.

Reads FactDemandWeekly.csv → writes FactForecast.csv + ModelMetrics.csv.
Uses SARIMAX when available; falls back to seasonal-naive.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"
HOLDOUT_WEEKS = 12
HORIZON_WEEKS = 8
SEASON = 52


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
    print(f"Stable window: {weekly.iloc[0]['WeekStart'].date()} → {weekly.iloc[-1]['WeekStart'].date()} ({len(weekly)} weeks)")

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
    fact_fc.to_csv(GOLD / "FactForecast.csv", index=False)

    metrics = pd.DataFrame(
        [
            {
                "HoldoutMAPE": round(hold_mape, 4),
                "Coverage80": round(cov80, 4),
                "Coverage95": round(cov95, 4),
                "Method": method,
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
    print("Wrote FactForecast.csv + ModelMetrics.csv")


if __name__ == "__main__":
    main()

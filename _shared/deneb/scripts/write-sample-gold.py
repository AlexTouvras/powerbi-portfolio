"""Write sample FactKm / FactCox / FactBetaT CSVs for Deneb binder dry-runs.

Uses the same synthetic draw as analytics_engine unit tests (seed=7).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from analytics_engine import Outcome, fit, release  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "sample"


def draw(n: int = 900, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    group = rng.choice(["A", "B"], size=n)
    x = rng.normal(size=n)
    hazard = np.exp(0.85 * (group == "B") + 0.45 * x)
    event_time = rng.exponential(1.0 / hazard)
    censor_time = rng.exponential(1.6, size=n)
    return pd.DataFrame(
        {
            "time": np.minimum(event_time, censor_time),
            "event": (event_time <= censor_time).astype(int),
            "group": group,
            "x": x,
        }
    )


def main() -> None:
    outcome = Outcome.duration(
        "time",
        "event",
        strata="group",
        covariates=("x",),
        horizon=0.5,
        reference={"group": "A"},
    )
    result = release(fit(draw(), outcome))
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("FactKm", "FactCox", "FactBetaT", "FactPh", "StratumSummary"):
        path = OUT / f"{name}.csv"
        result.tables[name].to_csv(path, index=False)
        print(f"{name} rows={len(result.tables[name])} -> {path}")


if __name__ == "__main__":
    main()

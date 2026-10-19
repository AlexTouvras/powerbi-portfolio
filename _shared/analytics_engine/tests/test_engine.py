"""The engine is tested on draws made in the test, not on a portfolio dataset."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from analytics_engine import CitationError, Outcome, RouteError, cite, fit, read_fit, release, render, route
from analytics_engine.fit import approval_matches, hash_directory, write_fit
from analytics_engine.__main__ import main


def _draw(n: int = 900, seed: int = 7) -> pd.DataFrame:
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


def _outcome() -> Outcome:
    return Outcome.duration(
        time="time",
        event="event",
        strata="group",
        covariates=("x",),
        horizon=0.5,
        reference={"group": "A"},
    )


def test_router_keeps_label_and_series_off_this_fitter():
    assert route(Outcome.duration("time", "event")) == "duration"
    assert route(Outcome.label("Readmit30")) == "label"
    assert route(Outcome.series("week", "orders")) == "series"
    with pytest.raises(RouteError):
        fit(pd.DataFrame({"Readmit30": [0, 1]}), Outcome.label("Readmit30"))


def test_duration_fit_matches_the_draw_and_refuses_a_draft():
    result = fit(_draw(), _outcome())
    assert result.released is False
    with pytest.raises(CitationError):
        cite("Concordance {Concordance}.", result)

    released = release(result)
    group = released.tables["FactCox"].set_index("Term").loc["group[B]"]
    score = released.tables["FactCox"].set_index("Term").loc["x"]
    assert group["HazardRatio"] > 1.4
    assert group["Lo"] > 1
    assert score["HazardRatio"] > 1.1
    assert 0.5 < released.measures["Concordance"] < 0.9
    assert released.measures["LogRankP"] < 0.01

    curve = released.tables["FactKm"]
    for _, part in curve.groupby("Stratum"):
        ordered = part.sort_values("Time")
        assert ordered["Survival"].is_monotonic_decreasing
        assert (ordered["Lo"] <= ordered["Survival"] + 1e-9).all()
        assert (ordered["Survival"] <= ordered["Hi"] + 1e-9).all()
        assert ordered["NRisk"].is_monotonic_decreasing

    ph = released.tables["FactPh"]
    assert set(ph["Verdict"]) <= {"holds", "changes"}
    assert set(ph["TimeTransform"]) == {"km"}
    assert not released.tables["FactBetaT"].empty
    assert set(released.tables["FactBetaT"]["Kind"]) == {"residual", "smooth"}

    sentence = cite(
        "Of {N} rows, concordance {Concordance}. Of the {NAtRisk} still at risk, about {ExpectedExits} exit within {Horizon}.",
        released,
    )
    assert "concordance" in sentence
    assert released.measures["NAtRisk"] == int((_draw()["event"] == 0).sum())
    with pytest.raises(CitationError):
        cite("The answer is {MadeUp}.", released)


def test_missing_column_and_bad_event_fail_before_a_figure():
    frame = _draw(n=40)
    with pytest.raises(ValueError, match="columns not in the table"):
        fit(frame, Outcome.duration("time", "event", covariates=("nope",)))
    broken = frame.copy()
    broken["event"] = 2
    with pytest.raises(ValueError, match="0 or 1"):
        fit(broken, Outcome.duration("time", "event"))


def test_approval_hash_gates_the_files(tmp_path: Path):
    directory = tmp_path / "fit"
    result = fit(_draw(n=200, seed=3), _outcome())
    write_fit(result, directory)
    assert hash_directory(directory) == (directory / "fit_hash.txt").read_text().strip()
    assert approval_matches(directory) is False
    loaded = read_fit(directory)
    assert loaded.released is False
    assert loaded.measures["N"] == 200

    (directory / "APPROVED").write_text("not-the-hash\n", encoding="utf-8")
    assert approval_matches(directory) is False
    (directory / "APPROVED").write_text((directory / "fit_hash.txt").read_text(), encoding="utf-8")
    assert approval_matches(directory) is True

    released = release(loaded)
    written = render(released, tmp_path / "figures")
    for name in ("kaplan-meier", "forest", "beta-time"):
        blob = written[name].read_bytes()
        assert blob.startswith(b"\x89PNG")
        assert len(blob) > 8_000
    with pytest.raises(CitationError):
        render(loaded, tmp_path / "nope")


def test_cli_cannot_approve(tmp_path: Path):
    frame = _draw(n=180, seed=5)
    csv_path = tmp_path / "rows.csv"
    frame.to_csv(csv_path, index=False)
    out = tmp_path / "draft"
    assert (
        main(
            [
                "fit",
                "--csv",
                str(csv_path),
                "--time",
                "time",
                "--event",
                "event",
                "--strata",
                "group",
                "--covariates",
                "x",
                "--horizon",
                "0.4",
                "--reference",
                "group=A",
                "--out",
                str(out),
            ]
        )
        == 0
    )
    assert not (out / "APPROVED").exists()
    assert main(["render", "--fit", str(out), "--out", str(tmp_path / "fig")]) == 2
    assert main(["cite", "--fit", str(out), "--template", "N = {N}."]) == 2
    (out / "APPROVED").write_text((out / "fit_hash.txt").read_text(), encoding="utf-8")
    figures = tmp_path / "fig"
    assert main(["render", "--fit", str(out), "--out", str(figures)]) == 0
    assert (figures / "kaplan-meier.png").is_file()
    assert main(["cite", "--fit", str(out), "--template", "N = {N}."]) == 0
    assert main(["route", "--kind", "label", "--label", "flag"]) == 0
    assert main(["route", "--kind", "series", "--time", "week", "--value", "orders"]) == 0

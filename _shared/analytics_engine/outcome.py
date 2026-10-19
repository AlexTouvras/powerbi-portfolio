"""What question a table is allowed to answer."""

from __future__ import annotations

from dataclasses import dataclass, field


class RouteError(ValueError):
    """The outcome is real, and this engine is not its fitter."""


@dataclass(frozen=True)
class Outcome:
    """Column contract. Names are the caller's; the engine has no dataset of its own."""

    kind: str
    time: str | None = None
    event: str | None = None
    label: str | None = None
    series_time: str | None = None
    series_value: str | None = None
    strata: str | None = None
    covariates: tuple[str, ...] = ()
    horizon: float | None = None
    reference: dict[str, str] = field(default_factory=dict)

    @staticmethod
    def duration(
        time: str,
        event: str,
        strata: str | None = None,
        covariates: tuple[str, ...] | list[str] = (),
        horizon: float | None = None,
        reference: dict[str, str] | None = None,
    ) -> Outcome:
        return Outcome(
            kind="duration",
            time=time,
            event=event,
            strata=strata,
            covariates=tuple(covariates),
            horizon=horizon,
            reference=dict(reference or {}),
        )

    @staticmethod
    def label(label: str) -> Outcome:
        return Outcome(kind="label", label=label)

    @staticmethod
    def series(time: str, value: str) -> Outcome:
        return Outcome(kind="series", series_time=time, series_value=value)


def route(outcome: Outcome) -> str:
    """Return ``duration``, ``label``, or ``series``.

    ``duration`` is fit here. A fixed-horizon label stays on the logistic
    scripts. One measured series stays on SARIMAX.
    """

    if outcome.kind == "duration":
        if not outcome.time or not outcome.event:
            raise ValueError("a duration outcome needs a time column and an event column")
        if outcome.horizon is not None and outcome.horizon <= 0:
            raise ValueError("horizon must be positive")
        return "duration"
    if outcome.kind == "label":
        if not outcome.label:
            raise ValueError("a label outcome needs a label column")
        return "label"
    if outcome.kind == "series":
        if not outcome.series_time or not outcome.series_value:
            raise ValueError("a series outcome needs a time column and a value column")
        return "series"
    raise ValueError(f"unknown outcome kind {outcome.kind!r}")

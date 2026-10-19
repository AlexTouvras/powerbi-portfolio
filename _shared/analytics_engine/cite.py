"""Sentences may quote a released fit, and nothing else."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Mapping

if TYPE_CHECKING:
    from analytics_engine.fit import FitResult

_TOKEN = re.compile(r"\{([A-Za-z][A-Za-z0-9_]*)\}")

_COUNTS = {"N", "Events", "NCensored", "NAtRisk"}
_PVALUES = {"LogRankP"}


class CitationError(KeyError):
    """A sentence named a measure the fit did not produce, or the fit is still a draft."""


def format_measure(name: str, value: float) -> str:
    if name in _COUNTS or name == "ExpectedExits":
        return f"{value:,.0f}".replace(",", " ")
    if name in _PVALUES or name.endswith("P"):
        if value < 0.001:
            return f"{value:.2e}"
        return f"{value:.3f}"
    if name == "Concordance":
        return f"{value:.2f}"
    if float(value).is_integer() and abs(value) >= 1000:
        return f"{value:,.0f}".replace(",", " ")
    return f"{value:.4g}"


def cite(template: str, result: FitResult) -> str:
    """Fill ``{Measure}`` slots from a released fit.

    An unknown name raises :class:`CitationError`. A draft raises before any
    number is formatted, so a prompt cannot invent a concordance or an
    expected-exit count.
    """

    if not result.released:
        raise CitationError("a draft fit cannot be cited; release it after approval")
    names = set(_TOKEN.findall(template))
    available: Mapping[str, float] = result.measures
    missing = sorted(names - available.keys())
    if missing:
        known = ", ".join(sorted(available)) or "(none)"
        raise CitationError(f"unknown measure {missing}; the fit produced {known}")
    return _TOKEN.sub(lambda m: format_measure(m.group(1), available[m.group(1)]), template)

"""Duration analytics engine.

A caller supplies a table and an :class:`Outcome`. The engine fits Kaplan–Meier
and a Cox model, tests proportional hazards, and writes the tables an argument
page is allowed to quote. It does not ship a dataset.

``fit`` returns a draft. ``cite`` and ``render`` refuse a draft. The command
line cannot approve a fit: a person copies ``fit_hash.txt`` into ``APPROVED``.
"""

from analytics_engine.cite import CitationError, cite
from analytics_engine.fit import FitResult, fit, read_fit, release, write_fit
from analytics_engine.figures import render
from analytics_engine.outcome import Outcome, RouteError, route

__all__ = [
    "CitationError",
    "FitResult",
    "Outcome",
    "RouteError",
    "cite",
    "fit",
    "read_fit",
    "release",
    "render",
    "route",
    "write_fit",
]

"""Command line for the duration engine.

``fit`` writes a draft and the hash. It never writes ``APPROVED``.
``render`` and ``cite`` run only when ``APPROVED`` contains that hash.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from analytics_engine.cite import CitationError, cite
from analytics_engine.fit import approval_matches, fit, read_fit, release, write_fit
from analytics_engine.figures import render
from analytics_engine.outcome import Outcome, RouteError, route


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="analytics_engine")
    commands = parser.add_subparsers(dest="command", required=True)

    routed = commands.add_parser("route", help="classify an outcome; fit nothing")
    routed.add_argument("--kind", required=True, choices=("duration", "label", "series"))
    routed.add_argument("--time")
    routed.add_argument("--event")
    routed.add_argument("--label")
    routed.add_argument("--value")

    fitted = commands.add_parser("fit", help="fit a duration table to a draft directory")
    fitted.add_argument("--csv", required=True, type=Path)
    fitted.add_argument("--time", required=True)
    fitted.add_argument("--event", required=True)
    fitted.add_argument("--strata")
    fitted.add_argument("--covariates", default="")
    fitted.add_argument("--horizon", type=float)
    fitted.add_argument("--reference", action="append", default=[])
    fitted.add_argument("--out", required=True, type=Path)

    cited = commands.add_parser("cite", help="fill a sentence from an approved fit")
    cited.add_argument("--fit", required=True, type=Path)
    cited.add_argument("--template", required=True)

    drawn = commands.add_parser("render", help="draw figures from an approved fit")
    drawn.add_argument("--fit", required=True, type=Path)
    drawn.add_argument("--out", required=True, type=Path)

    args = parser.parse_args(argv)
    try:
        if args.command == "route":
            print(route(_outcome_from_route(args)))
            return 0
        if args.command == "fit":
            frame = pd.read_csv(args.csv)
            outcome = Outcome.duration(
                time=args.time,
                event=args.event,
                strata=args.strata,
                covariates=tuple(c for c in args.covariates.split(",") if c),
                horizon=args.horizon,
                reference=_references(args.reference),
            )
            write_fit(fit(frame, outcome), args.out)
            print(f"draft {args.out}  hash {(args.out / 'fit_hash.txt').read_text().strip()}")
            return 0
        if args.command == "cite":
            result = _approved(args.fit)
            print(cite(args.template, result))
            return 0
        result = _approved(args.fit)
        written = render(result, args.out)
        for name, path in written.items():
            print(f"{name} {path}")
        return 0
    except (CitationError, RouteError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


def _approved(directory: Path):
    if not approval_matches(directory):
        raise ValueError(
            "this fit is still a draft; APPROVED must contain the hash in fit_hash.txt, "
            "and the tables must be unchanged since that approval"
        )
    return release(read_fit(directory))


def _outcome_from_route(args: argparse.Namespace) -> Outcome:
    if args.kind == "duration":
        return Outcome.duration(time=args.time or "", event=args.event or "")
    if args.kind == "label":
        return Outcome.label(args.label or "")
    return Outcome.series(time=args.time or "", value=args.value or "")


def _references(pairs: list[str]) -> dict[str, str]:
    reference: dict[str, str] = {}
    for pair in pairs:
        if "=" not in pair:
            raise ValueError(f"reference must be column=level, got {pair!r}")
        column, level = pair.split("=", 1)
        reference[column] = level
    return reference


if __name__ == "__main__":
    raise SystemExit(main())

"""Minimal JARVIS Debug smoke for the Power BI portfolio."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_DIRS = [
    "01-finance",
    "02-ecommerce-churn",
    "03-sales-executive",
    "05-bank-segmentation",
    "06-healthcare-analytics",
    "docs/architecture",
]

REQUIRED_PBIPS = [
    "01-finance/NordicEquity.pbip",
    "02-ecommerce-churn/ChurnRetention.pbip",
    "03-sales-executive/SalesExecutive.pbip",
    "05-bank-segmentation/BankValue.pbip",
    "06-healthcare-analytics/CarePulse.pbip",
]


def main() -> int:
    missing: list[str] = []
    for rel in REQUIRED_DIRS:
        if not (ROOT / rel).is_dir():
            missing.append(f"dir:{rel}")
    for rel in REQUIRED_PBIPS:
        if not (ROOT / rel).is_file():
            missing.append(f"pbip:{rel}")
    if missing:
        print("FAIL", *missing, sep="\n  ")
        return 1
    print("ok portfolio smoke", len(REQUIRED_PBIPS), "pbips")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

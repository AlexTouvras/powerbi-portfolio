# Raw sources — Study Duration

Not committed. `scripts/build-gold.py` downloads anything missing.

| File | Source | Licence |
|------|--------|---------|
| `courses.parquet`, `studentInfo.parquet`, `studentRegistration.parquet` | Open University Learning Analytics Dataset, via the [data-edu/oulad](https://github.com/data-edu/oulad) parquet mirror | CC BY 4.0. Cite Kuzilek, Hlosta, and Zdrahal, Scientific Data 4:170171, 2017. |

The official download button on the OU page had no link on 2026-10-20, so this build uses that mirror of the same tables. `courses.length` is named `module_presentation_length` there. The click log (`studentVle`) is not in this grain.

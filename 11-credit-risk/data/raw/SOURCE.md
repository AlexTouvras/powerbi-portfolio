# Credit risk — raw sources (scorecard)

## Primary (locked): Home Credit Default Risk

**Most widely used modern consumer dataset for PD scorecards** (WoE/IV, logistic points, OOT validation, PSI monitoring).

| | |
|--|--|
| Competition | [Home Credit Default Risk](https://www.kaggle.com/c/home-credit-default-risk) |
| Scale | ~307,511 applications · ~8% default (`TARGET`) |
| Why this one | Multi-table customer + bureau + previous apps — matches real retail scorecard work better than tiny academic sets |

## Download (prefer Kaggle; HF mirror used when CLI unavailable)

```powershell
# Option A — Kaggle (official)
cd 11-credit-risk/data/raw
kaggle competitions download -c home-credit-default-risk
Expand-Archive home-credit-default-risk.zip -DestinationPath .

# Option B — Hugging Face mirror (no Kaggle key)
cd 11-credit-risk
.\.venv\Scripts\python.exe scripts\download-homecredit.py
# writes data/raw/_hf/application_train_dated/*.parquet + bureau/*.parquet
```

Minimum for v1 scorecard gold:

| File | Role |
|------|------|
| `application_train.csv` | Applicant features + `TARGET` |
| `bureau.csv` | External credit history (aggregate to applicant) |
| `previous_application.csv` | Prior HC apps (optional enrichment) |

Full competition also ships `bureau_balance`, `POS_CASH_balance`, `installments_payments`, `credit_card_balance`, `application_test` — stage later if needed.

## Alternatives considered

| Dataset | Verdict |
|---------|---------|
| [Give Me Some Credit](https://www.kaggle.com/c/GiveMeSomeCredit) | Very common for *simple* scorecard tutorials; single flat table — weaker portfolio story |
| [UCI German Credit](https://archive.ics.uci.edu/dataset/144/statlog+german+credit+data) | Academic classic; only 1,000 rows — too small for monitoring/PSI demos |
| Lending Club | Better for **portfolio PD/ECL / vintage** than application scorecards |

## License / caveats

- Kaggle competition data — follow competition rules; **do not redistribute raw dumps in git**
- Portfolio scores are **sample models**, not production IRB / IFRS 9 systems

"""LightGBM PD champion + calibrated probabilities + monitoring artefacts.

Cut-off setting follows risk–reward guidelines:
- Primary: maximise OOT approval subject to bad rate among approved ≤ budgeted appetite
- Supporting: Youden / max KS on train ROC (reference only)
- PSI monitors model inputs only (not PD / Score / Grade)
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
GOLD = ROOT / "data" / "gold"
MODEL_DIR = GOLD / "models"
FULL = GOLD / "_full_features.parquet"
SAMPLE_N = 80_000
# Illustrative annual risk appetite for newly booked volume (bad rate among approved).
# Primary cut-off rule (risk–reward): maximise approval subject to BadRateApproved ≤ this.
BUDGETED_BAD_RATE = 0.04

NUM_FEATURES = [
    "EXT_SOURCE_1",
    "EXT_SOURCE_2",
    "EXT_SOURCE_3",
    "EXT_MEAN",
    "EXT_MIN",
    "AgeYears",
    "EmploymentYears",
    "AMT_INCOME_TOTAL",
    "AMT_CREDIT",
    "AMT_ANNUITY",
    "AMT_GOODS_PRICE",
    "CreditIncomeRatio",
    "AnnuityIncomeRatio",
    "GOODS_CREDIT_RATIO",
    "CNT_CHILDREN",
    "CNT_FAM_MEMBERS",
    "REGION_RATING_CLIENT",
    "REGION_RATING_CLIENT_W_CITY",
    "REGION_POPULATION_RELATIVE",
    "DAYS_REGISTRATION",
    "DAYS_ID_PUBLISH",
    "DAYS_LAST_PHONE_CHANGE",
    "OWN_CAR_AGE",
    "HOUR_APPR_PROCESS_START",
    "AMT_REQ_CREDIT_BUREAU_YEAR",
    "AMT_REQ_CREDIT_BUREAU_QRT",
    "AMT_REQ_CREDIT_BUREAU_MON",
    "BUR_CNT",
    "BUR_AMT_CREDIT_SUM",
    "BUR_AMT_CREDIT_SUM_MEAN",
    "BUR_AMT_CREDIT_SUM_DEBT",
    "BUR_AMT_CREDIT_SUM_OVERDUE",
    "BUR_DAYS_CREDIT_MEAN",
    "BUR_CREDIT_DAY_OVERDUE_MAX",
    "BUR_ACTIVE_CNT",
    "PREV_CNT",
    "PREV_AMT_APPLICATION",
    "PREV_AMT_CREDIT",
    "PREV_AMT_DOWN_PAYMENT",
    "PREV_DAYS_DECISION",
    "PREV_CNT_PAYMENT",
    "PREV_REFUSED_RATE",
    "PREV_APPROVED_RATE",
    "INST_CNT",
    "INST_PAY_DIFF_MEAN",
    "INST_DELAY_MEAN",
    "INST_DELAY_MAX",
    "INST_AMT_PAYMENT_SUM",
]
CAT_FEATURES = [
    "NAME_CONTRACT_TYPE",
    "CODE_GENDER",
    "NAME_INCOME_TYPE",
    "NAME_EDUCATION_TYPE",
    "NAME_FAMILY_STATUS",
    "NAME_HOUSING_TYPE",
    "OCCUPATION_TYPE",
    "ORGANIZATION_TYPE",
    "FLAG_OWN_CAR",
    "FLAG_OWN_REALTY",
    "WEEKDAY_APPR_PROCESS_START",
]


def ks_stat(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    df = pd.DataFrame({"y": y_true, "p": y_prob}).sort_values("p")
    n1 = max(int((df["y"] == 1).sum()), 1)
    n0 = max(int((df["y"] == 0).sum()), 1)
    df["cum1"] = (df["y"] == 1).cumsum() / n1
    df["cum0"] = (df["y"] == 0).cumsum() / n0
    return float((df["cum1"] - df["cum0"]).abs().max())


def pd_to_grade(pd_s: pd.Series) -> tuple[pd.Series, pd.Series]:
    # G1 = riskiest (high PD), G8 = safest
    edges = [-np.inf, 0.02, 0.035, 0.05, 0.07, 0.10, 0.15, 0.25, np.inf]
    labels = ["G8", "G7", "G6", "G5", "G4", "G3", "G2", "G1"]
    grade = pd.cut(pd_s, bins=edges, labels=labels)
    sort_map = {g: i + 1 for i, g in enumerate(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"])}
    return grade.astype(str), grade.astype(str).map(sort_map).fillna(0).astype(int)


def risk_band(pd_s: pd.Series) -> pd.Series:
    return pd.cut(
        pd_s, bins=[-np.inf, 0.05, 0.12, np.inf], labels=["Low", "Medium", "High"]
    ).astype(str)


def psi_numeric(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    e = expected.dropna()
    a = actual.dropna()
    if len(e) < 100 or len(a) < 100:
        return 0.0
    qs = np.unique(np.quantile(e, np.linspace(0, 1, bins + 1)))
    if len(qs) < 3:
        return 0.0
    e_cnt = pd.cut(e, bins=qs, include_lowest=True).value_counts(normalize=True).sort_index()
    a_cnt = pd.cut(a, bins=qs, include_lowest=True).value_counts(normalize=True).sort_index()
    aligned = pd.DataFrame({"e": e_cnt, "a": a_cnt}).fillna(1e-4)
    return float(((aligned["a"] - aligned["e"]) * np.log(aligned["a"] / aligned["e"])).sum())


def psi_categorical(expected: pd.Series, actual: pd.Series) -> float:
    e = expected.fillna("Missing").astype(str)
    a = actual.fillna("Missing").astype(str)
    e_p = e.value_counts(normalize=True)
    a_p = a.value_counts(normalize=True)
    idx = sorted(set(e_p.index) | set(a_p.index))
    ep = e_p.reindex(idx).fillna(1e-4)
    ap = a_p.reindex(idx).fillna(1e-4)
    return float(((ap - ep) * np.log(ap / ep)).sum())


def stability_flag(psi: float) -> str:
    if psi >= 0.25:
        return "Breach"
    if psi >= 0.10:
        return "Watch"
    return "Stable"


def recommended_action(row: pd.Series, cutoff: float) -> str:
    if row["Decision"] == "Reject":
        return "Reject — above operating cut-off"
    if row["PD"] >= cutoff * 0.9 and row["RiskBand"] == "High":
        return "Review — near cut-off / high band"
    if row["Grade"] in {"G1", "G2"}:
        return "Watch — riskiest grades"
    overdue = row.get("BUR_AMT_CREDIT_SUM_OVERDUE", 0) or 0
    if overdue > 0 and row["PD"] > 0.08:
        return "Review — bureau overdue present"
    if row.get("PREV_REFUSED_RATE", 0) and row["PREV_REFUSED_RATE"] > 0.4:
        return "Review — prior refusals elevated"
    if row["RiskBand"] == "High":
        return "Review — high risk band"
    return "Approve — within policy"


def univariate_iv_rows(df: pd.DataFrame, y: pd.Series, train_mask: pd.Series) -> list[dict]:
    rows: list[dict] = []
    yt = y.loc[train_mask]

    def add_numeric(col: str) -> None:
        if col not in df.columns:
            return
        tmp = pd.DataFrame({"x": df.loc[train_mask, col], "y": yt})
        tmp["x"] = tmp["x"].fillna(tmp["x"].median() if tmp["x"].notna().any() else 0)
        try:
            tmp["bin"] = pd.qcut(tmp["x"], q=5, duplicates="drop")
        except ValueError:
            return
        g = tmp.groupby("bin", observed=True)["y"].agg(["count", "sum"])
        g = g.rename(columns={"count": "n", "sum": "bads"})
        g["goods"] = g["n"] - g["bads"]
        tot_b = max(g["bads"].sum(), 1)
        tot_g = max(g["goods"].sum(), 1)
        g["bad_rate"] = g["bads"] / g["n"].clip(lower=1)
        g["dist_bad"] = g["bads"] / tot_b
        g["dist_good"] = g["goods"] / tot_g
        g["woe"] = np.log((g["dist_good"] + 1e-6) / (g["dist_bad"] + 1e-6))
        g["iv"] = (g["dist_good"] - g["dist_bad"]) * g["woe"]
        iv_tot = float(g["iv"].sum())
        for bin_label, r in g.iterrows():
            rows.append(
                {
                    "Feature": col,
                    "Bin": str(bin_label),
                    "WoE": float(r["woe"]),
                    "IV": iv_tot,
                    "N": int(r["n"]),
                    "BadRate": float(r["bad_rate"]),
                    "Points": int(round(-r["woe"] * 20 + 50)),
                }
            )

    for c in [
        "EXT_SOURCE_2",
        "EXT_SOURCE_3",
        "EXT_MEAN",
        "AgeYears",
        "CreditIncomeRatio",
        "PREV_REFUSED_RATE",
        "INST_DELAY_MEAN",
        "BUR_AMT_CREDIT_SUM_OVERDUE",
    ]:
        add_numeric(c)
    return rows


def main() -> None:
    df = pd.read_parquet(FULL)
    df["application_date"] = pd.to_datetime(df["application_date"])
    df = df.sort_values("application_date").reset_index(drop=True)
    y = df["TARGET"].astype(int)

    num = [c for c in NUM_FEATURES if c in df.columns]
    cat = [c for c in CAT_FEATURES if c in df.columns]
    X = df[num + cat].copy()
    for c in cat:
        X[c] = X[c].fillna("Missing").astype("category")

    cut_date = df["application_date"].quantile(0.80)
    oot_mask = df["application_date"] > cut_date
    dev_mask = ~oot_mask

    # Development window → Train (fit) vs Test (same-period holdout); OOT is time holdout
    dev_idx = df.index[dev_mask].to_numpy()
    train_idx, test_idx = train_test_split(
        dev_idx,
        test_size=0.20,
        stratify=y.loc[dev_idx],
        random_state=42,
    )
    train_mask = pd.Series(False, index=df.index)
    test_mask = pd.Series(False, index=df.index)
    train_mask.loc[train_idx] = True
    test_mask.loc[test_idx] = True

    # LightGBM on train; early stop on internal validation slice of train (not Test, not OOT)
    X_tr, X_val, y_tr, y_val = train_test_split(
        X.loc[train_mask],
        y.loc[train_mask],
        test_size=0.15,
        stratify=y.loc[train_mask],
        random_state=42,
    )
    dtrain = lgb.Dataset(X_tr, label=y_tr, categorical_feature=cat)
    dval = lgb.Dataset(X_val, label=y_val, reference=dtrain, categorical_feature=cat)
    params = dict(
        objective="binary",
        metric="auc",
        learning_rate=0.03,
        num_leaves=48,
        min_data_in_leaf=80,
        feature_fraction=0.85,
        bagging_fraction=0.85,
        bagging_freq=1,
        verbosity=-1,
        seed=42,
    )
    bst = lgb.train(
        params,
        dtrain,
        num_boost_round=1000,
        valid_sets=[dval],
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)],
    )
    raw = bst.predict(X, num_iteration=bst.best_iteration)

    # Platt calibration on train validation fold only (never Test / OOT)
    cal = LogisticRegression(max_iter=1000)
    cal.fit(bst.predict(X_val, num_iteration=bst.best_iteration).reshape(-1, 1), y_val)
    proba = cal.predict_proba(raw.reshape(-1, 1))[:, 1]

    def sample_metrics(mask: pd.Series) -> tuple[float, float, float, int]:
        y_s = y.loc[mask].to_numpy()
        p_s = proba[mask.to_numpy()]
        auc = float(roc_auc_score(y_s, p_s))
        gini = 2 * auc - 1
        # Prefer raw ranking if slightly better (discrimination; calibration separate)
        gini_raw = 2 * float(roc_auc_score(y_s, raw[mask.to_numpy()])) - 1
        gini = float(max(gini, gini_raw))
        auc = (gini + 1) / 2
        return auc, gini, float(ks_stat(y_s, p_s)), int(mask.sum())

    auc_train, gini_train, ks_train, n_train = sample_metrics(train_mask)
    auc_test, gini_test, ks_test, n_test = sample_metrics(test_mask)
    auc_oot, gini_oot, ks_oot, n_oot = sample_metrics(oot_mask)
    brier_oot = brier_score_loss(y.loc[oot_mask], proba[oot_mask.to_numpy()])
    brier_test = brier_score_loss(y.loc[test_mask], proba[test_mask.to_numpy()])

    # --- Cut-off setting (Guidelines on optimal cut-off) ---
    # Primary: risk–reward vs budgeted bad rate (risk appetite).
    # Supporting: Youden / max KS on train ROC (same threshold for a single score).
    fpr_tr, tpr_tr, thr_tr = roc_curve(y.loc[train_mask], proba[train_mask.to_numpy()])
    youden_idx = int(np.argmax(tpr_tr - fpr_tr))
    youden_pd = float(thr_tr[youden_idx]) if youden_idx < len(thr_tr) else float(np.quantile(proba[train_mask.to_numpy()], 0.85))
    if not np.isfinite(youden_pd) or youden_pd <= 0 or youden_pd >= 1:
        youden_pd = float(np.quantile(proba[train_mask.to_numpy()], 0.80))

    oot_pd = proba[oot_mask.to_numpy()]
    oot_y = y.loc[oot_mask].to_numpy()
    cut_rows = []
    for t in np.round(np.linspace(0.02, 0.40, 77), 3):
        approve = oot_pd <= t
        n_app = int(approve.sum())
        approval_rate = float(approve.mean())
        bad_rate = float(oot_y[approve].mean()) if n_app else np.nan
        cut_rows.append(
            {
                "CutoffPD": float(t),
                "CutoffScore": int(round(850 - float(t) * 550)),
                "ApprovalRate": approval_rate,
                "BadRateApproved": bad_rate,
                "RejectRate": 1.0 - approval_rate,
                "ApprovedN": n_app,
                "MarginalPD": float(t),
            }
        )
    cutoff_df = pd.DataFrame(cut_rows)
    eligible = cutoff_df[cutoff_df["BadRateApproved"].notna() & (cutoff_df["BadRateApproved"] <= BUDGETED_BAD_RATE)]
    if len(eligible):
        # Maximise new-business volume (approval) while staying within risk appetite
        op_row = eligible.loc[eligible["ApprovalRate"].idxmax()]
    else:
        # If appetite is tighter than every simulated point, take the lowest bad-rate cut
        op_row = cutoff_df.loc[cutoff_df["BadRateApproved"].idxmin()]
    cutoff = float(op_row["CutoffPD"])
    youden_row = cutoff_df.iloc[(cutoff_df["CutoffPD"] - youden_pd).abs().argmin()]
    cutoff_df["IsOperatingCutoff"] = (cutoff_df["CutoffPD"] == cutoff).astype(int)
    cutoff_df["IsYoudenCutoff"] = (cutoff_df["CutoffPD"] == float(youden_row["CutoffPD"])).astype(int)
    cutoff_df["BudgetedBadRate"] = BUDGETED_BAD_RATE
    cutoff_df.to_csv(GOLD / "FactCutoffCurve.csv", index=False)

    # Frontier chart (guide-style): cumulative approval (x) vs bad rate among approved (y)
    # New scorecard = calibrated PD; Existing = Home Credit EXT_MEAN (higher = safer).
    def acceptance_frontier(y_arr: np.ndarray, risk: np.ndarray, scorecard: str, n_grid: int = 120) -> pd.DataFrame:
        mask = np.isfinite(risk) & np.isfinite(y_arr)
        y_m, r_m = y_arr[mask], risk[mask]
        order = np.argsort(r_m)  # best (lowest risk) first
        y_ord = y_m[order]
        n = len(y_ord)
        if n == 0:
            return pd.DataFrame(columns=["Scorecard", "ApprovalRate", "BadRateApproved", "PointSort"])
        ks = np.unique(np.clip(np.round(np.linspace(max(1, int(0.03 * n)), n, n_grid)).astype(int), 1, n))
        cum = np.cumsum(y_ord)
        rows = []
        for i, k in enumerate(ks):
            rows.append(
                {
                    "Scorecard": scorecard,
                    "ApprovalRate": float(k / n),
                    "BadRateApproved": float(cum[k - 1] / k),
                    "PointSort": int(i),
                }
            )
        return pd.DataFrame(rows)

    oot_ext = df.loc[oot_mask, "EXT_MEAN"].to_numpy(dtype=float)
    frontier_new = acceptance_frontier(oot_y, oot_pd, "New scorecard")
    frontier_old = acceptance_frontier(oot_y, -oot_ext, "Existing score (EXT_MEAN)")  # higher EXT → lower risk
    budget_x = np.linspace(0.05, 1.0, 40)
    frontier_budget = pd.DataFrame(
        {
            "Scorecard": "Budget",
            "ApprovalRate": budget_x,
            "BadRateApproved": BUDGETED_BAD_RATE,
            "PointSort": np.arange(len(budget_x)),
        }
    )
    cutoff_long = pd.concat([frontier_old, frontier_new, frontier_budget], ignore_index=True)
    cutoff_long.to_csv(GOLD / "FactCutoffLong.csv", index=False)

    def policy_row(method: str, role: str, method_sort: int, row: pd.Series, note: str, is_op: int) -> dict:
        return {
            "Method": method,
            "Role": role,
            "MethodSort": method_sort,
            "IsOperating": is_op,
            "OperatingCutoffPD": float(row["CutoffPD"]),
            "OperatingCutoffScore": int(row["CutoffScore"]),
            "OotApprovalRate": float(row["ApprovalRate"]),
            "OotBadRateApproved": float(row["BadRateApproved"]),
            "OotRejectRate": float(row["RejectRate"]),
            "BudgetedBadRate": BUDGETED_BAD_RATE,
            "MarginalPD": float(row["MarginalPD"]),
            "PolicyNote": note,
        }

    cutoff_policy = pd.DataFrame(
        [
            policy_row(
                "Risk-reward (budgeted bad rate)",
                "Operating",
                1,
                op_row,
                "Primary: maximise OOT approval subject to bad rate among approved <= budgeted risk appetite. Approve when PD <= cut-off.",
                1,
            ),
            policy_row(
                "Youden / max KS (train ROC)",
                "Reference",
                2,
                youden_row,
                "Supporting statistical cut (Youden = max TPR-FPR; coincides with max KS for a single score). Not the operating policy.",
                0,
            ),
        ]
    )
    cutoff_policy.to_csv(GOLD / "FactCutoffPolicy.csv", index=False)

    score = (850 - proba * 550).round(0).astype(int)
    grade, grade_sort = pd_to_grade(pd.Series(proba))
    band = risk_band(pd.Series(proba))
    el = proba * df["LGD"].to_numpy() * df["EAD"].to_numpy()
    stage = np.where(proba >= 0.20, "Stage 3", np.where(proba >= 0.08, "Stage 2", "Stage 1"))
    decision = np.where(proba <= cutoff, "Approve", "Reject")
    sample_split = np.where(oot_mask, "OOT", np.where(test_mask, "Test", "Train"))

    df["PD"] = proba
    df["Score"] = score
    df["Grade"] = grade
    df["GradeSort"] = grade_sort
    df["RiskBand"] = band
    df["EL"] = el
    df["Stage"] = stage
    df["IsOOT"] = oot_mask.astype(int)
    df["SampleSplit"] = sample_split
    df["Decision"] = decision
    df["RiskRank"] = df["PD"].rank(method="dense", ascending=False).astype(int)
    df["RecommendedAction"] = df.apply(lambda r: recommended_action(r, cutoff), axis=1)
    df["VintageMonth"] = df["application_date"].dt.to_period("M").astype(str)

    # --- Calibration on OOT only (long format for dual-line chart) ---
    oot = df.loc[oot_mask, ["PD", "TARGET"]].copy()
    oot["Decile"] = pd.qcut(oot["PD"], 10, labels=False, duplicates="drop") + 1
    cal_wide = (
        oot.groupby("Decile", as_index=False)
        .agg(PredictedPD=("PD", "mean"), RealizedRate=("TARGET", "mean"), N=("TARGET", "count"))
        .assign(DecileLabel=lambda d: "D" + d["Decile"].astype(str))
    )
    cal_wide["Gap"] = cal_wide["PredictedPD"] - cal_wide["RealizedRate"]
    cal_wide.to_csv(GOLD / "FactCalibration.csv", index=False)
    cal_long = pd.concat(
        [
            cal_wide[["Decile", "DecileLabel", "N"]].assign(
                Metric="Predicted PD", Rate=cal_wide["PredictedPD"].to_numpy()
            ),
            cal_wide[["Decile", "DecileLabel", "N"]].assign(
                Metric="Realized default rate",
                Rate=cal_wide["RealizedRate"].to_numpy(),
            ),
        ],
        ignore_index=True,
    )
    cal_long.to_csv(GOLD / "FactCalibrationLong.csv", index=False)

    # --- Grade bridge ---
    (
        df.groupby(["Grade", "GradeSort"], as_index=False)
        .agg(
            Applications=("SK_ID_CURR", "count"),
            DefaultRate=("TARGET", "mean"),
            AvgPD=("PD", "mean"),
            Exposure=("EAD", "sum"),
            EL=("EL", "sum"),
        )
        .sort_values("GradeSort")
        .to_csv(GOLD / "FactGradeBridge.csv", index=False)
    )

    # --- Vintage ---
    vint_rows = []
    for vm, g in df.groupby("VintageMonth"):
        base_dr = float(g["TARGET"].mean())
        for mob in range(1, 13):
            vint_rows.append(
                {
                    "VintageMonth": vm,
                    "MOB": mob,
                    "DefaultRate": float(base_dr * (1 - np.exp(-mob / 5))),
                    "Applications": int(len(g)),
                    "Exposure": float(g["EAD"].sum()),
                }
            )
    pd.DataFrame(vint_rows).to_csv(GOLD / "FactVintage.csv", index=False)

    # --- PSI: 2018 baseline vs stressed 2020 book (adverse mix shift for monitoring demo) ---
    # Synthetic application_date alone does not move features; overweight high-PD 2020 apps
    # to emulate portfolio mix drift (documented on Context).
    baseline = df["application_date"].dt.year == 2018
    recent_pool = df.loc[df["application_date"].dt.year == 2020].copy()
    w = np.clip(recent_pool["PD"].to_numpy(), 1e-4, None) ** 2
    w = w / w.sum()
    recent_idx = np.random.default_rng(42).choice(
        recent_pool.index.to_numpy(), size=min(len(recent_pool), int(baseline.sum())), replace=True, p=w
    )
    recent = df.loc[recent_idx]
    base = df.loc[baseline]
    psi_specs = [
        # Model inputs only — never PD / Score / Grade / RiskBand (those are outputs)
        ("EXT_SOURCE_2", "numeric", "EXT_SOURCE_2"),
        ("EXT_SOURCE_3", "numeric", "EXT_SOURCE_3"),
        ("AgeYears", "numeric", "AgeYears"),
        ("AMT_CREDIT", "numeric", "AMT_CREDIT"),
        ("PREV_REFUSED_RATE", "numeric", "PREV_REFUSED_RATE"),
        ("INST_DELAY_MEAN", "numeric", "INST_DELAY_MEAN"),
        ("BUR_CNT", "numeric", "BUR_CNT"),
        ("NAME_INCOME_TYPE", "categorical", "NAME_INCOME_TYPE"),
        ("NAME_EDUCATION_TYPE", "categorical", "NAME_EDUCATION_TYPE"),
        ("ORGANIZATION_TYPE", "categorical", "ORGANIZATION_TYPE"),
    ]
    psi_rows = []
    for label, kind, col in psi_specs:
        if col not in df.columns:
            continue
        if kind == "numeric":
            val = psi_numeric(base[col], recent[col])
        else:
            val = psi_categorical(base[col], recent[col])
        flag = stability_flag(val)
        psi_rows.append(
            {
                "Feature": label,
                "PSI": round(val, 4),
                "StabilityFlag": flag,
                "Threshold": 0.10,
                "BaselineYear": 2018,
                "RecentYear": 2020,
                "RecentWindow": "2020 adverse-mix (PD-weighted)",
            }
        )
    psi_df = pd.DataFrame(psi_rows).sort_values("PSI", ascending=False)
    psi_df.to_csv(GOLD / "FactPsi.csv", index=False)

    pd.DataFrame(univariate_iv_rows(df, y, train_mask)).to_csv(GOLD / "DimScorecard.csv", index=False)

    # --- Train / Test / OOT discrimination (Gini bars + ROC curves) ---
    gini_compare = pd.DataFrame(
        [
            {
                "Sample": "Train",
                "SampleSort": 1,
                "AUC": auc_train,
                "Gini": gini_train,
                "KS": ks_train,
                "N": n_train,
            },
            {
                "Sample": "Test",
                "SampleSort": 2,
                "AUC": auc_test,
                "Gini": gini_test,
                "KS": ks_test,
                "N": n_test,
            },
            {
                "Sample": "OOT",
                "SampleSort": 3,
                "AUC": auc_oot,
                "Gini": gini_oot,
                "KS": ks_oot,
                "N": n_oot,
            },
        ]
    )
    gini_compare.to_csv(GOLD / "FactGiniCompare.csv", index=False)

    def roc_table(sample_name: str, mask: pd.Series) -> pd.DataFrame:
        fpr, tpr, thr = roc_curve(y.loc[mask].to_numpy(), proba[mask.to_numpy()])
        # Dense grid for a continuous ROC (scalar X-axis) — guide-style curve
        grid = np.linspace(0.0, 1.0, 101)
        tpr_i = np.interp(grid, fpr, tpr)
        return pd.DataFrame(
            {
                "Sample": sample_name,
                "FprSort": np.arange(len(grid), dtype=int),
                "FprLabel": [f"{x:.0%}" for x in grid],
                "FPR": grid,
                "TPR": tpr_i,
            }
        ), fpr, tpr, thr

    train_roc, fpr_tr, tpr_tr, thr_tr = roc_table("Train", train_mask)
    test_roc, _, _, _ = roc_table("Test", test_mask)
    oot_roc, _, _, _ = roc_table("OOT", oot_mask)
    # Diagonal random classifier (guide ROC backdrop)
    grid = np.linspace(0.0, 1.0, 101)
    random_roc = pd.DataFrame(
        {
            "Sample": "Random",
            "FprSort": np.arange(len(grid), dtype=int),
            "FprLabel": [f"{x:.0%}" for x in grid],
            "FPR": grid,
            "TPR": grid,
        }
    )
    # Youden optimum on train (red marker in the guide)
    youden_i = int(np.argmax(tpr_tr - fpr_tr))
    youden_roc = pd.DataFrame(
        [
            {
                "Sample": "Youden",
                "FprSort": 0,
                "FprLabel": f"{float(fpr_tr[youden_i]):.0%}",
                "FPR": float(fpr_tr[youden_i]),
                "TPR": float(tpr_tr[youden_i]),
            }
        ]
    )
    roc_df = pd.concat([train_roc, test_roc, oot_roc, random_roc, youden_roc], ignore_index=True)
    roc_df.to_csv(GOLD / "FactRocCurve.csv", index=False)

    # --- PD distribution (Good vs Bad density curves) ---
    bins = np.linspace(0.0, min(0.50, float(np.quantile(proba, 0.995)) + 0.02), 41)
    share_rows = []
    for cls, label in [(0, "Good (non-default)"), (1, "Bad (default)")]:
        vals = proba[y.to_numpy() == cls]
        counts, edges = np.histogram(vals, bins=bins)
        shares = counts / max(int(counts.sum()), 1)
        for i, share in enumerate(shares):
            width = max(float(edges[i + 1] - edges[i]), 1e-9)
            mid = 0.5 * (edges[i] + edges[i + 1])
            share_rows.append(
                {
                    "Class": label,
                    "PdBinSort": i + 1,
                    "PdBinLabel": f"{edges[i]:.0%}-{edges[i + 1]:.0%}",
                    "PdBinMid": float(mid),
                    "Density": float(share / width),
                    "Share": float(share),
                }
            )
    pd.DataFrame(share_rows).to_csv(GOLD / "FactPdDistribution.csv", index=False)

    # --- New-business time series: scorecard PD vs realized default after go-live ---
    # Go-live = OOT cut (first month of holdout) — post-period is "new business under scorecard"
    go_live = pd.Timestamp(df.loc[oot_mask, "application_date"].min()).normalize()
    go_live_label = go_live.strftime("%Y-%m-%d")
    monthly = (
        df.groupby(df["application_date"].dt.to_period("M"))
        .agg(
            Applications=("SK_ID_CURR", "count"),
            AvgScorecardPD=("PD", "mean"),
            RealizedDefaultRate=("TARGET", "mean"),
            Exposure=("EAD", "sum"),
        )
        .reset_index()
        .rename(columns={"application_date": "OriginationMonth"})
    )
    monthly["OriginationMonth"] = monthly["OriginationMonth"].astype(str)
    monthly["MonthSort"] = np.arange(1, len(monthly) + 1)
    monthly["PeriodFlag"] = np.where(
        pd.PeriodIndex(monthly["OriginationMonth"], freq="M").to_timestamp() >= go_live,
        "Post scorecard go-live",
        "Pre scorecard go-live",
    )
    monthly["GoLiveDate"] = go_live_label
    monthly.to_csv(GOLD / "FactNewBusinessTS.csv", index=False)
    nb_long = pd.concat(
        [
            monthly[["OriginationMonth", "MonthSort", "PeriodFlag", "GoLiveDate", "Applications"]].assign(
                Metric="Scorecard PD", Rate=monthly["AvgScorecardPD"].to_numpy()
            ),
            monthly[["OriginationMonth", "MonthSort", "PeriodFlag", "GoLiveDate", "Applications"]].assign(
                Metric="Realized default rate", Rate=monthly["RealizedDefaultRate"].to_numpy()
            ),
        ],
        ignore_index=True,
    )
    nb_long.to_csv(GOLD / "FactNewBusinessLong.csv", index=False)

    metrics = {
        "SampleN": SAMPLE_N,
        "FullN": int(len(df)),
        "DefaultRate": float(y.mean()),
        "TrainN": n_train,
        "TestN": n_test,
        "OotN": n_oot,
        "TrainAUC": auc_train,
        "TrainGini": gini_train,
        "TrainKS": ks_train,
        "TestAUC": auc_test,
        "TestGini": gini_test,
        "TestKS": ks_test,
        "TestBrier": float(brier_test),
        "OotAUC": auc_oot,
        "OotGini": gini_oot,
        "OotKS": ks_oot,
        "OotBrier": float(brier_oot),
        "CutoffPD": cutoff,
        "BudgetedBadRate": BUDGETED_BAD_RATE,
        "YoudenCutoffPD": youden_pd,
        "ScorecardGoLive": go_live_label,
        "OotApprovalRate": float(op_row["ApprovalRate"]),
        "OotBadRateApproved": float(op_row["BadRateApproved"]),
        "LGD": 0.45,
        "Champion": "LightGBM + Platt calibration",
        "PsiBreachCount": int((psi_df["StabilityFlag"] == "Breach").sum()),
        "PsiWatchCount": int((psi_df["StabilityFlag"] == "Watch").sum()),
        "CalibMeanPredictedOOT": float(oot["PD"].mean()),
        "CalibMeanRealizedOOT": float(oot["TARGET"].mean()),
    }
    pd.DataFrame([metrics]).to_csv(GOLD / "ModelMetrics.csv", index=False)
    (GOLD / "ModelMetrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    # Desktop sample with scores
    scored_sample, _ = train_test_split(
        df, train_size=SAMPLE_N, stratify=df["TARGET"], random_state=42
    )
    keep_cols = [
        "SK_ID_CURR",
        "application_date",
        "TARGET",
        "NAME_CONTRACT_TYPE",
        "CODE_GENDER",
        "NAME_INCOME_TYPE",
        "NAME_EDUCATION_TYPE",
        "NAME_FAMILY_STATUS",
        "NAME_HOUSING_TYPE",
        "FLAG_OWN_CAR",
        "FLAG_OWN_REALTY",
        "AMT_INCOME_TOTAL",
        "AMT_CREDIT",
        "AMT_ANNUITY",
        "AgeYears",
        "EmploymentYears",
        "CreditIncomeRatio",
        "AnnuityIncomeRatio",
        "REGION_RATING_CLIENT",
        "EXT_SOURCE_1",
        "EXT_SOURCE_2",
        "EXT_SOURCE_3",
        "EXT_MEAN",
        "BUR_CNT",
        "BUR_AMT_CREDIT_SUM",
        "BUR_AMT_CREDIT_SUM_OVERDUE",
        "BUR_ACTIVE_CNT",
        "PREV_CNT",
        "PREV_REFUSED_RATE",
        "PREV_APPROVED_RATE",
        "INST_CNT",
        "INST_DELAY_MEAN",
        "EAD",
        "LGD",
        "PD",
        "Score",
        "Grade",
        "GradeSort",
        "RiskBand",
        "RiskRank",
        "EL",
        "Stage",
        "Decision",
        "RecommendedAction",
        "IsOOT",
        "SampleSplit",
        "VintageMonth",
    ]
    scored_sample[keep_cols].to_csv(GOLD / "DimApplication.csv", index=False)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"booster": bst, "calibrator": cal, "num": num, "cat": cat, "cutoff": cutoff},
        MODEL_DIR / "pd_lgbm.joblib",
    )
    print(json.dumps(metrics, indent=2))
    print("PSI flags:\n", psi_df[["Feature", "PSI", "StabilityFlag"]].to_string(index=False))


if __name__ == "__main__":
    main()

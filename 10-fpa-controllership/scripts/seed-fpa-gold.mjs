/**
 * Seed Controllership gold — Nordic multi-entity Actual vs Budget P&L.
 * Statement-ready CoA: Operator (+/−/=) + SortOrder + Level for OpenBI Statement.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gold = path.join(root, "data", "gold");

const SEED = 42;
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const round1 = (n) => Math.round(n * 10) / 10;

const ENTITIES = [
  { EntityID: "FI", EntityName: "Finland Ops", LocalCurrency: "EUR", FxToEur: 1 },
  { EntityID: "SE", EntityName: "Sweden Ops", LocalCurrency: "SEK", FxToEur: 0.087 },
  { EntityID: "DK", EntityName: "Denmark Ops", LocalCurrency: "DKK", FxToEur: 0.134 },
  { EntityID: "NO", EntityName: "Norway Ops", LocalCurrency: "NOK", FxToEur: 0.086 },
];

/** Chart of accounts — statement operators for roll-up storytelling. */
const ACCOUNTS = [
  { AccountID: "R100", AccountName: "Product revenue", Level: 1, Operator: "+", Sign: 1, ParentID: "", SortOrder: 10, Section: "Revenue" },
  { AccountID: "R200", AccountName: "Services revenue", Level: 1, Operator: "+", Sign: 1, ParentID: "", SortOrder: 20, Section: "Revenue" },
  { AccountID: "R900", AccountName: "Total revenue", Level: 0, Operator: "=", Sign: 1, ParentID: "", SortOrder: 30, Section: "Revenue" },
  { AccountID: "C100", AccountName: "Cost of goods", Level: 1, Operator: "-", Sign: -1, ParentID: "", SortOrder: 40, Section: "COGS" },
  { AccountID: "C200", AccountName: "Delivery & freight", Level: 1, Operator: "-", Sign: -1, ParentID: "", SortOrder: 50, Section: "COGS" },
  { AccountID: "C900", AccountName: "Gross profit", Level: 0, Operator: "=", Sign: 1, ParentID: "", SortOrder: 60, Section: "Margin" },
  { AccountID: "O100", AccountName: "Personnel", Level: 1, Operator: "-", Sign: -1, ParentID: "", SortOrder: 70, Section: "OPEX" },
  { AccountID: "O200", AccountName: "Marketing", Level: 1, Operator: "-", Sign: -1, ParentID: "", SortOrder: 80, Section: "OPEX" },
  { AccountID: "O300", AccountName: "Facilities & IT", Level: 1, Operator: "-", Sign: -1, ParentID: "", SortOrder: 90, Section: "OPEX" },
  { AccountID: "O900", AccountName: "Operating profit", Level: 0, Operator: "=", Sign: 1, ParentID: "", SortOrder: 100, Section: "Result" },
];

const PERIODS = [
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
];

function writeCsv(name, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    );
  }
  fs.writeFileSync(path.join(gold, name), lines.join("\n") + "\n");
}

fs.mkdirSync(gold, { recursive: true });

writeCsv(
  "DimEntity.csv",
  ENTITIES.map((e) => ({
    EntityID: e.EntityID,
    EntityName: e.EntityName,
    LocalCurrency: e.LocalCurrency,
  }))
);

writeCsv(
  "DimAccount.csv",
  ACCOUNTS.map((a) => ({
    AccountID: a.AccountID,
    AccountName: a.AccountName,
    Level: a.Level,
    Operator: a.Operator,
    Sign: a.Sign,
    ParentID: a.ParentID,
    SortOrder: a.SortOrder,
    Section: a.Section,
    StatementLabel: `${a.Operator}  ${a.AccountName}`,
  }))
);

const dateRows = [];
for (const ym of PERIODS) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 12));
  dateRows.push({
    Date: d.toISOString().slice(0, 10),
    Year: y,
    Month: m,
    YearMonth: ym,
    MonthName: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    MonthYearSort: y * 100 + m,
    Quarter: `Q${Math.ceil(m / 3)}`,
    YearQuarter: `${y}-Q${Math.ceil(m / 3)}`,
  });
}
writeCsv("DimDate.csv", dateRows);

const fxRows = [];
for (const e of ENTITIES) {
  for (const ym of PERIODS) {
    const drift = 1 + (rand() - 0.5) * 0.04;
    fxRows.push({
      YearMonth: ym,
      Currency: e.LocalCurrency,
      FxToEur: round1(e.FxToEur * drift * 10000) / 10000,
    });
  }
}
writeCsv("FxRates.csv", fxRows);

/** Leaf bases (EUR reporting, annual-ish monthly) before FX noise. */
const leafBase = {
  R100: 4200,
  R200: 1800,
  C100: 2100,
  C200: 380,
  O100: 1400,
  O200: 520,
  O300: 410,
};

const entityScale = { FI: 1.0, SE: 0.72, DK: 0.55, NO: 0.48 };

function monthFactor(ym) {
  const m = Number(ym.slice(5));
  // Mild seasonality + growth
  return 0.92 + m * 0.012 + Math.sin((m / 12) * Math.PI * 2) * 0.04;
}

const fact = [];
for (const e of ENTITIES) {
  const scale = entityScale[e.EntityID];
  for (const ym of PERIODS) {
    const mf = monthFactor(ym);
    const leaves = {};
    for (const [id, base] of Object.entries(leafBase)) {
      let actualLocal =
        base * scale * mf * (0.94 + rand() * 0.14) * (1 / e.FxToEur);
      const budgetLocal = base * scale * mf * (0.98 + rand() * 0.06) * (1 / e.FxToEur);
      // Boardroom drama: Sweden cost overrun, Finland revenue beat
      if (e.EntityID === "SE" && (id === "C100" || id === "O100")) actualLocal *= 1.16;
      if (e.EntityID === "FI" && id === "R100") actualLocal *= 1.09;
      if (e.EntityID === "NO" && id === "O200") actualLocal *= 1.22;
      leaves[id] = { actualLocal, budgetLocal };
    }
    const totRevA = leaves.R100.actualLocal + leaves.R200.actualLocal;
    const totRevB = leaves.R100.budgetLocal + leaves.R200.budgetLocal;
    const cogsA = leaves.C100.actualLocal + leaves.C200.actualLocal;
    const cogsB = leaves.C100.budgetLocal + leaves.C200.budgetLocal;
    const gpA = totRevA - cogsA;
    const gpB = totRevB - cogsB;
    const opexA = leaves.O100.actualLocal + leaves.O200.actualLocal + leaves.O300.actualLocal;
    const opexB = leaves.O100.budgetLocal + leaves.O200.budgetLocal + leaves.O300.budgetLocal;
    const opA = gpA - opexA;
    const opB = gpB - opexB;

    const amounts = {
      R100: leaves.R100,
      R200: leaves.R200,
      R900: { actualLocal: totRevA, budgetLocal: totRevB },
      C100: leaves.C100,
      C200: leaves.C200,
      C900: { actualLocal: gpA, budgetLocal: gpB },
      O100: leaves.O100,
      O200: leaves.O200,
      O300: leaves.O300,
      O900: { actualLocal: opA, budgetLocal: opB },
    };

    const fx = e.FxToEur;
    for (const a of ACCOUNTS) {
      const { actualLocal, budgetLocal } = amounts[a.AccountID];
      const actualEur = actualLocal * fx;
      const budgetEur = budgetLocal * fx;
      fact.push({
        YearMonth: ym,
        EntityID: e.EntityID,
        AccountID: a.AccountID,
        ActualLocal: round1(actualLocal),
        BudgetLocal: round1(budgetLocal),
        ActualEur: round1(actualEur),
        BudgetEur: round1(budgetEur),
        VarianceEur: round1(actualEur - budgetEur),
      });
    }
  }
}
writeCsv("FactPnL.csv", fact);

/** Illustrative scenario book — OP by month (EUR), not a live what-if engine. */
const scenarioRows = [];
for (const ym of PERIODS) {
  const baseOp = fact
    .filter((r) => r.YearMonth === ym && r.AccountID === "O900")
    .reduce((s, r) => s + r.ActualEur, 0);
  scenarioRows.push(
    { YearMonth: ym, Scenario: "Base (actual)", OperatingProfitEur: round1(baseOp) },
    {
      YearMonth: ym,
      Scenario: "Revenue +5%",
      OperatingProfitEur: round1(baseOp * 1.05),
    },
    {
      YearMonth: ym,
      Scenario: "FX -3% hit",
      OperatingProfitEur: round1(baseOp * 0.97),
    }
  );
}
writeCsv("FactScenario.csv", scenarioRows);

/** OP Budget→Actual bridge steps — IsTotal marks bookend totals (start in data; end via waterfall Show total). */
const bridgeRows = [
  { BridgeStep: "Budget OP", BridgeOrder: 0, IsTotal: true, AccountID: "" },
  ...ACCOUNTS.filter((a) => a.Level === 1).map((a) => ({
    BridgeStep: a.AccountName,
    BridgeOrder: a.SortOrder,
    IsTotal: false,
    AccountID: a.AccountID,
  })),
  { BridgeStep: "Actual OP", BridgeOrder: 900, IsTotal: true, AccountID: "" },
];
writeCsv("DimBridgeStep.csv", bridgeRows);

console.log(
  JSON.stringify(
    {
      ok: true,
      entities: ENTITIES.length,
      accounts: ACCOUNTS.length,
      periods: PERIODS.length,
      factRows: fact.length,
      scenarioRows: scenarioRows.length,
      bridgeSteps: bridgeRows.length,
      gold,
    },
    null,
    2
  )
);

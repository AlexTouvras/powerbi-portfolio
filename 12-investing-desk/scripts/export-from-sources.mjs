/**
 * Export Investing Desk gold from:
 *   A) sibling investing research repo (capital, sims, review, policies, gates)
 *   B) 01-finance Nordic Equity gold (companies + prices)
 *
 * Usage: node scripts/export-from-sources.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gold = path.join(root, "data", "gold");
const investingRoot =
  process.env.INVESTING_ROOT ||
  path.resolve(root, "../../investing");
const nordicGold = path.resolve(root, "../01-finance/data/gold");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(fileName, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  const out = path.join(gold, fileName);
  fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
  return { file: fileName, rows: rows.length };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readCsv(p) {
  const text = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "").trim();
  const lines = text.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = parseCsvLine(line);
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? "";
    });
    return o;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Minimal YAML subset for capital.yaml / holdings_nordnet.yaml */
function parseSimpleYaml(text) {
  // Prefer JSON path when available; for holdings use line parser below.
  return text;
}

function loadHoldingsFromYaml(yamlPath) {
  if (!fs.existsSync(yamlPath)) return null;
  const text = fs.readFileSync(yamlPath, "utf8");
  const cashMatch = text.match(/cash_eur:\s*([0-9.]+)/);
  const asOfMatch = text.match(/as_of:\s*"?([^"\n]+)"?/);
  const holdings = [];
  const block = text.split(/\nholdings:\s*\n/)[1] || "";
  const chunks = block.split(/\n\s*-\s+/).slice(1);
  for (const chunk of chunks) {
    const name = (chunk.match(/name:\s*(.+)/) || [])[1]?.trim();
    const yahoo = (chunk.match(/yahoo:\s*(\S+)/) || [])[1]?.trim();
    const value = Number((chunk.match(/value_eur:\s*([0-9.]+)/) || [])[1] || 0);
    if (yahoo) holdings.push({ name: name || yahoo, yahoo, value_eur: value });
  }
  return {
    cash_eur: Number(cashMatch?.[1] || 0),
    as_of: (asOfMatch?.[1] || "").trim(),
    holdings,
  };
}

function loadMidUniverse(universesPath) {
  const text = fs.readFileSync(universesPath, "utf8");
  const midBlock = text.split(/mid_liquid:/)[1]?.split(/short_liquid:/)[0] || "";
  const symbols = [];
  for (const m of midBlock.matchAll(/^\s*-\s+([A-Za-z0-9._-]+)/gm)) {
    symbols.push(m[1]);
  }
  return new Set(symbols);
}

ensureDir(gold);

const simPath = path.join(investingRoot, "reports/sim_latest.json");
const reviewPath = path.join(investingRoot, "reports/review_latest.json");
const actionsPath = path.join(investingRoot, "reports/review_actions.csv");
const policiesPath = path.join(investingRoot, "reports/compare_policies.csv");
const kpisPath = path.join(investingRoot, "reports/research_selection_kpis.csv");
const capitalPath = path.join(investingRoot, "configs/capital.yaml");
const universesPath = path.join(investingRoot, "configs/universes.yaml");
const nextReviewPath = path.join(investingRoot, "configs/next_review.yaml");
const holdingsYaml = path.join(investingRoot, "configs/holdings_nordnet.yaml");

if (!fs.existsSync(simPath)) {
  throw new Error(`Missing ${simPath} — set INVESTING_ROOT or open investing repo`);
}
if (!fs.existsSync(nordicGold)) {
  throw new Error(`Missing Nordic gold at ${nordicGold}`);
}

const sim = readJson(simPath);
const review = fs.existsSync(reviewPath) ? readJson(reviewPath) : null;
const midUniverse = loadMidUniverse(universesPath);
const holdingsSnap = loadHoldingsFromYaml(holdingsYaml);

// --- DimSleeve ---
const sleeves = (sim.capital?.sleeves || []).map((s, i) => ({
  SleeveKey: s.key,
  SleeveName: s.name,
  Broker: s.broker,
  ApproxEUR: s.approx_eur,
  Horizon: s.horizon,
  DayTrading: s.day_trading ? 1 : 0,
  AssetClass: s.asset_class,
  SleeveSort: i + 1,
  IsActiveLoop: s.key === "core" ? 0 : 1,
  StatusNote:
    s.key === "short"
      ? "Blocked until mandate gates pass"
      : s.key === "core"
        ? "Strategic ETF — out of mid research loop"
        : "Active equity research book",
}));
const ringFence = Number(sim.capital?.op_ringfenced_eur || 0);
if (ringFence > 0) {
  sleeves.push({
    SleeveKey: "ringfence",
    SleeveName: "Ring-fenced (OP)",
    Broker: "op",
    ApproxEUR: ringFence,
    Horizon: "multi_year",
    DayTrading: 0,
    AssetClass: "etf",
    SleeveSort: 99,
    IsActiveLoop: 0,
    StatusNote: "Context only — out of active loop",
  });
}

const totalPolicyEUR = sleeves
  .filter((s) => s.SleeveKey !== "ringfence")
  .reduce((a, s) => a + Number(s.ApproxEUR), 0);

writeCsv(
  "DimSleeve.csv",
  [
    "SleeveKey",
    "SleeveName",
    "Broker",
    "ApproxEUR",
    "Horizon",
    "DayTrading",
    "AssetClass",
    "SleeveSort",
    "IsActiveLoop",
    "StatusNote",
    "WeightPct",
  ],
  sleeves.map((s) => ({
    ...s,
    WeightPct:
      s.SleeveKey === "ringfence"
        ? 0
        : totalPolicyEUR
          ? Number(s.ApproxEUR) / totalPolicyEUR
          : 0,
  }))
);

// --- FactSimSummary ---
const summaries = (sim.summaries || []).map((r) => ({
  Strategy: r.strategy,
  SeriesLabel:
    r.strategy.includes("core")
      ? "Core (VWCE)"
      : r.strategy.includes("mid")
        ? "Mid (top-10 TSMOM)"
        : r.strategy,
  Role: r.strategy.includes("core") ? "core" : "mid",
  StartEUR: r.start_eur,
  EndEUR: r.end_eur,
  TotalReturn: r.total_return,
  CAGR: r.cagr,
  AnnVol: r.ann_vol,
  Sharpe: r.sharpe,
  MaxDrawdown: r.max_drawdown,
  Days: r.days,
}));
writeCsv(
  "FactSimSummary.csv",
  [
    "Strategy",
    "SeriesLabel",
    "Role",
    "StartEUR",
    "EndEUR",
    "TotalReturn",
    "CAGR",
    "AnnVol",
    "Sharpe",
    "MaxDrawdown",
    "Days",
  ],
  summaries
);

const core = summaries.find((s) => s.Role === "core");
const mid = summaries.find((s) => s.Role === "mid");

// --- FactEquityCurve ---
const curveRows = [];
for (const [seriesName, series] of Object.entries(sim.series || {})) {
  const dates = series.dates || [];
  const equity = series.equity_eur || [];
  const indexed = series.equity_indexed || [];
  const dd = series.drawdown || [];
  for (let i = 0; i < dates.length; i++) {
    curveRows.push({
      Date: String(dates[i]).slice(0, 10),
      Series: seriesName,
      EquityEUR: equity[i],
      EquityIndexed: indexed[i],
      Drawdown: dd[i],
    });
  }
}
writeCsv(
  "FactEquityCurve.csv",
  ["Date", "Series", "EquityEUR", "EquityIndexed", "Drawdown"],
  curveRows
);

// --- FactPolicyCompare ---
let policyRows = [];
if (fs.existsSync(policiesPath)) {
  policyRows = readCsv(policiesPath).map((r) => ({
    Label: r.label,
    Role: r.role,
    FeeBps: Number(r.fee_bps),
    StartEUR: Number(r.start_eur),
    EndEUR: Number(r.end_eur),
    TotalReturn: Number(r.total_return),
    CAGR: Number(r.cagr),
    AnnVol: Number(r.ann_vol),
    Sharpe: Number(r.sharpe),
    MaxDrawdown: Number(r.max_drawdown),
    AnnOnewayTurnover: Number(r.ann_oneway_turnover),
    AvgNamesChanged: Number(r.avg_names_changed),
    AvgHoldings: Number(r.avg_holdings),
    Rebalances: Number(r.rebalances),
    Days: Number(r.days),
  }));
} else if (fs.existsSync(kpisPath)) {
  policyRows = readCsv(kpisPath).map((r) => ({
    Label: r.label,
    Role: r.family || r.role || "",
    FeeBps: 5,
    StartEUR: 15000,
    EndEUR: Number(r.end_eur),
    TotalReturn: "",
    CAGR: Number(r.cagr),
    AnnVol: Number(r.ann_vol),
    Sharpe: Number(r.sharpe),
    MaxDrawdown: Number(r.max_drawdown),
    AnnOnewayTurnover: Number(r.ann_oneway_turnover || 0),
    AvgNamesChanged: "",
    AvgHoldings: "",
    Rebalances: "",
    Days: "",
  }));
}
const bmSharpe =
  policyRows.find((r) => /VWCE/i.test(r.Label))?.Sharpe ??
  Number(core?.Sharpe || 1);
policyRows = policyRows.map((r) => ({
  ...r,
  SharpeVsBenchmark: Number(r.Sharpe) - Number(bmSharpe),
  ShortLabel: String(r.Label)
    .replace("Applied: ", "")
    .replace(" (previous sim style)", "")
    .replace("Benchmark ", "BM ")
    .slice(0, 42),
}));
writeCsv(
  "FactPolicyCompare.csv",
  [
    "Label",
    "ShortLabel",
    "Role",
    "FeeBps",
    "StartEUR",
    "EndEUR",
    "TotalReturn",
    "CAGR",
    "AnnVol",
    "Sharpe",
    "SharpeVsBenchmark",
    "MaxDrawdown",
    "AnnOnewayTurnover",
    "AvgNamesChanged",
    "AvgHoldings",
    "Rebalances",
    "Days",
  ],
  policyRows
);

// --- FactHolding ---
const bookEUR = Number(review?.book_eur || 0);
const equityEUR = Number(review?.equity_eur || 0);
const cashEUR = Number(
  holdingsSnap?.cash_eur ?? review?.cash_eur ?? 0
);
const holdingsAsOf = holdingsSnap?.as_of || review?.holdings_as_of || "";
const targetSet = new Set(review?.target_names || []);
const actionByYahoo = new Map();
if (fs.existsSync(actionsPath)) {
  for (const r of readCsv(actionsPath)) {
    actionByYahoo.set(r.yahoo, r);
  }
}

let holdingRows = [];
if (holdingsSnap?.holdings?.length) {
  const eqSum = holdingsSnap.holdings.reduce((a, h) => a + h.value_eur, 0) || 1;
  holdingRows = holdingsSnap.holdings.map((h) => {
    const act = actionByYahoo.get(h.yahoo);
    const target = act ? Number(act.target_eur) : h.value_eur;
    const delta = act ? Number(act.delta_eur) : 0;
    return {
      Name: h.name,
      YahooSymbol: h.yahoo,
      CurrentEUR: h.value_eur,
      TargetEUR: target,
      DeltaEUR: delta,
      WeightPct: h.value_eur / eqSum,
      TargetWeightPct: target / eqSum,
      DeltaWeightPct: delta / eqSum,
      Mom12m: act ? Number(act.mom_12m) : "",
      Rank: act?.rank || "",
      Action: act?.action || "HOLD",
      InTargetBook: targetSet.has(h.yahoo) ? 1 : 0,
      IsNordic: /\.(HE|ST|CO|OL)$/.test(h.yahoo) ? 1 : 0,
      Region: /\.(HE|ST|CO|OL)$/.test(h.yahoo) ? "Nordic" : "Other",
    };
  });
} else if (actionByYahoo.size) {
  const vals = [...actionByYahoo.values()].filter((a) => Number(a.current_eur) > 0);
  const eqSum = vals.reduce((a, h) => a + Number(h.current_eur), 0) || 1;
  holdingRows = vals.map((h) => ({
    Name: h.name,
    YahooSymbol: h.yahoo,
    CurrentEUR: Number(h.current_eur),
    TargetEUR: Number(h.target_eur),
    DeltaEUR: Number(h.delta_eur),
    WeightPct: Number(h.current_eur) / eqSum,
    TargetWeightPct: Number(h.target_eur) / eqSum,
    DeltaWeightPct: Number(h.delta_eur) / eqSum,
    Mom12m: Number(h.mom_12m),
    Rank: h.rank || "",
    Action: h.action,
    InTargetBook: targetSet.has(h.yahoo) ? 1 : 0,
    IsNordic: /\.(HE|ST|CO|OL)$/.test(h.yahoo) ? 1 : 0,
    Region: /\.(HE|ST|CO|OL)$/.test(h.yahoo) ? "Nordic" : "Other",
  }));
}
writeCsv(
  "FactHolding.csv",
  [
    "Name",
    "YahooSymbol",
    "CurrentEUR",
    "TargetEUR",
    "DeltaEUR",
    "WeightPct",
    "TargetWeightPct",
    "DeltaWeightPct",
    "Mom12m",
    "Rank",
    "Action",
    "InTargetBook",
    "IsNordic",
    "Region",
  ],
  holdingRows
);

function scrubEurText(s) {
  return String(s || "")
    .replace(/~\u20ac\s*[\d.,]+/gi, "toward target weight")
    .replace(/\u20ac\s*[\d.,]+/gi, "target weight")
    .replace(/~€\s*[\d.,]+/gi, "toward target weight")
    .replace(/€\s*[\d.,]+/gi, "target weight");
}

// --- FactRebalanceAction ---
const equityBase =
  Number(equityEUR) ||
  holdingRows.reduce((a, h) => a + Number(h.CurrentEUR || 0), 0) ||
  1;
const actionRows = fs.existsSync(actionsPath)
  ? readCsv(actionsPath).map((r) => {
      const delta = Number(r.delta_eur) || 0;
      return {
        Action: r.action,
        Name: r.name,
        YahooSymbol: r.yahoo,
        CurrentEUR: Number(r.current_eur),
        TargetEUR: Number(r.target_eur),
        DeltaEUR: delta,
        Mom12m: Number(r.mom_12m),
        Rank: r.rank || "",
        Explanation: scrubEurText((r.explanation || "").slice(0, 240)),
        IsNordic: /\.(HE|ST|CO|OL)$/.test(r.yahoo) ? 1 : 0,
        Region: /\.(HE|ST|CO|OL)$/.test(r.yahoo) ? "Nordic" : "Other",
        AbsDeltaEUR: Math.abs(delta),
        DeltaWeightPct: delta / equityBase,
        AbsDeltaWeightPct: Math.abs(delta) / equityBase,
      };
    })
  : [];
writeCsv(
  "FactRebalanceAction.csv",
  [
    "Action",
    "Name",
    "YahooSymbol",
    "CurrentEUR",
    "TargetEUR",
    "DeltaEUR",
    "Mom12m",
    "Rank",
    "Explanation",
    "IsNordic",
    "Region",
    "AbsDeltaEUR",
    "DeltaWeightPct",
    "AbsDeltaWeightPct",
  ],
  actionRows
);

// --- DimMandateRule ---
const capitalText = fs.readFileSync(capitalPath, "utf8");
const beforeLive = [];
const shortExtra = [];
let mode = null;
for (const line of capitalText.split(/\r?\n/)) {
  if (/before_any_live_eur:/.test(line)) mode = "before";
  else if (/short_sleeve_extra:/.test(line)) mode = "short";
  else if (/^\S/.test(line) && mode) mode = null;
  else if (mode && /^\s+-\s+(\S+)/.test(line)) {
    const id = line.match(/^\s+-\s+(\S+)/)[1];
    (mode === "before" ? beforeLive : shortExtra).push(id);
  }
}

const nextText = fs.existsSync(nextReviewPath)
  ? fs.readFileSync(nextReviewPath, "utf8")
  : "";
const proposeBy = (nextText.match(/propose_by:\s*"([^"]+)"/) || [])[1] || "";
const executeWindow = (nextText.match(/execute_window:\s*"([^"]+)"/) || [])[1] || "";
const workingPolicy =
  (nextText.match(/working_policy_id:\s*(\S+)/) || [])[1] || "mom_semi_max3";

const mandateRows = [
  ...beforeLive.map((id, i) => ({
    RuleId: id,
    Category: "Before any live EUR",
    CategorySort: 1,
    RuleSort: i + 1,
    Status: "Required",
    StatusFlag: 0,
  })),
  ...shortExtra.map((id, i) => ({
    RuleId: id,
    Category: "Short sleeve extra",
    CategorySort: 2,
    RuleSort: i + 1,
    Status: "Blocked",
    StatusFlag: 0,
  })),
];
writeCsv(
  "DimMandateRule.csv",
  ["RuleId", "Category", "CategorySort", "RuleSort", "Status", "StatusFlag"],
  mandateRows
);

// --- PortfolioMetrics (single row) ---
const excessCagr =
  mid && core ? Number(mid.CAGR) - Number(core.CAGR) : "";
const nordicInBook = holdingRows.filter((h) => h.IsNordic).length;
writeCsv(
  "PortfolioMetrics.csv",
  [
    "BookEUR",
    "EquityEUR",
    "CashEUR",
    "HoldingsAsOf",
    "TopN",
    "NamesHeld",
    "CoreCAGR",
    "MidCAGR",
    "ExcessCAGR",
    "CoreSharpe",
    "MidSharpe",
    "MidMaxDD",
    "MidAnnVol",
    "FeeBps",
    "SampleStart",
    "SampleEnd",
    "UniverseN",
    "WorkingPolicy",
    "ProposeBy",
    "ExecuteWindow",
    "RingFenceEUR",
    "PolicyBookEUR",
    "RingFenceWeightPct",
    "NordicNamesInBook",
    "MandateRules",
    "SimGeneratedAt",
    "Benchmark",
  ],
  [
    {
      BookEUR: bookEUR || totalPolicyEUR,
      EquityEUR: equityEUR || holdingRows.reduce((a, h) => a + Number(h.CurrentEUR), 0),
      CashEUR: cashEUR,
      HoldingsAsOf: holdingsAsOf,
      TopN: review?.top_n || 10,
      NamesHeld: holdingRows.length,
      CoreCAGR: core?.CAGR ?? "",
      MidCAGR: mid?.CAGR ?? "",
      ExcessCAGR: excessCagr,
      CoreSharpe: core?.Sharpe ?? "",
      MidSharpe: mid?.Sharpe ?? "",
      MidMaxDD: mid?.MaxDrawdown ?? "",
      MidAnnVol: mid?.AnnVol ?? "",
      FeeBps: sim.meta?.fee_bps ?? 5,
      SampleStart: sim.meta?.sample_start || "",
      SampleEnd: sim.meta?.sample_end || "",
      UniverseN: (sim.meta?.symbols || []).length,
      WorkingPolicy: workingPolicy,
      ProposeBy: proposeBy,
      ExecuteWindow: executeWindow,
      RingFenceEUR: ringFence,
      PolicyBookEUR: totalPolicyEUR,
      RingFenceWeightPct:
        totalPolicyEUR + ringFence
          ? ringFence / (totalPolicyEUR + ringFence)
          : 0,
      NordicNamesInBook: nordicInBook,
      MandateRules: mandateRows.length,
      SimGeneratedAt: sim.generated_at || "",
      Benchmark: sim.meta?.benchmark || "VWCE.DE",
    },
  ]
);

// --- Nordic gold copy ---
const dimCo = readCsv(path.join(nordicGold, "DimCompany.csv"));
const bookYahoo = new Set(holdingRows.map((h) => h.YahooSymbol));
const nordicCompanies = dimCo.map((r) => ({
  Ticker: r.Ticker,
  YahooSymbol: r.YahooSymbol,
  CompanyName: r.CompanyName,
  Country: r.Country,
  Sector: r.Sector,
  Industry: r.Industry,
  MarketCapEURm: r.MarketCapEURm,
  InMidUniverse: midUniverse.has(r.YahooSymbol) ? 1 : 0,
  InBook: bookYahoo.has(r.YahooSymbol) ? 1 : 0,
}));
writeCsv(
  "DimNordicCompany.csv",
  [
    "Ticker",
    "YahooSymbol",
    "CompanyName",
    "Country",
    "Sector",
    "Industry",
    "MarketCapEURm",
    "InMidUniverse",
    "InBook",
  ],
  nordicCompanies
);

const factPrices = readCsv(path.join(nordicGold, "FactPrices.csv"));
// Keep latest session rows + any InMidUniverse/InBook history thinned: full latest + mid overlap full history is heavy.
// Export latest-only for all + full history for InMidUniverse OR InBook tickers.
const midOrBookTickers = new Set(
  nordicCompanies
    .filter((c) => c.InMidUniverse || c.InBook)
    .map((c) => c.Ticker)
);
const latestByTicker = new Map();
for (const r of factPrices) {
  if (String(r.IsLatest) === "1" || String(r.IsLatest).toLowerCase() === "true") {
    latestByTicker.set(r.Ticker, r);
  }
}
const nordicPriceRows = [];
const seen = new Set();
for (const r of factPrices) {
  const keepHistory = midOrBookTickers.has(r.Ticker);
  const isLatest =
    String(r.IsLatest) === "1" || String(r.IsLatest).toLowerCase() === "true";
  if (!keepHistory && !isLatest) continue;
  const key = `${r.Date}|${r.Ticker}`;
  if (seen.has(key)) continue;
  seen.add(key);
  nordicPriceRows.push({
    Date: String(r.Date).slice(0, 10),
    Ticker: r.Ticker,
    Close: r.Close,
    ChangePct: r.ChangePct,
    RSI14: r.RSI14,
    IsLatest: isLatest ? 1 : 0,
    StrategySide: r.StrategySide || "Flat",
    IsSignal: r.IsSignal || 0,
    MarketCapEURm: r.MarketCapEURm,
  });
}
writeCsv(
  "FactNordicPrices.csv",
  [
    "Date",
    "Ticker",
    "Close",
    "ChangePct",
    "RSI14",
    "IsLatest",
    "StrategySide",
    "IsSignal",
    "MarketCapEURm",
  ],
  nordicPriceRows
);

// DimDate from equity curve + nordic latest
const dateSet = new Set();
for (const r of curveRows) dateSet.add(r.Date);
for (const r of nordicPriceRows) dateSet.add(r.Date);
const dimDates = [...dateSet]
  .filter(Boolean)
  .sort()
  .map((d) => {
    const dt = new Date(d + "T00:00:00Z");
    return {
      Date: d,
      Year: dt.getUTCFullYear(),
      Month: dt.getUTCMonth() + 1,
      YearMonth: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`,
      Quarter: Math.floor(dt.getUTCMonth() / 3) + 1,
    };
  });
writeCsv(
  "DimDate.csv",
  ["Date", "Year", "Month", "YearMonth", "Quarter"],
  dimDates
);

const meta = {
  generatedAt: new Date().toISOString(),
  investingRoot,
  nordicGold,
  simGeneratedAt: sim.generated_at,
  holdingsAsOf,
  counts: {
    DimSleeve: sleeves.length,
    FactSimSummary: summaries.length,
    FactEquityCurve: curveRows.length,
    FactPolicyCompare: policyRows.length,
    FactHolding: holdingRows.length,
    FactRebalanceAction: actionRows.length,
    DimMandateRule: mandateRows.length,
    DimNordicCompany: nordicCompanies.length,
    FactNordicPrices: nordicPriceRows.length,
    DimDate: dimDates.length,
  },
  hero: {
    ExcessCAGR: excessCagr,
    MidSharpe: mid?.Sharpe,
    CoreSharpe: core?.Sharpe,
  },
};
fs.writeFileSync(path.join(gold, "build-meta.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ ok: true, gold, ...meta }, null, 2));

/**
 * Scaffold InvestingDesk PBIP — institutional Investment Portfolio model + 7 page shells.
 * Run after: node scripts/export-from-sources.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const goldDir = path.join(root, "data", "gold").replace(/\\/g, "/");
const themeSrc = path.resolve(root, "../_shared/themes/Nordic-Boardroom-a1b2c3d4.json");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const sm = path.join(root, "InvestingDesk.SemanticModel");
const rpt = path.join(root, "InvestingDesk.Report");
const def = path.join(sm, "definition");
const tablesDir = path.join(def, "tables");
const exprDir = path.join(def, "expressions");

function hex(n) {
  return crypto.randomBytes(n).toString("hex");
}
function pageId() {
  return "ReportSection" + hex(12);
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function write(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}
function mtype(dataType) {
  switch (dataType) {
    case "int64":
      return "Int64.Type";
    case "double":
      return "type number";
    case "dateTime":
      return "type date";
    case "string":
      return "type text";
    default:
      throw new Error(`No M type for ${dataType}`);
  }
}
function csvPartition(tableName, fileName, typeSteps) {
  const types = typeSteps.map(([c, t]) => `{"${c}", ${t}}`).join(", ");
  return `
	partition ${tableName} = m
		mode: import
		source =
			let
				FolderPath = GoldDataFolder,
				FilePath = FolderPath & "/${fileName}",
				RawCsv = Csv.Document(File.Contents(FilePath), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
				WithHeaders = Table.PromoteHeaders(RawCsv, [PromoteAllScalars=true]),
				Typed = Table.TransformColumnTypes(WithHeaders, {${types}})
			in
				Typed
`.trimEnd();
}
function col(name, dataType, opts = {}) {
  const lines = [`\tcolumn ${name}`, `\t\tdataType: ${dataType}`];
  if (opts.formatString) lines.push(`\t\tformatString: ${opts.formatString}`);
  if (opts.isHidden) lines.push(`\t\tisHidden`);
  if (opts.summarizeBy !== undefined) lines.push(`\t\tsummarizeBy: ${opts.summarizeBy}`);
  if (opts.dataCategory) lines.push(`\t\tdataCategory: ${opts.dataCategory}`);
  if (opts.sortByColumn) lines.push(`\t\tsortByColumn: ${opts.sortByColumn}`);
  lines.push(`\t\tsourceColumn: ${name}`);
  return lines.join("\n") + "\n";
}
function qname(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name}'`;
}
function measure(name, expr, formatString) {
  const lines = [`\tmeasure ${qname(name)} = ${expr}`];
  if (formatString) lines.push(`\t\tformatString: ${formatString}`);
  return lines.join("\n") + "\n";
}
function tableBody(cols, csvFile, tableName, measures = []) {
  const parts = [];
  if (measures.length) parts.push(measures.join("\n"));
  parts.push(cols.map(([n, t, o]) => col(n, t, o)).join("\n"));
  parts.push(csvPartition(tableName, csvFile, cols.map(([n, t]) => [n, mtype(t)])));
  return parts.join("\n");
}
function writePlatform(dir, displayName, type) {
  write(
    path.join(dir, ".platform"),
    JSON.stringify(
      {
        $schema:
          "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        metadata: { type, displayName },
        config: { version: "2.0", logicalId: crypto.randomUUID() },
      },
      null,
      2
    )
  );
}

// Wipe prior model/report artifacts for clean scaffold
for (const d of [sm, rpt]) {
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
}
ensureDir(tablesDir);
ensureDir(exprDir);

write(
  path.join(sm, "definition.pbism"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
      version: "4.2",
      settings: { qnaEnabled: true },
    },
    null,
    2
  )
);
write(path.join(def, "database.tmdl"), `database InvestingDesk\n\tcompatibilityLevel: 1567\n`);
write(
  path.join(exprDir, "GoldDataFolder.tmdl"),
  `expression GoldDataFolder = "${goldDir}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n`
);

const tableNames = [
  "PortfolioMetrics",
  "DimSleeve",
  "DimDate",
  "DimMandateRule",
  "DimNordicCompany",
  "FactSimSummary",
  "FactEquityCurve",
  "FactPolicyCompare",
  "FactHolding",
  "FactRebalanceAction",
  "FactNordicPrices",
];

write(
  path.join(def, "model.tmdl"),
  `model Model
\tculture: en-US
\tdefaultPowerBIDataSourceVersion: powerBI_V3
\tsourceQueryCulture: en-US
\tdataAccessOptions
\t\tlegacyRedirects
\t\treturnErrorValuesAsNull

annotation PBI_QueryOrder = ["GoldDataFolder",${tableNames.map((t) => `"${t}"`).join(",")}]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
${tableNames.map((t) => `ref table ${t}`).join("\n")}
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactEquityCurve_DimDate
\tfromColumn: FactEquityCurve.Date
\ttoColumn: DimDate.Date

relationship FactNordicPrices_DimDate
\tfromColumn: FactNordicPrices.Date
\ttoColumn: DimDate.Date

relationship FactNordicPrices_DimNordicCompany
\tfromColumn: FactNordicPrices.Ticker
\ttoColumn: DimNordicCompany.Ticker
`
);

// PortfolioMetrics + measures
const pmCols = [
  ["BookEUR", "double", { formatString: "#,0", isHidden: true }],
  ["EquityEUR", "double", { formatString: "#,0", isHidden: true }],
  ["CashEUR", "double", { formatString: "#,0", isHidden: true }],
  ["HoldingsAsOf", "string", {}],
  ["TopN", "int64", { formatString: "0", summarizeBy: "none" }],
  ["NamesHeld", "int64", { formatString: "0", summarizeBy: "none" }],
  ["CoreCAGR", "double", { formatString: "0.0%" }],
  ["MidCAGR", "double", { formatString: "0.0%" }],
  ["ExcessCAGR", "double", { formatString: "0.0%" }],
  ["CoreSharpe", "double", { formatString: "0.00" }],
  ["MidSharpe", "double", { formatString: "0.00" }],
  ["MidMaxDD", "double", { formatString: "0.0%" }],
  ["MidAnnVol", "double", { formatString: "0.0%" }],
  ["FeeBps", "double", { formatString: "0.0" }],
  ["SampleStart", "string", {}],
  ["SampleEnd", "string", {}],
  ["UniverseN", "int64", { formatString: "0", summarizeBy: "none" }],
  ["WorkingPolicy", "string", {}],
  ["ProposeBy", "string", {}],
  ["ExecuteWindow", "string", {}],
  ["RingFenceEUR", "double", { formatString: "#,0", isHidden: true }],
  ["PolicyBookEUR", "double", { formatString: "#,0", isHidden: true }],
  ["RingFenceWeightPct", "double", { formatString: "0.0%" }],
  ["NordicNamesInBook", "int64", { formatString: "0", summarizeBy: "none" }],
  ["MandateRules", "int64", { formatString: "0", summarizeBy: "none" }],
  ["SimGeneratedAt", "string", {}],
  ["Benchmark", "string", {}],
];
const pmMeasures = [
  measure("Book EUR", "MAX(PortfolioMetrics[BookEUR])", "€#,0"),
  measure("Equity EUR", "MAX(PortfolioMetrics[EquityEUR])", "€#,0"),
  measure("Cash EUR", "MAX(PortfolioMetrics[CashEUR])", "€#,0"),
  measure("Names Held", "MAX(PortfolioMetrics[NamesHeld])", "#,0"),
  measure("Top N", "MAX(PortfolioMetrics[TopN])", "0"),
  measure("Core CAGR", "MAX(PortfolioMetrics[CoreCAGR])", "0.0%"),
  measure("Mid CAGR", "MAX(PortfolioMetrics[MidCAGR])", "0.0%"),
  measure("Excess CAGR", "MAX(PortfolioMetrics[ExcessCAGR])", "0.0%"),
  measure("Core Sharpe", "MAX(PortfolioMetrics[CoreSharpe])", "0.00"),
  measure("Mid Sharpe", "MAX(PortfolioMetrics[MidSharpe])", "0.00"),
  measure("Mid Max DD", "MAX(PortfolioMetrics[MidMaxDD])", "0.0%"),
  measure("Mid Ann Vol", "MAX(PortfolioMetrics[MidAnnVol])", "0.0%"),
  measure("Fee Bps", "MAX(PortfolioMetrics[FeeBps])", "0.0"),
  measure("Universe N", "MAX(PortfolioMetrics[UniverseN])", "#,0"),
  measure("Ring-Fence EUR", "MAX(PortfolioMetrics[RingFenceEUR])", "€#,0"),
  measure("Policy Book EUR", "MAX(PortfolioMetrics[PolicyBookEUR])", "€#,0"),
  measure("Ring-Fence Weight", "MAX(PortfolioMetrics[RingFenceWeightPct])", "0.0%"),
  measure("Nordic In Book", "MAX(PortfolioMetrics[NordicNamesInBook])", "#,0"),
  measure("Mandate Rule Count", "MAX(PortfolioMetrics[MandateRules])", "#,0"),
  measure("Cash Weight", "DIVIDE([Cash EUR], [Book EUR])", "0.0%"),
  measure("Equity Weight", "DIVIDE([Equity EUR], [Book EUR])", "0.0%"),
];
write(
  path.join(tablesDir, "PortfolioMetrics.tmdl"),
  `table PortfolioMetrics\n\n${tableBody(pmCols, "PortfolioMetrics.csv", "PortfolioMetrics", pmMeasures)}\n`
);

write(
  path.join(tablesDir, "DimSleeve.tmdl"),
  `table DimSleeve

${tableBody(
  [
    ["SleeveKey", "string", {}],
    ["SleeveName", "string", { sortByColumn: "SleeveSort" }],
    ["Broker", "string", {}],
    ["ApproxEUR", "double", { formatString: "#,0", isHidden: true }],
    ["Horizon", "string", {}],
    ["DayTrading", "int64", { formatString: "0", summarizeBy: "none" }],
    ["AssetClass", "string", {}],
    ["SleeveSort", "int64", { isHidden: true, summarizeBy: "none" }],
    ["IsActiveLoop", "int64", { formatString: "0", summarizeBy: "none" }],
    ["StatusNote", "string", {}],
    ["WeightPct", "double", { formatString: "0.0%" }],
  ],
  "DimSleeve.csv",
  "DimSleeve",
  [
    measure("Sleeve EUR", 'CALCULATE(SUM(DimSleeve[ApproxEUR]), DimSleeve[SleeveKey] <> "ringfence")', "€#,0"),
    measure("Sleeve Weight", 'CALCULATE(SUM(DimSleeve[WeightPct]), DimSleeve[SleeveKey] <> "ringfence")', "0.0%"),
    measure("Core Sleeve EUR", 'CALCULATE(SUM(DimSleeve[ApproxEUR]), DimSleeve[SleeveKey] = "core")', "€#,0"),
    measure("Mid Sleeve EUR", 'CALCULATE(SUM(DimSleeve[ApproxEUR]), DimSleeve[SleeveKey] = "mid")', "€#,0"),
    measure("Short Sleeve EUR", 'CALCULATE(SUM(DimSleeve[ApproxEUR]), DimSleeve[SleeveKey] = "short")', "€#,0"),
    measure(
      "Active Sleeve %",
      'DIVIDE(CALCULATE(SUM(DimSleeve[ApproxEUR]), DimSleeve[IsActiveLoop] = 1), [Sleeve EUR])',
      "0.0%"
    ),
    measure("Core Sleeve %", "DIVIDE([Core Sleeve EUR], [Sleeve EUR])", "0.0%"),
    measure("Mid Sleeve %", "DIVIDE([Mid Sleeve EUR], [Sleeve EUR])", "0.0%"),
    measure("Short Sleeve %", "DIVIDE([Short Sleeve EUR], [Sleeve EUR])", "0.0%"),
  ]
)}
`
);

write(
  path.join(tablesDir, "DimDate.tmdl"),
  `table DimDate
\tdataCategory: Time

${tableBody(
  [
    ["Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none", dataCategory: "Time" }],
    ["Year", "int64", { formatString: "0", summarizeBy: "none" }],
    ["Month", "int64", { formatString: "0", summarizeBy: "none" }],
    ["YearMonth", "string", {}],
    ["Quarter", "int64", { formatString: "0", summarizeBy: "none" }],
  ],
  "DimDate.csv",
  "DimDate"
)}
`
);

write(
  path.join(tablesDir, "DimMandateRule.tmdl"),
  `table DimMandateRule

${tableBody(
  [
    ["RuleId", "string", {}],
    ["Category", "string", { sortByColumn: "CategorySort" }],
    ["CategorySort", "int64", { isHidden: true, summarizeBy: "none" }],
    ["RuleSort", "int64", { summarizeBy: "none" }],
    ["Status", "string", {}],
    ["StatusFlag", "int64", { formatString: "0", summarizeBy: "none" }],
  ],
  "DimMandateRule.csv",
  "DimMandateRule",
  [
    measure("Rules Total", "COUNTROWS(DimMandateRule)", "#,0"),
    measure("Rules Met", "CALCULATE([Rules Total], DimMandateRule[StatusFlag] = 1)", "#,0"),
    measure("Mandate Compliance", "DIVIDE([Rules Met], [Rules Total])", "0.0%"),
  ]
)}
`
);

write(
  path.join(tablesDir, "DimNordicCompany.tmdl"),
  `table DimNordicCompany

${tableBody(
  [
    ["Ticker", "string", {}],
    ["YahooSymbol", "string", {}],
    ["CompanyName", "string", {}],
    ["Country", "string", {}],
    ["Sector", "string", {}],
    ["Industry", "string", {}],
    ["MarketCapEURm", "double", { formatString: "#,0" }],
    ["InMidUniverse", "int64", { formatString: "0", summarizeBy: "none" }],
    ["InBook", "int64", { formatString: "0", summarizeBy: "none" }],
  ],
  "DimNordicCompany.csv",
  "DimNordicCompany",
  [
    measure("Nordic Companies", "COUNTROWS(DimNordicCompany)", "#,0"),
    measure(
      "Overlap Names",
      "CALCULATE([Nordic Companies], DimNordicCompany[InMidUniverse] = 1)",
      "#,0"
    ),
    measure(
      "Book Nordic Names",
      "CALCULATE([Nordic Companies], DimNordicCompany[InBook] = 1)",
      "#,0"
    ),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactSimSummary.tmdl"),
  `table FactSimSummary

${tableBody(
  [
    ["Strategy", "string", {}],
    ["SeriesLabel", "string", {}],
    ["Role", "string", {}],
    ["StartEUR", "double", { formatString: "#,0" }],
    ["EndEUR", "double", { formatString: "#,0" }],
    ["TotalReturn", "double", { formatString: "0.0%" }],
    ["CAGR", "double", { formatString: "0.0%" }],
    ["AnnVol", "double", { formatString: "0.0%" }],
    ["Sharpe", "double", { formatString: "0.00" }],
    ["MaxDrawdown", "double", { formatString: "0.0%" }],
    ["Days", "int64", { formatString: "0", summarizeBy: "none" }],
  ],
  "FactSimSummary.csv",
  "FactSimSummary",
  [
    measure("Sim CAGR", "AVERAGE(FactSimSummary[CAGR])", "0.0%"),
    measure("Sim Sharpe", "AVERAGE(FactSimSummary[Sharpe])", "0.00"),
    measure("Sim Max DD", "AVERAGE(FactSimSummary[MaxDrawdown])", "0.0%"),
    measure("Sim Ann Vol", "AVERAGE(FactSimSummary[AnnVol])", "0.0%"),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactEquityCurve.tmdl"),
  `table FactEquityCurve

${tableBody(
  [
    ["Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" }],
    ["Series", "string", {}],
    ["EquityEUR", "double", { formatString: "#,0" }],
    ["EquityIndexed", "double", { formatString: "0.00" }],
    ["Drawdown", "double", { formatString: "0.0%" }],
  ],
  "FactEquityCurve.csv",
  "FactEquityCurve",
  [
    measure("Equity Indexed", "AVERAGE(FactEquityCurve[EquityIndexed])", "0.00"),
    measure("Drawdown Pct", "AVERAGE(FactEquityCurve[Drawdown])", "0.0%"),
    measure("Equity EUR Curve", "AVERAGE(FactEquityCurve[EquityEUR])", "€#,0"),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactPolicyCompare.tmdl"),
  `table FactPolicyCompare

${tableBody(
  [
    ["Label", "string", {}],
    ["ShortLabel", "string", {}],
    ["Role", "string", {}],
    ["FeeBps", "double", { formatString: "0.0" }],
    ["StartEUR", "double", { formatString: "#,0", isHidden: true }],
    ["EndEUR", "double", { formatString: "#,0", isHidden: true }],
    ["TotalReturn", "double", { formatString: "0.0%" }],
    ["CAGR", "double", { formatString: "0.0%" }],
    ["AnnVol", "double", { formatString: "0.0%" }],
    ["Sharpe", "double", { formatString: "0.00" }],
    ["SharpeVsBenchmark", "double", { formatString: "+0.00;-0.00;0.00" }],
    ["MaxDrawdown", "double", { formatString: "0.0%" }],
    ["AnnOnewayTurnover", "double", { formatString: "0.00" }],
    ["AvgNamesChanged", "double", { formatString: "0.0" }],
    ["AvgHoldings", "double", { formatString: "0.0" }],
    ["Rebalances", "double", { formatString: "0" }],
    ["Days", "double", { formatString: "0" }],
  ],
  "FactPolicyCompare.csv",
  "FactPolicyCompare",
  [
    measure("Policy CAGR", "AVERAGE(FactPolicyCompare[CAGR])", "0.0%"),
    measure("Policy Sharpe", "AVERAGE(FactPolicyCompare[Sharpe])", "0.00"),
    measure("Policy Sharpe vs BM", "AVERAGE(FactPolicyCompare[SharpeVsBenchmark])", "+0.00;-0.00;0.00"),
    measure("Policy Max DD", "AVERAGE(FactPolicyCompare[MaxDrawdown])", "0.0%"),
    measure("Policy Vol", "AVERAGE(FactPolicyCompare[AnnVol])", "0.0%"),
    measure("Policy Turnover", "AVERAGE(FactPolicyCompare[AnnOnewayTurnover])", "0.00"),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactHolding.tmdl"),
  `table FactHolding

${tableBody(
  [
    ["Name", "string", {}],
    ["YahooSymbol", "string", {}],
    ["CurrentEUR", "double", { formatString: "#,0", isHidden: true }],
    ["TargetEUR", "double", { formatString: "#,0", isHidden: true }],
    ["DeltaEUR", "double", { formatString: "#,0", isHidden: true }],
    ["WeightPct", "double", { formatString: "0.0%" }],
    ["TargetWeightPct", "double", { formatString: "0.0%" }],
    ["DeltaWeightPct", "double", { formatString: "+0.0%;-0.0%;0.0%" }],
    ["Mom12m", "double", { formatString: "0.0%" }],
    ["Rank", "string", {}],
    ["Action", "string", {}],
    ["InTargetBook", "int64", { formatString: "0", summarizeBy: "none" }],
    ["IsNordic", "int64", { formatString: "0", summarizeBy: "none" }],
    ["Region", "string", {}],
  ],
  "FactHolding.csv",
  "FactHolding",
  [
    measure("Holding EUR", "SUM(FactHolding[CurrentEUR])", "€#,0"),
    measure("Holding Weight", "SUM(FactHolding[WeightPct])", "0.0%"),
    measure("Target Weight", "SUM(FactHolding[TargetWeightPct])", "0.0%"),
    measure("Delta Weight", "SUM(FactHolding[DeltaWeightPct])", "+0.0%;-0.0%;0.0%"),
    measure("Holding Count", "COUNTROWS(FactHolding)", "#,0"),
    measure("Avg Mom 12m", "AVERAGE(FactHolding[Mom12m])", "0.0%"),
    measure(
      "Nordic Holding Weight",
      "CALCULATE([Holding Weight], FactHolding[IsNordic] = 1)",
      "0.0%"
    ),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactRebalanceAction.tmdl"),
  `table FactRebalanceAction

${tableBody(
  [
    ["Action", "string", {}],
    ["Name", "string", {}],
    ["YahooSymbol", "string", {}],
    ["CurrentEUR", "double", { formatString: "#,0", isHidden: true }],
    ["TargetEUR", "double", { formatString: "#,0", isHidden: true }],
    ["DeltaEUR", "double", { formatString: "#,0", isHidden: true }],
    ["Mom12m", "double", { formatString: "0.0%" }],
    ["Rank", "string", {}],
    ["Explanation", "string", {}],
    ["IsNordic", "int64", { formatString: "0", summarizeBy: "none" }],
    ["Region", "string", {}],
    ["AbsDeltaEUR", "double", { formatString: "#,0", isHidden: true }],
    ["DeltaWeightPct", "double", { formatString: "+0.0%;-0.0%;0.0%" }],
    ["AbsDeltaWeightPct", "double", { formatString: "0.0%" }],
  ],
  "FactRebalanceAction.csv",
  "FactRebalanceAction",
  [
    measure("Action Count", "COUNTROWS(FactRebalanceAction)", "#,0"),
    measure("Net Delta Weight", "SUM(FactRebalanceAction[DeltaWeightPct])", "+0.0%;-0.0%;0.0%"),
    measure("Abs Delta Weight", "SUM(FactRebalanceAction[AbsDeltaWeightPct])", "0.0%"),
  ]
)}
`
);

write(
  path.join(tablesDir, "FactNordicPrices.tmdl"),
  `table FactNordicPrices

${tableBody(
  [
    ["Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" }],
    ["Ticker", "string", {}],
    ["Close", "double", { formatString: "#,0.00" }],
    ["ChangePct", "double", { formatString: "0.00%" }],
    ["RSI14", "double", { formatString: "0.0" }],
    ["IsLatest", "int64", { formatString: "0", summarizeBy: "none" }],
    ["StrategySide", "string", {}],
    ["IsSignal", "int64", { formatString: "0", summarizeBy: "none" }],
    ["MarketCapEURm", "double", { formatString: "#,0" }],
  ],
  "FactNordicPrices.csv",
  "FactNordicPrices",
  [
    measure(
      "Avg Day Change",
      "CALCULATE(AVERAGE(FactNordicPrices[ChangePct]), FactNordicPrices[IsLatest] = 1)",
      "0.00%"
    ),
    measure(
      "RSI Signal Count",
      "CALCULATE(SUM(FactNordicPrices[IsSignal]), FactNordicPrices[IsLatest] = 1)",
      "#,0"
    ),
    measure(
      "Latest Close",
      "CALCULATE(AVERAGE(FactNordicPrices[Close]), FactNordicPrices[IsLatest] = 1)",
      "#,0.00"
    ),
    measure(
      "Overlap Day Change",
      "CALCULATE([Avg Day Change], DimNordicCompany[InMidUniverse] = 1)",
      "0.00%"
    ),
  ]
)}
`
);

// --- Report ---
const pages = {
  landing: pageId(),
  allocation: pageId(),
  performance: pageId(),
  holdings: pageId(),
  risk: pageId(),
  regional: pageId(),
  notes: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "InvestingDesk.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "InvestingDesk.Report" } }],
      settings: { enableAutoRecovery: true },
    },
    null,
    2
  )
);
write(
  path.join(rpt, "definition.pbir"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
      version: "4.0",
      datasetReference: { byPath: { path: "../InvestingDesk.SemanticModel" } },
    },
    null,
    2
  )
);
writePlatform(rpt, "Investment Portfolio", "Report");
writePlatform(sm, "Investment Portfolio", "SemanticModel");

ensureDir(path.join(rpt, "StaticResources", "SharedResources", "BaseThemes"));
ensureDir(path.join(rpt, "StaticResources", "RegisteredResources"));
fs.copyFileSync(themeSrc, path.join(rpt, "StaticResources", "RegisteredResources", themeFileName));
const themeJson = JSON.parse(
  fs.readFileSync(path.join(rpt, "StaticResources", "RegisteredResources", themeFileName), "utf8")
);
themeJson.name = themeFileName;
fs.writeFileSync(
  path.join(rpt, "StaticResources", "RegisteredResources", themeFileName),
  JSON.stringify(themeJson, null, 2)
);

const reportVersionAtImport = { visual: "1.8.92", report: "2.0.84", page: "1.3.40" };
write(
  path.join(rpt, "definition", "version.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
      version: "2.0.0",
    },
    null,
    2
  )
);
write(
  path.join(rpt, "definition", "report.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
      themeCollection: {
        baseTheme: { name: "CY25SU06", reportVersionAtImport, type: "SharedResources" },
        customTheme: { name: themeFileName, reportVersionAtImport, type: "RegisteredResources" },
      },
      objects: {
        section: [{ properties: { verticalAlignment: { expr: { Literal: { Value: "'Middle'" } } } } }],
      },
      resourcePackages: [
        {
          name: "SharedResources",
          type: "SharedResources",
          items: [{ name: "CY25SU06", path: "BaseThemes/CY25SU06.json", type: "BaseTheme" }],
        },
        {
          name: "RegisteredResources",
          type: "RegisteredResources",
          items: [{ name: themeFileName, path: themeFileName, type: "CustomTheme" }],
        },
      ],
      settings: {
        useStylableVisualContainerHeader: true,
        exportDataMode: "AllowSummarized",
      },
      publicCustomVisuals: [],
    },
    null,
    2
  )
);
write(
  path.join(rpt, "StaticResources", "SharedResources", "BaseThemes", "CY25SU06.json"),
  JSON.stringify(
    { name: "CY25SU06", dataColors: ["#2F5F73"], foreground: "#0F1C24", background: "#FFFFFF" },
    null,
    2
  )
);

const pagesRootDir = path.join(rpt, "definition", "pages");
ensureDir(pagesRootDir);
write(
  path.join(pagesRootDir, "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [
        pages.landing,
        pages.allocation,
        pages.performance,
        pages.holdings,
        pages.risk,
        pages.regional,
        pages.notes,
      ],
      activePageName: pages.landing,
    },
    null,
    2
  )
);

function pageShell(pageKey, displayName) {
  const pageDir = path.join(pagesRootDir, pageKey);
  ensureDir(path.join(pageDir, "visuals"));
  write(
    path.join(pageDir, "page.json"),
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: pageKey,
        displayName,
        displayOption: "FitToPage",
        height: 1080,
        width: 1920,
        objects: {
          background: [
            {
              properties: {
                color: { solid: { color: { expr: { Literal: { Value: "'#F7FAFC'" } } } } },
                transparency: { expr: { Literal: { Value: "0D" } } },
              },
            },
          ],
        },
      },
      null,
      2
    )
  );
}

pageShell(pages.landing, "Landing");
pageShell(pages.allocation, "Asset Allocation");
pageShell(pages.performance, "Performance");
pageShell(pages.holdings, "Holdings & Rebalance");
pageShell(pages.risk, "Risk & Mandate");
pageShell(pages.regional, "Regional Markets");
pageShell(pages.notes, "Notes");

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      pbip: path.join(root, "InvestingDesk.pbip"),
      goldDir,
    },
    null,
    2
  )
);

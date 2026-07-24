/**
 * Scaffold Logistics Pulse PBIP — Olist delivery star + 4-page Nordic mist shells.
 * Gold CSVs expected under data/gold/ (see build-gold.py / forecast-demand.py).
 * Landing page is created by elevate-logistics-report.mjs, not here.
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

const sm = path.join(root, "LogisticsPulse.SemanticModel");
const rpt = path.join(root, "LogisticsPulse.Report");
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

function csvPartition(tableName, fileName, typeSteps) {
  const types = typeSteps.map(([c, t]) => `{"${c}", ${t}}`).join(", ");
  return `
	partition ${tableName} = m
		mode: import
		source =
			let
				Source = Csv.Document(File.Contents(GoldDataFolder & "/${fileName}"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
				#"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
				#"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers", {${types}})
			in
				#"Changed Type"
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

// --- Semantic model ---
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

write(
  path.join(def, "database.tmdl"),
  `database LogisticsPulse
\tcompatibilityLevel: 1567
`
);

write(
  path.join(exprDir, "GoldDataFolder.tmdl"),
  `expression GoldDataFolder = "${goldDir}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]
`
);

write(
  path.join(def, "model.tmdl"),
  `model Model
\tculture: en-US
\tdefaultPowerBIDataSourceVersion: powerBI_V3
\tsourceQueryCulture: en-US
\tdataAccessOptions
\t\tlegacyRedirects
\t\treturnErrorValuesAsNull

annotation PBI_QueryOrder = ["GoldDataFolder","DimDate","DimSeller","DimProduct","DimCustomer","FactOrders","FactDemandWeekly","FactForecast","FactCorridor","ModelMetrics"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimDate
ref table DimSeller
ref table DimProduct
ref table DimCustomer
ref table FactOrders
ref table FactDemandWeekly
ref table FactForecast
ref table FactCorridor
ref table ModelMetrics
`
);

// Only FactOrders relates to dimensions; forecast/corridor/product/metrics/weekly stay disconnected.
write(
  path.join(def, "relationships.tmdl"),
  `relationship FactOrders_DimDate
\tfromColumn: FactOrders.OrderDate
\ttoColumn: DimDate.Date

relationship FactOrders_DimSeller
\tfromColumn: FactOrders.SellerID
\ttoColumn: DimSeller.SellerID

relationship FactOrders_DimCustomer
\tfromColumn: FactOrders.CustomerID
\ttoColumn: DimCustomer.CustomerID
`
);

// --- DimDate ---
write(
  path.join(tablesDir, "DimDate.tmdl"),
  `table DimDate
\tdataCategory: Time

${col("Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none", dataCategory: "Time" })}
${col("Year", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Month", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("MonthName", "string", { sortByColumn: "Month" })}
${col("YearMonth", "string", { sortByColumn: "MonthYearSort" })}
${col("Quarter", "string")}
${col("YearQuarter", "string")}
${col("Day", "int64", { formatString: "0", summarizeBy: "none" })}
${col("MonthYearSort", "int64", { isHidden: true, summarizeBy: "none" })}
${csvPartition("DimDate", "DimDate.csv", [
  ["Date", "type date"],
  ["Year", "Int64.Type"],
  ["Month", "Int64.Type"],
  ["MonthName", "type text"],
  ["YearMonth", "type text"],
  ["Quarter", "type text"],
  ["YearQuarter", "type text"],
  ["Day", "Int64.Type"],
  ["MonthYearSort", "Int64.Type"],
])}
`
);

// --- DimSeller ---
write(
  path.join(tablesDir, "DimSeller.tmdl"),
  `table DimSeller

\tmeasure Sellers = COUNTROWS(DimSeller)
\t\tformatString: #,0

\tmeasure 'High Risk Sellers' = CALCULATE([Sellers], DimSeller[RiskBand] = "High")
\t\tformatString: #,0

\tmeasure 'Seller Order N' = SUM(DimSeller[OrderN])
\t\tformatString: #,0

\tmeasure 'Seller Late Rate' = AVERAGE(DimSeller[LateRate])
\t\tformatString: 0.0%

\tmeasure 'Seller Avg Freight' = AVERAGE(DimSeller[AvgFreight])
\t\tformatString: #,0.00

${col("SellerID", "string", { summarizeBy: "none" })}
${col("OrderN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("LateRate", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("AvgFreight", "double", { formatString: "#,0.00", summarizeBy: "none" })}
${col("AvgLeadTime", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("CustomerStateN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("City", "string")}
${col("State", "string")}
${col("RiskBand", "string")}
${col("RecommendedAction", "string")}
${col("RiskRank", "int64", { formatString: "#,0", summarizeBy: "none" })}
${csvPartition("DimSeller", "DimSeller.csv", [
  ["SellerID", "type text"],
  ["OrderN", "Int64.Type"],
  ["LateRate", "type number"],
  ["AvgFreight", "type number"],
  ["AvgLeadTime", "type number"],
  ["CustomerStateN", "Int64.Type"],
  ["City", "type text"],
  ["State", "type text"],
  ["RiskBand", "type text"],
  ["RecommendedAction", "type text"],
  ["RiskRank", "Int64.Type"],
])}
`
);

// --- DimProduct (disconnected — category-level lookup, no relationship) ---
write(
  path.join(tablesDir, "DimProduct.tmdl"),
  `table DimProduct

${col("Category", "string", { summarizeBy: "none" })}
${col("OrderN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("LateRate", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("AvgLeadTime", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${csvPartition("DimProduct", "DimProduct.csv", [
  ["Category", "type text"],
  ["OrderN", "Int64.Type"],
  ["LateRate", "type number"],
  ["AvgLeadTime", "type number"],
])}
`
);

// --- DimCustomer ---
write(
  path.join(tablesDir, "DimCustomer.tmdl"),
  `table DimCustomer

${col("CustomerID", "string", { summarizeBy: "none" })}
${col("State", "string")}
${col("OrderN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${csvPartition("DimCustomer", "DimCustomer.csv", [
  ["CustomerID", "type text"],
  ["State", "type text"],
  ["OrderN", "Int64.Type"],
])}
`
);

// --- FactOrders ---
write(
  path.join(tablesDir, "FactOrders.tmdl"),
  `table FactOrders

\tmeasure Orders = COUNTROWS(FactOrders)
\t\tformatString: #,0

\tmeasure 'OnTime Orders' = CALCULATE([Orders], FactOrders[OnTime] = 1)
\t\tformatString: #,0

\tmeasure 'On-time %' = DIVIDE([OnTime Orders], [Orders])
\t\tformatString: 0.0%

\tmeasure 'Late Orders' = CALCULATE([Orders], FactOrders[LateFlag] = 1)
\t\tformatString: #,0

\tmeasure 'Avg Lead Time' = AVERAGE(FactOrders[LeadTimeDays])
\t\tformatString: #,0.0

\tmeasure 'Avg Freight' = AVERAGE(FactOrders[Freight])
\t\tformatString: #,0.00

${col("OrderID", "string", { summarizeBy: "none" })}
${col("CustomerID", "string", { summarizeBy: "none" })}
${col("OrderDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("SellerID", "string", { summarizeBy: "none" })}
${col("CustomerState", "string")}
${col("SellerState", "string")}
${col("Category", "string")}
${col("OnTime", "int64", { formatString: "0", summarizeBy: "none" })}
${col("LateFlag", "int64", { formatString: "0", summarizeBy: "none" })}
${col("LeadTimeDays", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Freight", "double", { formatString: "#,0.00", summarizeBy: "none" })}
${col("ItemCount", "int64", { formatString: "0", summarizeBy: "none" })}
${col("SellerCount", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactOrders", "FactOrders.csv", [
  ["OrderID", "type text"],
  ["CustomerID", "type text"],
  ["OrderDate", "type date"],
  ["SellerID", "type text"],
  ["CustomerState", "type text"],
  ["SellerState", "type text"],
  ["Category", "type text"],
  ["OnTime", "Int64.Type"],
  ["LateFlag", "Int64.Type"],
  ["LeadTimeDays", "Int64.Type"],
  ["Freight", "type number"],
  ["ItemCount", "Int64.Type"],
  ["SellerCount", "Int64.Type"],
])}
`
);

// --- FactDemandWeekly (disconnected — raw weekly actuals history) ---
write(
  path.join(tablesDir, "FactDemandWeekly.tmdl"),
  `table FactDemandWeekly

\tmeasure 'Weekly Orders' = SUM(FactDemandWeekly[Orders])
\t\tformatString: #,0

${col("WeekStart", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("Orders", "int64", { formatString: "#,0", summarizeBy: "none" })}
${csvPartition("FactDemandWeekly", "FactDemandWeekly.csv", [
  ["WeekStart", "type date"],
  ["Orders", "Int64.Type"],
])}
`
);

// --- FactForecast (disconnected — signature prediction-interval band) ---
write(
  path.join(tablesDir, "FactForecast.tmdl"),
  `table FactForecast

\tmeasure 'Forecast Horizon Orders' = CALCULATE(SUM(FactForecast[Forecast]), FactForecast[IsFuture] = 1)
\t\tformatString: #,0

\tmeasure 'Sum Actual' = SUM(FactForecast[Actual])
\t\tformatString: #,0

\tmeasure 'Sum Forecast' = SUM(FactForecast[Forecast])
\t\tformatString: #,0

\tmeasure 'Sum Lo80' = SUM(FactForecast[Lo80])
\t\tformatString: #,0

\tmeasure 'Sum Hi80' = SUM(FactForecast[Hi80])
\t\tformatString: #,0

\tmeasure 'Sum Band Width' = SUM(FactForecast[BandWidth])
\t\tformatString: #,0

${col("WeekStart", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("Actual", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("Forecast", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("Lo80", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("Hi80", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("Lo95", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("Hi95", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("BandWidth", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("IsFuture", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactForecast", "FactForecast.csv", [
  ["WeekStart", "type date"],
  ["Actual", "type number"],
  ["Forecast", "type number"],
  ["Lo80", "type number"],
  ["Hi80", "type number"],
  ["Lo95", "type number"],
  ["Hi95", "type number"],
  ["BandWidth", "type number"],
  ["IsFuture", "Int64.Type"],
])}
`
);

// --- FactCorridor (disconnected — seller_state × customer_state) ---
write(
  path.join(tablesDir, "FactCorridor.tmdl"),
  `table FactCorridor

${col("SellerState", "string", { summarizeBy: "none" })}
${col("CustomerState", "string", { summarizeBy: "none" })}
${col("Orders", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("LateRate", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("AvgLeadTime", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("AvgFreight", "double", { formatString: "#,0.00", summarizeBy: "none" })}
${csvPartition("FactCorridor", "FactCorridor.csv", [
  ["SellerState", "type text"],
  ["CustomerState", "type text"],
  ["Orders", "Int64.Type"],
  ["LateRate", "type number"],
  ["AvgLeadTime", "type number"],
  ["AvgFreight", "type number"],
])}
`
);

// --- ModelMetrics (disconnected — 1-row forecast backtest summary) ---
write(
  path.join(tablesDir, "ModelMetrics.tmdl"),
  `table ModelMetrics

\tmeasure 'Holdout MAPE' = MAX(ModelMetrics[HoldoutMAPE])
\t\tformatString: 0.0%

\tmeasure 'Coverage 80' = MAX(ModelMetrics[Coverage80])
\t\tformatString: 0.0%

\tmeasure 'Coverage 95' = MAX(ModelMetrics[Coverage95])
\t\tformatString: 0.0%

${col("HoldoutMAPE", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("Coverage80", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("Coverage95", "double", { formatString: "0.0%", summarizeBy: "none" })}
${col("Method", "string")}
${col("HorizonWeeks", "int64", { formatString: "0", summarizeBy: "none" })}
${col("HoldoutWeeks", "int64", { formatString: "0", summarizeBy: "none" })}
${col("SampleN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("WeekCount", "int64", { formatString: "#,0", summarizeBy: "none" })}
${csvPartition("ModelMetrics", "ModelMetrics.csv", [
  ["HoldoutMAPE", "type number"],
  ["Coverage80", "type number"],
  ["Coverage95", "type number"],
  ["Method", "type text"],
  ["HorizonWeeks", "Int64.Type"],
  ["HoldoutWeeks", "Int64.Type"],
  ["SampleN", "Int64.Type"],
  ["WeekCount", "Int64.Type"],
])}
`
);

// --- Report scaffolding ---
const pages = {
  pulse: pageId(),
  sellers: pageId(),
  demand: pageId(),
  context: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "LogisticsPulse.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "LogisticsPulse.Report" } }],
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
      datasetReference: { byPath: { path: "../LogisticsPulse.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Logistics Pulse", "Report");
writePlatform(sm, "Logistics Pulse", "SemanticModel");

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

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.pulse, pages.sellers, pages.demand, pages.context],
      activePageName: pages.pulse,
    },
    null,
    2
  )
);

function pageShell(pageKey, displayName, extra = {}) {
  const pageDir = path.join(rpt, "definition", "pages", pageKey);
  ensureDir(path.join(pageDir, "visuals"));
  const page = {
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
    ...extra,
  };
  write(path.join(pageDir, "page.json"), JSON.stringify(page, null, 2));
  return pageDir;
}

pageShell(pages.pulse, "Delivery Pulse");
pageShell(pages.sellers, "Sellers & Routes");
pageShell(pages.demand, "Demand Outlook");
pageShell(pages.context, "Context");

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      sm,
      rpt,
      goldDir,
      relationships: [
        "FactOrders.OrderDate → DimDate.Date",
        "FactOrders.SellerID → DimSeller.SellerID",
        "FactOrders.CustomerID → DimCustomer.CustomerID",
        "DimProduct disconnected",
        "FactDemandWeekly disconnected",
        "FactForecast disconnected",
        "FactCorridor disconnected",
        "ModelMetrics disconnected",
      ],
      note: "Landing page is created by elevate-logistics-report.mjs",
      pbip: path.join(root, "LogisticsPulse.pbip"),
    },
    null,
    2
  )
);

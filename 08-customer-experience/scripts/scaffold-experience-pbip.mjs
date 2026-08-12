/**
 * Scaffold Experience Pulse PBIP — Olist reviews × delivery star + 4 analysis page shells.
 * Gold CSVs expected under data/gold/ (see enrich-reviews.py; dims synced from 04-supply-chain).
 * Landing page is created by elevate (not here).
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

const sm = path.join(root, "ExperiencePulse.SemanticModel");
const rpt = path.join(root, "ExperiencePulse.Report");
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
  `database ExperiencePulse
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimDate","DimSeller","DimProduct","DimTheme","FactReviews","FactReviewTheme","FactThemeQuotes","FactOrders"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimDate
ref table DimSeller
ref table DimProduct
ref table DimTheme
ref table FactReviews
ref table FactReviewTheme
ref table FactThemeQuotes
ref table FactOrders
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactReviews_DimDate
\tfromColumn: FactReviews.ReviewDate
\ttoColumn: DimDate.Date

relationship FactReviews_DimSeller
\tfromColumn: FactReviews.SellerID
\ttoColumn: DimSeller.SellerID

relationship FactReviews_DimProduct
\tfromColumn: FactReviews.Category
\ttoColumn: DimProduct.Category

relationship FactReviewTheme_FactReviews
\tfromColumn: FactReviewTheme.ReviewID
\ttoColumn: FactReviews.ReviewID

relationship FactReviewTheme_DimTheme
\tfromColumn: FactReviewTheme.Theme
\ttoColumn: DimTheme.Theme

relationship FactThemeQuotes_DimTheme
\tfromColumn: FactThemeQuotes.Theme
\ttoColumn: DimTheme.Theme
`
);

// --- DimDate (synced from logistics gold) ---
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

// --- DimProduct (category lookup; related via FactReviews[Category]) ---
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

// --- DimTheme ---
write(
  path.join(tablesDir, "DimTheme.tmdl"),
  `table DimTheme

${col("Theme", "string", { sortByColumn: "ThemeSort", summarizeBy: "none" })}
${col("ThemeSort", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("PrimaryReviewN", "int64", { formatString: "#,0", summarizeBy: "none" })}
${csvPartition("DimTheme", "DimTheme.csv", [
  ["Theme", "type text"],
  ["ThemeSort", "Int64.Type"],
  ["PrimaryReviewN", "Int64.Type"],
])}
`
);

// --- FactReviews (primary fact + CX measures) ---
write(
  path.join(tablesDir, "FactReviews.tmdl"),
  `table FactReviews

\tmeasure Reviews = COUNTROWS(FactReviews)
\t\tformatString: #,0

\tmeasure 'Avg Review Score' = AVERAGE(FactReviews[ReviewScore])
\t\tformatString: 0.00

\tmeasure 'CSAT %' = DIVIDE(CALCULATE(COUNTROWS(FactReviews), FactReviews[ReviewScore] >= 4), [Reviews])
\t\tformatString: 0.0%

\tmeasure 'Proxy NPS' = DIVIDE(CALCULATE(COUNTROWS(FactReviews), FactReviews[ProxyNPSClass] = "Promoter"), [Reviews]) - DIVIDE(CALCULATE(COUNTROWS(FactReviews), FactReviews[ProxyNPSClass] = "Detractor"), [Reviews])
\t\tformatString: 0.0%

\tmeasure 'Detractor %' = DIVIDE(CALCULATE(COUNTROWS(FactReviews), FactReviews[ProxyNPSClass] = "Detractor"), [Reviews])
\t\tformatString: 0.0%

\tmeasure 'Detractor Reviews' = CALCULATE(COUNTROWS(FactReviews), FactReviews[ProxyNPSClass] = "Detractor")
\t\tformatString: #,0

\tmeasure 'On-time Avg Score' = CALCULATE(AVERAGE(FactReviews[ReviewScore]), FactReviews[LateFlag] = 0)
\t\tformatString: 0.00

\tmeasure 'Late Avg Score' = CALCULATE(AVERAGE(FactReviews[ReviewScore]), FactReviews[LateFlag] = 1)
\t\tformatString: 0.00

\tmeasure 'Score Gap' = [On-time Avg Score] - [Late Avg Score]
\t\tformatString: 0.00

\tmeasure 'Late Share of Detractors' = DIVIDE(CALCULATE(COUNTROWS(FactReviews), FactReviews[ProxyNPSClass] = "Detractor", FactReviews[LateFlag] = 1), [Detractor Reviews])
\t\tformatString: 0.0%

\tmeasure 'Top Detractor Theme' =
\t\tVAR _themes =
\t\t\tCALCULATETABLE(
\t\t\t\tVALUES(FactReviews[ThemePrimary]),
\t\t\t\tFactReviews[ProxyNPSClass] = "Detractor"
\t\t\t)
\t\tRETURN
\t\t\tCALCULATE(
\t\t\t\tFIRSTNONBLANK(FactReviews[ThemePrimary], 0),
\t\t\t\tTOPN(1, _themes, CALCULATE(COUNTROWS(FactReviews)), DESC),
\t\t\t\tFactReviews[ProxyNPSClass] = "Detractor"
\t\t\t)

\tmeasure 'Coverage %' = DIVIDE(DISTINCTCOUNT(FactReviews[OrderID]), COUNTROWS(FactOrders))
\t\tformatString: 0.0%

${col("ReviewID", "string", { summarizeBy: "none" })}
${col("OrderID", "string", { summarizeBy: "none" })}
${col("CustomerID", "string", { summarizeBy: "none" })}
${col("SellerID", "string", { summarizeBy: "none" })}
${col("Category", "string")}
${col("CustomerState", "string")}
${col("OrderDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("ReviewDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("ReviewScore", "int64", { formatString: "0", summarizeBy: "none" })}
${col("ScoreBand", "string")}
${col("ProxyNPSClass", "string")}
${col("DeliveryOutcome", "string", { sortByColumn: "DeliveryOutcomeSort" })}
${col("DeliveryOutcomeSort", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("OnTime", "int64", { formatString: "0", summarizeBy: "none" })}
${col("LateFlag", "int64", { formatString: "0", summarizeBy: "none" })}
${col("LeadTimeDays", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Freight", "double", { formatString: "#,0.00", summarizeBy: "none" })}
${col("HasComment", "int64", { formatString: "0", summarizeBy: "none" })}
${col("CommentPT", "string")}
${col("CommentEN", "string")}
${col("ThemePrimary", "string")}
${col("ThemeCount", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactReviews", "FactReviews.csv", [
  ["ReviewID", "type text"],
  ["OrderID", "type text"],
  ["CustomerID", "type text"],
  ["SellerID", "type text"],
  ["Category", "type text"],
  ["CustomerState", "type text"],
  ["OrderDate", "type date"],
  ["ReviewDate", "type date"],
  ["ReviewScore", "Int64.Type"],
  ["ScoreBand", "type text"],
  ["ProxyNPSClass", "type text"],
  ["DeliveryOutcome", "type text"],
  ["DeliveryOutcomeSort", "Int64.Type"],
  ["OnTime", "Int64.Type"],
  ["LateFlag", "Int64.Type"],
  ["LeadTimeDays", "Int64.Type"],
  ["Freight", "type number"],
  ["HasComment", "Int64.Type"],
  ["CommentPT", "type text"],
  ["CommentEN", "type text"],
  ["ThemePrimary", "type text"],
  ["ThemeCount", "Int64.Type"],
])}
`
);

// --- FactReviewTheme (review × theme bridge) ---
write(
  path.join(tablesDir, "FactReviewTheme.tmdl"),
  `table FactReviewTheme

	measure 'Theme Reviews' = COUNTROWS(FactReviewTheme)
		formatString: #,0

${col("ReviewID", "string", { summarizeBy: "none" })}
${col("Theme", "string")}
${csvPartition("FactReviewTheme", "FactReviewTheme.csv", [
  ["ReviewID", "type text"],
  ["Theme", "type text"],
])}
`
);

// --- FactThemeQuotes (callout exemplars) ---
write(
  path.join(tablesDir, "FactThemeQuotes.tmdl"),
  `table FactThemeQuotes

${col("Theme", "string")}
${col("ProxyNPSClass", "string")}
${col("ReviewScore", "int64", { formatString: "0", summarizeBy: "none" })}
${col("QuoteEN", "string")}
${col("OrderID", "string", { summarizeBy: "none" })}
${col("LateFlag", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactThemeQuotes", "FactThemeQuotes.csv", [
  ["Theme", "type text"],
  ["ProxyNPSClass", "type text"],
  ["ReviewScore", "Int64.Type"],
  ["QuoteEN", "type text"],
  ["OrderID", "type text"],
  ["LateFlag", "Int64.Type"],
])}
`
);

// --- FactOrders (synced from logistics; disconnected — Coverage % denominator) ---
write(
  path.join(tablesDir, "FactOrders.tmdl"),
  `table FactOrders

\tmeasure Orders = COUNTROWS(FactOrders)
\t\tformatString: #,0

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

// --- Report scaffolding ---
const pages = {
  pulse: pageId(),
  drivers: pageId(),
  recovery: pageId(),
  context: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "ExperiencePulse.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "ExperiencePulse.Report" } }],
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
      datasetReference: { byPath: { path: "../ExperiencePulse.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Experience Pulse", "Report");
writePlatform(sm, "Experience Pulse", "SemanticModel");

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
      pageOrder: [pages.pulse, pages.drivers, pages.recovery, pages.context],
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

pageShell(pages.pulse, "Experience Pulse");
pageShell(pages.drivers, "Drivers");
pageShell(pages.recovery, "Recovery Queue");
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
        "FactReviews.ReviewDate → DimDate.Date",
        "FactReviews.SellerID → DimSeller.SellerID",
        "FactReviews.Category → DimProduct.Category",
        "FactReviewTheme.ReviewID → FactReviews.ReviewID",
        "FactReviewTheme.Theme → DimTheme.Theme",
        "FactThemeQuotes.Theme → DimTheme.Theme",
        "FactOrders disconnected (Coverage % denominator)",
      ],
      note: "Landing page is created by elevate (not this scaffold)",
      pbip: path.join(root, "ExperiencePulse.pbip"),
    },
    null,
    2
  )
);

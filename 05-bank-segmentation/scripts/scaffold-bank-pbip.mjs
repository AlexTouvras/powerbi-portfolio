/**
 * Scaffold BankValue PBIP — multi-table star semantic model + 4-page Nordic report shell.
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

const sm = path.join(root, "BankValue.SemanticModel");
const rpt = path.join(root, "BankValue.Report");
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
  `database BankValue
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimCustomer","DimAccount","DimDate","DimCity","FactTransactions","FactFlowBridge"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimCustomer
ref table DimAccount
ref table DimDate
ref table DimCity
ref table FactTransactions
ref table FactFlowBridge
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactTransactions_DimDate
\tfromColumn: FactTransactions.TransactionDate
\ttoColumn: DimDate.Date

relationship FactTransactions_DimAccount
\tfromColumn: FactTransactions.AccountID
\ttoColumn: DimAccount.AccountID

relationship DimAccount_DimCustomer
\tfromColumn: DimAccount.CustomerID
\ttoColumn: DimCustomer.CustomerID

relationship DimCustomer_DimCity
\tfromColumn: DimCustomer.City
\ttoColumn: DimCity.City
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

// --- DimCity ---
write(
  path.join(tablesDir, "DimCity.tmdl"),
  `table DimCity

${col("City", "string")}
${col("Latitude", "double", { summarizeBy: "none", dataCategory: "Latitude" })}
${col("Longitude", "double", { summarizeBy: "none", dataCategory: "Longitude" })}
${col("Country", "string")}
${csvPartition("DimCity", "DimCity.csv", [
  ["City", "type text"],
  ["Latitude", "type number"],
  ["Longitude", "type number"],
  ["Country", "type text"],
])}
`
);

// --- DimAccount ---
write(
  path.join(tablesDir, "DimAccount.tmdl"),
  `table DimAccount

${col("AccountID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("CustomerID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("AccountNumber", "string")}
${col("AccountType", "string")}
${col("OpenDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("Balance", "double", { formatString: "#,0.00" })}
${csvPartition("DimAccount", "DimAccount.csv", [
  ["AccountID", "Int64.Type"],
  ["CustomerID", "Int64.Type"],
  ["AccountNumber", "type text"],
  ["AccountType", "type text"],
  ["OpenDate", "type date"],
  ["Balance", "type number"],
])}
`
);

// --- DimCustomer (no EngagementStageOrder in gold CSV → skip sortByColumn) ---
write(
  path.join(tablesDir, "DimCustomer.tmdl"),
  `table DimCustomer

\tmeasure 'Customer Base' = DISTINCTCOUNT(DimCustomer[CustomerID])
\t\tformatString: #,0

\tmeasure 'Dormant Customers' = CALCULATE([Customer Base], DimCustomer[IsDormant] = 1)
\t\tformatString: #,0

\tmeasure 'Dormant %' = DIVIDE([Dormant Customers], [Customer Base])
\t\tformatString: 0.0%

\tmeasure 'Single Product Customers' = CALCULATE([Customer Base], DimCustomer[ProductCount] = 1)
\t\tformatString: #,0

\tmeasure 'Avg Balance' = AVERAGE(DimCustomer[TotalBalance])
\t\tformatString: #,0

\tmeasure 'Avg Frequency' = AVERAGE(DimCustomer[Frequency])
\t\tformatString: #,0.0

\tmeasure 'Avg Monetary' = AVERAGE(DimCustomer[MonetaryDebit])
\t\tformatString: #,0

${col("CustomerID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("CustomerName", "string")}
${col("Gender", "string")}
${col("BirthDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("SignupDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("City", "string")}
${col("Latitude", "double", { summarizeBy: "none", dataCategory: "Latitude" })}
${col("Longitude", "double", { summarizeBy: "none", dataCategory: "Longitude" })}
${col("ProductCount", "int64", { formatString: "0", summarizeBy: "none" })}
${col("TotalBalance", "double", { formatString: "#,0.00" })}
${col("AccountTypes", "string")}
${col("RecencyDays", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Frequency", "int64", { formatString: "0", summarizeBy: "none" })}
${col("MonetaryDebit", "double", { formatString: "#,0.00" })}
${col("R_Score", "int64", { formatString: "0", summarizeBy: "none" })}
${col("F_Score", "int64", { formatString: "0", summarizeBy: "none" })}
${col("M_Score", "int64", { formatString: "0", summarizeBy: "none" })}
${col("RFM_Score", "int64", { formatString: "0", summarizeBy: "none" })}
${col("IsDormant", "int64", { formatString: "0", summarizeBy: "none" })}
${col("ValueSegment", "string")}
${col("EngagementStage", "string")}
${col("LastTxnDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${csvPartition("DimCustomer", "DimCustomer.csv", [
  ["CustomerID", "Int64.Type"],
  ["CustomerName", "type text"],
  ["Gender", "type text"],
  ["BirthDate", "type date"],
  ["SignupDate", "type date"],
  ["City", "type text"],
  ["Latitude", "type number"],
  ["Longitude", "type number"],
  ["ProductCount", "Int64.Type"],
  ["TotalBalance", "type number"],
  ["AccountTypes", "type text"],
  ["RecencyDays", "Int64.Type"],
  ["Frequency", "Int64.Type"],
  ["MonetaryDebit", "type number"],
  ["R_Score", "Int64.Type"],
  ["F_Score", "Int64.Type"],
  ["M_Score", "Int64.Type"],
  ["RFM_Score", "Int64.Type"],
  ["IsDormant", "Int64.Type"],
  ["ValueSegment", "type text"],
  ["EngagementStage", "type text"],
  ["LastTxnDate", "type nullable date"],
])}
`
);

// --- FactTransactions ---
write(
  path.join(tablesDir, "FactTransactions.tmdl"),
  `table FactTransactions

\tmeasure Customers = DISTINCTCOUNT(FactTransactions[CustomerID])
\t\tformatString: #,0

\tmeasure Accounts = DISTINCTCOUNT(FactTransactions[AccountID])
\t\tformatString: #,0

\tmeasure 'Transaction Volume' = SUM(FactTransactions[Amount])
\t\tformatString: #,0

\tmeasure 'Credit Volume' = CALCULATE([Transaction Volume], FactTransactions[TransactionType] = "credit")
\t\tformatString: #,0

\tmeasure 'Debit Volume' = CALCULATE([Transaction Volume], FactTransactions[TransactionType] = "debit")
\t\tformatString: #,0

\tmeasure 'Net Flow' = [Credit Volume] - [Debit Volume]
\t\tformatString: #,0

\tmeasure Transactions = COUNTROWS(FactTransactions)
\t\tformatString: #,0

\tmeasure 'Active Customers' = CALCULATE([Customers], FactTransactions[TransactionDate] >= TODAY() - 90)
\t\tformatString: #,0

\tmeasure 'Avg Transaction' = DIVIDE([Transaction Volume], [Transactions])
\t\tformatString: #,0

${col("TransactionID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("AccountID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("CustomerID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("TransactionDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("Amount", "double", { formatString: "#,0.00" })}
${col("TransactionType", "string")}
${col("Description", "string")}
${csvPartition("FactTransactions", "FactTransactions.csv", [
  ["TransactionID", "Int64.Type"],
  ["AccountID", "Int64.Type"],
  ["CustomerID", "Int64.Type"],
  ["TransactionDate", "type date"],
  ["Amount", "type number"],
  ["TransactionType", "type text"],
  ["Description", "type text"],
])}
`
);

// --- FactFlowBridge (no relationships — waterfall bridge) ---
write(
  path.join(tablesDir, "FactFlowBridge.tmdl"),
  `table FactFlowBridge

\tmeasure 'Flow Amount' = SUM(FactFlowBridge[FlowAmount])
\t\tformatString: #,0

${col("FlowStage", "string", { sortByColumn: "FlowOrder" })}
${col("FlowOrder", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("FlowAmount", "double", { formatString: "#,0.00" })}
${csvPartition("FactFlowBridge", "FactFlowBridge.csv", [
  ["FlowStage", "type text"],
  ["FlowOrder", "Int64.Type"],
  ["FlowAmount", "type number"],
])}
`
);

// --- Report scaffolding ---
const pages = {
  pulse: pageId(),
  segments: pageId(),
  book: pageId(),
  profile: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "BankValue.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "BankValue.Report" } }],
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
      datasetReference: { byPath: { path: "../BankValue.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Bank Value", "Report");
writePlatform(sm, "Bank Value", "SemanticModel");

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
      settings: { useStylableVisualContainerHeader: true, exportDataMode: "AllowSummarized" },
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
      pageOrder: [pages.pulse, pages.segments, pages.book, pages.profile],
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

pageShell(pages.pulse, "Franchise Pulse");
pageShell(pages.segments, "Segments & Markets");
pageShell(pages.book, "Relationship Book");
pageShell(pages.profile, "Customer Profile", { visibility: "HiddenInViewMode" });

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      sm,
      rpt,
      goldDir,
      pbip: path.join(root, "BankValue.pbip"),
    },
    null,
    2
  )
);

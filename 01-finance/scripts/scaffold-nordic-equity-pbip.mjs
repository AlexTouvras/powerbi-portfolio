/**
 * Scaffold NordicEquity PBIP — DimCompany / DimDate / FactPrices + 4-page shell.
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

const sm = path.join(root, "NordicEquity.SemanticModel");
const rpt = path.join(root, "NordicEquity.Report");
const def = path.join(sm, "definition");
const tablesDir = path.join(def, "tables");
const exprDir = path.join(def, "expressions");
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

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
function measure(name, expr, formatString) {
  const needsQuote = /[\s%]/.test(name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  const label = needsQuote ? `'${name.replace(/'/g, "''")}'` : name;
  // TMDL formatString is unquoted (e.g. #,0.00) — do not wrap in JSON quotes
  const fmt = formatString ? formatString.replace(/^"|"$/g, "") : null;
  return `\tmeasure ${label} = ${expr}${fmt ? `\n\t\tformatString: ${fmt}` : ""}\n`;
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

ensureDir(tablesDir);
ensureDir(exprDir);

write(
  path.join(root, "NordicEquity.pbip"),
  JSON.stringify(
    {
      $schema: "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "NordicEquity.Report" } }],
      settings: { enableAutoRecovery: true },
    },
    null,
    2
  )
);

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

write(path.join(def, "database.tmdl"), `database NordicEquity\n\tcompatibilityLevel: 1567\n`);
write(
  path.join(exprDir, "GoldDataFolder.tmdl"),
  `expression GoldDataFolder = "${goldDir}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n`
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimCompany","DimDate","FactPrices"]
annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimCompany
ref table DimDate
ref table FactPrices
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactPrices_DimDate
\tfromColumn: FactPrices.Date
\ttoColumn: DimDate.Date

relationship FactPrices_DimCompany
\tfromColumn: FactPrices.Ticker
\ttoColumn: DimCompany.Ticker
`
);

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

write(
  path.join(tablesDir, "DimCompany.tmdl"),
  `table DimCompany

${col("Ticker", "string")}
${col("YahooSymbol", "string")}
${col("CompanyName", "string")}
${col("Country", "string")}
${col("Sector", "string")}
${col("Industry", "string")}
${col("MarketCapEURm", "double", { formatString: "#,0", summarizeBy: "sum" })}
${csvPartition("DimCompany", "DimCompany.csv", [
  ["Ticker", "type text"],
  ["YahooSymbol", "type text"],
  ["CompanyName", "type text"],
  ["Country", "type text"],
  ["Sector", "type text"],
  ["Industry", "type text"],
  ["MarketCapEURm", "type number"],
])}
`
);

const factCols = [
  col("Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none", dataCategory: "Time" }),
  col("Ticker", "string"),
  col("Open", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("High", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("Low", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("Close", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("Volume", "int64", { formatString: "#,0", summarizeBy: "sum" }),
  col("PrevClose", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("Change", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("ChangePct", "double", { formatString: "0.00", summarizeBy: "none" }),
  col("MarketCapEURm", "double", { formatString: "#,0", summarizeBy: "sum" }),
  col("SMA20", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("SMA50", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("EMA12", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("EMA26", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("MACD", "double", { formatString: "0.0000", summarizeBy: "none" }),
  col("MACDSignal", "double", { formatString: "0.0000", summarizeBy: "none" }),
  col("MACDHist", "double", { formatString: "0.0000", summarizeBy: "none" }),
  col("RSI14", "double", { formatString: "0.0", summarizeBy: "none" }),
  col("BBMid", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("BBUpper", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("BBLower", "double", { formatString: "#,0.00", summarizeBy: "none" }),
  col("IsLatest", "int64", { formatString: "0", summarizeBy: "none" }),
].join("");

const measures = [
  measure(
    "Advancers",
    `CALCULATE( DISTINCTCOUNT( FactPrices[Ticker] ), FactPrices[IsLatest] = 1, FactPrices[ChangePct] > 0 )`,
    "#,0"
  ),
  measure(
    "Decliners",
    `CALCULATE( DISTINCTCOUNT( FactPrices[Ticker] ), FactPrices[IsLatest] = 1, FactPrices[ChangePct] < 0 )`,
    "#,0"
  ),
  measure(
    "Universe Count",
    `CALCULATE( DISTINCTCOUNT( FactPrices[Ticker] ), FactPrices[IsLatest] = 1 )`,
    "#,0"
  ),
  measure(
    "Avg Day Change %",
    `CALCULATE( AVERAGE( FactPrices[ChangePct] ), FactPrices[IsLatest] = 1 )`,
    "0.00"
  ),
  measure(
    "Market Cap Latest EURm",
    `CALCULATE( SUM( FactPrices[MarketCapEURm] ), FactPrices[IsLatest] = 1 )`,
    "#,0"
  ),
  measure("Last Close", `CALCULATE( AVERAGE( FactPrices[Close] ), FactPrices[IsLatest] = 1 )`, "#,0.00"),
  measure("Last Change %", `CALCULATE( AVERAGE( FactPrices[ChangePct] ), FactPrices[IsLatest] = 1 )`, "0.00"),
  measure("Last RSI", `CALCULATE( AVERAGE( FactPrices[RSI14] ), FactPrices[IsLatest] = 1 )`, "0.0"),
  measure("Last Volume", `CALCULATE( SUM( FactPrices[Volume] ), FactPrices[IsLatest] = 1 )`, "#,0"),
  measure("Close", `AVERAGE( FactPrices[Close] )`, "#,0.00"),
  measure("SMA 20", `AVERAGE( FactPrices[SMA20] )`, "#,0.00"),
  measure("SMA 50", `AVERAGE( FactPrices[SMA50] )`, "#,0.00"),
  measure("BB Upper", `AVERAGE( FactPrices[BBUpper] )`, "#,0.00"),
  measure("BB Lower", `AVERAGE( FactPrices[BBLower] )`, "#,0.00"),
  measure("MACD Line", `AVERAGE( FactPrices[MACD] )`, "0.0000"),
  measure("MACD Signal", `AVERAGE( FactPrices[MACDSignal] )`, "0.0000"),
  measure("MACD Hist", `AVERAGE( FactPrices[MACDHist] )`, "0.0000"),
  measure("RSI 14", `AVERAGE( FactPrices[RSI14] )`, "0.0"),
  measure("Volume", `SUM( FactPrices[Volume] )`, "#,0"),
  measure(
    "Day Change % Latest",
    `CALCULATE( AVERAGE( FactPrices[ChangePct] ), FactPrices[IsLatest] = 1 )`,
    "0.00"
  ),
].join("\n");

write(
  path.join(tablesDir, "FactPrices.tmdl"),
  `table FactPrices

${factCols}
${measures}
${csvPartition("FactPrices", "FactPrices.csv", [
  ["Date", "type date"],
  ["Ticker", "type text"],
  ["Open", "type number"],
  ["High", "type number"],
  ["Low", "type number"],
  ["Close", "type number"],
  ["Volume", "Int64.Type"],
  ["PrevClose", "type number"],
  ["Change", "type number"],
  ["ChangePct", "type number"],
  ["MarketCapEURm", "type number"],
  ["SMA20", "type number"],
  ["SMA50", "type number"],
  ["EMA12", "type number"],
  ["EMA26", "type number"],
  ["MACD", "type number"],
  ["MACDSignal", "type number"],
  ["MACDHist", "type number"],
  ["RSI14", "type number"],
  ["BBMid", "type number"],
  ["BBUpper", "type number"],
  ["BBLower", "type number"],
  ["IsLatest", "Int64.Type"],
])}
`
);

write(
  path.join(rpt, "definition.pbir"),
  JSON.stringify(
    {
      $schema: "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
      version: "4.0",
      datasetReference: { byPath: { path: "../NordicEquity.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Nordic Equity", "Report");
writePlatform(sm, "Nordic Equity", "SemanticModel");

ensureDir(path.join(rpt, "StaticResources", "SharedResources", "BaseThemes"));
ensureDir(path.join(rpt, "StaticResources", "RegisteredResources"));
fs.copyFileSync(themeSrc, path.join(rpt, "StaticResources", "RegisteredResources", themeFileName));

const pages = {
  landing: pageId(),
  heatmap: pageId(),
  explorer: pageId(),
  context: pageId(),
};

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
      settings: { useStylizableVisualContainerHeader: true, exportDataMode: "AllowSummarized" },
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
      pageOrder: [pages.landing, pages.heatmap, pages.explorer, pages.context],
      activePageName: pages.landing,
    },
    null,
    2
  )
);

function pageShell(pageKey, displayName) {
  const pageDir = path.join(rpt, "definition", "pages", pageKey);
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
pageShell(pages.heatmap, "Nordic Heatmap");
pageShell(pages.explorer, "Ticker Explorer");
pageShell(pages.context, "Context");

fs.writeFileSync(path.join(root, "scripts", ".pages-cache.json"), JSON.stringify(pages, null, 2));

console.log(JSON.stringify({ ok: true, pages, sm, rpt, goldDir, pbip: path.join(root, "NordicEquity.pbip") }, null, 2));

/**
 * Scaffold Controllership PBIP — statement-ready CoA + Actual/Budget FactPnL.
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

const sm = path.join(root, "Controllership.SemanticModel");
const rpt = path.join(root, "Controllership.Report");
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

if (fs.existsSync(sm)) fs.rmSync(sm, { recursive: true, force: true });
if (fs.existsSync(rpt)) fs.rmSync(rpt, { recursive: true, force: true });

ensureDir(tablesDir);
ensureDir(exprDir);

write(
  path.join(root, "Controllership.pbip"),
  JSON.stringify(
    {
      $schema: "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "Controllership.Report" } }],
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

write(path.join(def, "database.tmdl"), `database Controllership\n\tcompatibilityLevel: 1567\n`);

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

annotation PBI_QueryOrder = ["GoldDataFolder","DimDate","DimEntity","DimAccount","FactPnL","FactScenario","FxRates","DimBridgeStep"]
annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimDate
ref table DimEntity
ref table DimAccount
ref table FactPnL
ref table FactScenario
ref table FxRates
ref table DimBridgeStep
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactPnL_DimDate
\tfromColumn: FactPnL.YearMonth
\ttoColumn: DimDate.YearMonth

relationship FactPnL_DimEntity
\tfromColumn: FactPnL.EntityID
\ttoColumn: DimEntity.EntityID

relationship FactPnL_DimAccount
\tfromColumn: FactPnL.AccountID
\ttoColumn: DimAccount.AccountID

relationship FactScenario_DimDate
\tfromColumn: FactScenario.YearMonth
\ttoColumn: DimDate.YearMonth
`
);

write(
  path.join(tablesDir, "DimDate.tmdl"),
  `table DimDate
\tdataCategory: Time

${col("Date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("Year", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Month", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("YearMonth", "string", { sortByColumn: "MonthYearSort" })}
${col("MonthName", "string", { sortByColumn: "Month" })}
${col("Quarter", "string")}
${col("YearQuarter", "string")}
${col("MonthYearSort", "int64", { isHidden: true, summarizeBy: "none" })}
${csvPartition("DimDate", "DimDate.csv", [
  ["Date", "type date"],
  ["Year", "Int64.Type"],
  ["Month", "Int64.Type"],
  ["YearMonth", "type text"],
  ["MonthName", "type text"],
  ["Quarter", "type text"],
  ["YearQuarter", "type text"],
  ["MonthYearSort", "Int64.Type"],
])}
`
);

write(
  path.join(tablesDir, "DimEntity.tmdl"),
  `table DimEntity

${col("EntityID", "string", { summarizeBy: "none" })}
${col("EntityName", "string")}
${col("LocalCurrency", "string")}
${csvPartition("DimEntity", "DimEntity.csv", [
  ["EntityID", "type text"],
  ["EntityName", "type text"],
  ["LocalCurrency", "type text"],
])}
`
);

write(
  path.join(tablesDir, "DimAccount.tmdl"),
  `table DimAccount

${col("AccountID", "string", { summarizeBy: "none" })}
${col("AccountName", "string")}
${col("Level", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Operator", "string")}
${col("Sign", "int64", { formatString: "0", summarizeBy: "none" })}
${col("ParentID", "string")}
${col("SortOrder", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Section", "string")}
${col("StatementLabel", "string", { sortByColumn: "SortOrder" })}
${csvPartition("DimAccount", "DimAccount.csv", [
  ["AccountID", "type text"],
  ["AccountName", "type text"],
  ["Level", "Int64.Type"],
  ["Operator", "type text"],
  ["Sign", "Int64.Type"],
  ["ParentID", "type text"],
  ["SortOrder", "Int64.Type"],
  ["Section", "type text"],
  ["StatementLabel", "type text"],
])}
`
);

write(
  path.join(tablesDir, "FactPnL.tmdl"),
  `table FactPnL

\tmeasure 'Sum Actual Eur' = SUM(FactPnL[ActualEur])
\t\tformatString: #,0.0

\tmeasure 'Sum Budget Eur' = SUM(FactPnL[BudgetEur])
\t\tformatString: #,0.0

\tmeasure 'Sum Variance Eur' = SUM(FactPnL[VarianceEur])
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Variance %' = DIVIDE([Sum Variance Eur], [Sum Budget Eur])
\t\tformatString: 0.0%

\tmeasure 'Operating Profit Actual' = CALCULATE([Sum Actual Eur], DimAccount[AccountID] = "O900")
\t\tformatString: #,0.0

\tmeasure 'Operating Profit Variance' = CALCULATE([Sum Variance Eur], DimAccount[AccountID] = "O900")
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Leaf Variance Eur' = CALCULATE([Sum Variance Eur], DimAccount[Level] = 1)
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Signed Variance Eur' = SUMX(FactPnL, FactPnL[VarianceEur] * RELATED(DimAccount[Sign]))
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Leaf Signed Variance' = CALCULATE([Signed Variance Eur], DimAccount[Level] = 1)
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Operating Profit Budget' = CALCULATE([Sum Budget Eur], DimAccount[AccountID] = "O900")
\t\tformatString: #,0.0

\tmeasure 'OP Gap %' = DIVIDE([Operating Profit Variance], [Operating Profit Budget])
\t\tformatString: 0.0%;0.0%;0.0%

\tmeasure 'Bridge Amount' =
\t\t\tVAR step = SELECTEDVALUE(DimBridgeStep[BridgeStep])
\t\t\tVAR aid = SELECTEDVALUE(DimBridgeStep[AccountID])
\t\t\tRETURN
\t\t\t\tSWITCH(
\t\t\t\t\tTRUE(),
\t\t\t\t\tstep = "Budget OP", [Operating Profit Budget],
\t\t\t\t\tstep = "Actual OP", [Operating Profit Actual],
\t\t\t\t\tNOT ISBLANK(aid) && aid <> "",
\t\t\t\t\t\tCALCULATE([Leaf Signed Variance], DimAccount[AccountID] = aid),
\t\t\t\t\tBLANK()
\t\t\t\t)
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Landing Cover Entity' =
\t\t\tVAR t =
\t\t\t\tTOPN(
\t\t\t\t\t1,
\t\t\t\t\tADDCOLUMNS(ALL(DimEntity[EntityName]), "@v", [Leaf Signed Variance]),
\t\t\t\t\t[@v], DESC
\t\t\t\t)
\t\t\tRETURN CONCATENATEX(t, DimEntity[EntityName])

\tmeasure 'Landing Drag Entity' =
\t\t\tVAR t =
\t\t\t\tTOPN(
\t\t\t\t\t1,
\t\t\t\t\tADDCOLUMNS(ALL(DimEntity[EntityName]), "@v", [Leaf Signed Variance]),
\t\t\t\t\t[@v], ASC
\t\t\t\t)
\t\t\tRETURN CONCATENATEX(t, DimEntity[EntityName])

\tmeasure 'Landing Thesis' =
\t\t\tVAR gap = [Operating Profit Variance]
\t\t\tVAR gapAbs = FORMAT(ABS(gap), "#,0")
\t\t\tVAR cover = [Landing Cover Entity]
\t\t\tVAR drag = [Landing Drag Entity]
\t\t\tVAR coverVal = CALCULATE([Leaf Signed Variance], DimEntity[EntityName] = cover)
\t\t\tVAR dragVal = CALCULATE([Leaf Signed Variance], DimEntity[EntityName] = drag)
\t\t\tVAR sameEntity = cover = drag
\t\t\tRETURN
\t\t\t\tSWITCH(
\t\t\t\t\tTRUE(),
\t\t\t\t\tISBLANK(gap), "Waiting for P&L data.",
\t\t\t\t\tsameEntity && gap < 0,
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR below budget - pressure concentrates in " & drag & ".",
\t\t\t\t\tsameEntity && gap > 0,
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR above budget - led by " & cover & ".",
\t\t\t\t\tgap < 0 && NOT ISBLANK(cover) && NOT ISBLANK(drag) && coverVal > 0 && dragVal < 0,
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR below budget - " & cover
\t\t\t\t\t\t\t& "'s contribution does not cover " & drag & "'s drag.",
\t\t\t\t\tgap < 0,
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR below budget.",
\t\t\t\t\tgap > 0 && NOT ISBLANK(cover),
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR above budget - led by " & cover & ".",
\t\t\t\t\tgap > 0,
\t\t\t\t\t\t"Operating profit is " & gapAbs & " EUR above budget.",
\t\t\t\t\t"Operating profit is on budget."
\t\t\t\t)

\tmeasure 'Landing Subthesis' =
\t\t\tVAR gapPct = [OP Gap %]
\t\t\tVAR cover = [Landing Cover Entity]
\t\t\tVAR drag = [Landing Drag Entity]
\t\t\tVAR coverAmt = FORMAT(ABS(CALCULATE([Leaf Signed Variance], DimEntity[EntityName] = cover)), "#,0")
\t\t\tVAR dragAmt = FORMAT(ABS(CALCULATE([Leaf Signed Variance], DimEntity[EntityName] = drag)), "#,0")
\t\t\tRETURN
\t\t\t\tSWITCH(
\t\t\t\t\tTRUE(),
\t\t\t\t\tISBLANK(gapPct), "Filter period or entity to refresh the conclusion.",
\t\t\t\t\tNOT ISBLANK(cover) && NOT ISBLANK(drag) && cover <> drag,
\t\t\t\t\t\t"Gap " & FORMAT(gapPct, "0.0%")
\t\t\t\t\t\t\t& " | cover " & cover & " +" & coverAmt
\t\t\t\t\t\t\t& " EUR | drag " & drag & " -" & dragAmt & " EUR.",
\t\t\t\t\t"Gap " & FORMAT(gapPct, "0.0%") & " vs budget | leaf signed contribution drives the story."
\t\t\t\t)

${col("YearMonth", "string", { summarizeBy: "none" })}
${col("EntityID", "string", { summarizeBy: "none" })}
${col("AccountID", "string", { summarizeBy: "none" })}
${col("ActualLocal", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("BudgetLocal", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("ActualEur", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("BudgetEur", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${col("VarianceEur", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${csvPartition("FactPnL", "FactPnL.csv", [
  ["YearMonth", "type text"],
  ["EntityID", "type text"],
  ["AccountID", "type text"],
  ["ActualLocal", "type number"],
  ["BudgetLocal", "type number"],
  ["ActualEur", "type number"],
  ["BudgetEur", "type number"],
  ["VarianceEur", "type number"],
])}
`
);

write(
  path.join(tablesDir, "FactScenario.tmdl"),
  `table FactScenario

\tmeasure 'Sum Scenario OP' = SUM(FactScenario[OperatingProfitEur])
\t\tformatString: #,0.0

\tmeasure 'Scenario OP Base' = CALCULATE([Sum Scenario OP], FactScenario[Scenario] = "Base (actual)")
\t\tformatString: #,0.0

\tmeasure 'Scenario OP Revenue Up' = CALCULATE([Sum Scenario OP], FactScenario[Scenario] = "Revenue +5%")
\t\tformatString: #,0.0

\tmeasure 'Scenario OP FX Hit' = CALCULATE([Sum Scenario OP], FactScenario[Scenario] = "FX -3% hit")
\t\tformatString: #,0.0

\tmeasure 'Scenario Delta Revenue Up' = [Scenario OP Revenue Up] - [Scenario OP Base]
\t\tformatString: #,0.0;#,0.0;0

\tmeasure 'Scenario Delta FX Hit' = [Scenario OP FX Hit] - [Scenario OP Base]
\t\tformatString: #,0.0;#,0.0;0

${col("YearMonth", "string", { summarizeBy: "none" })}
${col("Scenario", "string")}
${col("OperatingProfitEur", "double", { formatString: "#,0.0", summarizeBy: "none" })}
${csvPartition("FactScenario", "FactScenario.csv", [
  ["YearMonth", "type text"],
  ["Scenario", "type text"],
  ["OperatingProfitEur", "type number"],
])}
`
);

write(
  path.join(tablesDir, "FxRates.tmdl"),
  `table FxRates

${col("YearMonth", "string", { summarizeBy: "none" })}
${col("Currency", "string")}
${col("FxToEur", "double", { formatString: "0.0000", summarizeBy: "none" })}
${csvPartition("FxRates", "FxRates.csv", [
  ["YearMonth", "type text"],
  ["Currency", "type text"],
  ["FxToEur", "type number"],
])}
`
);

write(
  path.join(tablesDir, "DimBridgeStep.tmdl"),
  `table DimBridgeStep

${col("BridgeStep", "string", { sortByColumn: "BridgeOrder", summarizeBy: "none" })}
${col("BridgeOrder", "int64", { formatString: "0", isHidden: true, summarizeBy: "none" })}
${col("IsTotal", "boolean", { summarizeBy: "none" })}
${col("AccountID", "string", { summarizeBy: "none" })}
${csvPartition("DimBridgeStep", "DimBridgeStep.csv", [
  ["BridgeStep", "type text"],
  ["BridgeOrder", "Int64.Type"],
  ["IsTotal", "type logical"],
  ["AccountID", "type text"],
])}
`
);

writePlatform(sm, "Controllership", "SemanticModel");
writePlatform(rpt, "Controllership", "Report");

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
  path.join(rpt, "definition.pbir"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
      version: "4.0",
      datasetReference: { byPath: { path: "../Controllership.SemanticModel" } },
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
        section: [{ properties: { verticalAlignment: { expr: { Literal: { Value: "'Top'" } } } } }],
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
    { name: "CY25SU06", dataColors: ["#2F5F73", "#C17B3A"], foreground: "#0F1C24", background: "#FFFFFF" },
    null,
    2
  )
);

const pages = {
  landing: pageId(),
  pulse: pageId(),
  drivers: pageId(),
  scenarios: pageId(),
  context: pageId(),
};

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.landing, pages.pulse, pages.drivers, pages.scenarios, pages.context],
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
          outspacePane: [{ properties: { width: { expr: { Literal: { Value: "0D" } } } } }],
        },
      },
      null,
      2
    )
  );
}

pageShell(pages.landing, "Landing");
pageShell(pages.pulse, "P&L Pulse");
pageShell(pages.drivers, "Variance Drivers");
pageShell(pages.scenarios, "Scenarios");
pageShell(pages.context, "Context");

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      pbip: path.join(root, "Controllership.pbip"),
      goldDir,
    },
    null,
    2
  )
);

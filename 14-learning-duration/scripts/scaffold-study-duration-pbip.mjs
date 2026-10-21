/**
 * Scaffold StudyDuration PBIP — FactRegistration + approved-fit tables for Argument Deneb.
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

const sm = path.join(root, "StudyDuration.SemanticModel");
const rpt = path.join(root, "StudyDuration.Report");
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

for (const required of [
  "FactKm.csv",
  "FactCox.csv",
  "FactBetaT.csv",
  "FactRegistration.csv",
  "ModelMetrics.csv",
  "StratumSummary.csv",
]) {
  if (!fs.existsSync(path.join(root, "data/gold", required))) {
    throw new Error(`Missing ${required} — run fit + export to gold first`);
  }
}

if (fs.existsSync(sm)) fs.rmSync(sm, { recursive: true, force: true });
if (fs.existsSync(rpt)) fs.rmSync(rpt, { recursive: true, force: true });

ensureDir(tablesDir);
ensureDir(exprDir);

write(
  path.join(root, "StudyDuration.pbip"),
  JSON.stringify(
    {
      $schema: "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "StudyDuration.Report" } }],
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

write(path.join(def, "database.tmdl"), `database StudyDuration\n\tcompatibilityLevel: 1567\n`);

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

annotation PBI_QueryOrder = ["GoldDataFolder","FactRegistration","FactKm","FactCox","FactBetaT","FactPh","StratumSummary","ModelMetrics"]
annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table FactRegistration
ref table FactKm
ref table FactCox
ref table FactBetaT
ref table FactPh
ref table StratumSummary
ref table ModelMetrics
`
);

write(path.join(def, "relationships.tmdl"), `\n`);

write(
  path.join(tablesDir, "FactRegistration.tmdl"),
  `table FactRegistration

\tmeasure Registrations = COUNTROWS(FactRegistration)
\t\tformatString: #,0

\tmeasure Withdrawals = CALCULATE(COUNTROWS(FactRegistration), FactRegistration[Event] = 1)
\t\tformatString: #,0

\tmeasure 'Withdrawal Rate' = DIVIDE([Withdrawals], [Registrations])
\t\tformatString: 0.0%

${col("RegistrationId", "string", { summarizeBy: "none" })}
${col("StudentId", "string", { summarizeBy: "none" })}
${col("Module", "string")}
${col("Presentation", "string")}
${col("TimeDays", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Event", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Stratum", "string")}
${col("CourseLengthDays", "int64", { formatString: "0", summarizeBy: "none" })}
${col("FinalResult", "string")}
${col("AgeBand", "string")}
${col("HighestEducation", "string")}
${col("Gender", "string")}
${col("Region", "string")}
${col("ImdBand", "string")}
${col("StudiedCredits", "double", { formatString: "#,0", summarizeBy: "none" })}
${col("PrevAttempts", "double", { formatString: "0", summarizeBy: "none" })}
${col("Disability", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactRegistration", "FactRegistration.csv", [
  ["RegistrationId", "type text"],
  ["StudentId", "type text"],
  ["Module", "type text"],
  ["Presentation", "type text"],
  ["TimeDays", "Int64.Type"],
  ["Event", "Int64.Type"],
  ["Stratum", "type text"],
  ["CourseLengthDays", "Int64.Type"],
  ["FinalResult", "type text"],
  ["AgeBand", "type text"],
  ["HighestEducation", "type text"],
  ["Gender", "type text"],
  ["Region", "type text"],
  ["ImdBand", "type text"],
  ["StudiedCredits", "type number"],
  ["PrevAttempts", "type number"],
  ["Disability", "Int64.Type"],
])}
`
);

write(
  path.join(tablesDir, "FactKm.tmdl"),
  `table FactKm

${col("Stratum", "string")}
${col("Time", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("Survival", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Lo", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Hi", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("NRisk", "int64", { formatString: "0", summarizeBy: "none" })}
${col("NEvent", "int64", { formatString: "0", summarizeBy: "none" })}
${col("NCensor", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactKm", "FactKm.csv", [
  ["Stratum", "type text"],
  ["Time", "type number"],
  ["Survival", "type number"],
  ["Lo", "type number"],
  ["Hi", "type number"],
  ["NRisk", "Int64.Type"],
  ["NEvent", "Int64.Type"],
  ["NCensor", "Int64.Type"],
])}
`
);

write(
  path.join(tablesDir, "FactCox.tmdl"),
  `table FactCox

${col("Term", "string")}
${col("HazardRatio", "double", { formatString: "0.00", summarizeBy: "none" })}
${col("Lo", "double", { formatString: "0.00", summarizeBy: "none" })}
${col("Hi", "double", { formatString: "0.00", summarizeBy: "none" })}
${col("P", "double", { formatString: "0.000E+0", summarizeBy: "none" })}
${col("Reference", "string")}
${col("Kind", "string")}
${csvPartition("FactCox", "FactCox.csv", [
  ["Term", "type text"],
  ["HazardRatio", "type number"],
  ["Lo", "type number"],
  ["Hi", "type number"],
  ["P", "type number"],
  ["Reference", "type text"],
  ["Kind", "type text"],
])}
`
);

write(
  path.join(tablesDir, "FactBetaT.tmdl"),
  `table FactBetaT

${col("Term", "string")}
${col("Time", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("Beta", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Lo", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Hi", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Residual", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("Kind", "string")}
${csvPartition("FactBetaT", "FactBetaT.csv", [
  ["Term", "type text"],
  ["Time", "type number"],
  ["Beta", "type number"],
  ["Lo", "type number"],
  ["Hi", "type number"],
  ["Residual", "type number"],
  ["Kind", "type text"],
])}
`
);

write(
  path.join(tablesDir, "FactPh.tmdl"),
  `table FactPh

${col("Term", "string")}
${col("Test", "string")}
${col("P", "double", { formatString: "0.000E+0", summarizeBy: "none" })}
${col("Verdict", "string")}
${col("TimeTransform", "string")}
${csvPartition("FactPh", "FactPh.csv", [
  ["Term", "type text"],
  ["Test", "type text"],
  ["P", "type number"],
  ["Verdict", "type text"],
  ["TimeTransform", "type text"],
])}
`
);

write(
  path.join(tablesDir, "StratumSummary.tmdl"),
  `table StratumSummary

\tmeasure 'Restricted Mean' = AVERAGE(StratumSummary[RestrictedMean])
\t\tformatString: 0.0

\tmeasure 'RM vs FFF' = AVERAGE(StratumSummary[Difference])
\t\tformatString: +0.0;-0.0;0.0

\tmeasure 'Stratum N' = SUM(StratumSummary[N])
\t\tformatString: #,0

\tmeasure 'Stratum Events' = SUM(StratumSummary[Events])
\t\tformatString: #,0

${col("Stratum", "string")}
${col("N", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("Events", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("Median", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("RestrictedMean", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("Tau", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("Difference", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("DiffLo", "double", { formatString: "0.0", summarizeBy: "none" })}
${col("DiffHi", "double", { formatString: "0.0", summarizeBy: "none" })}
${csvPartition("StratumSummary", "StratumSummary.csv", [
  ["Stratum", "type text"],
  ["N", "Int64.Type"],
  ["Events", "Int64.Type"],
  ["Median", "type number"],
  ["RestrictedMean", "type number"],
  ["Tau", "type number"],
  ["Difference", "type number"],
  ["DiffLo", "type number"],
  ["DiffHi", "type number"],
])}
`
);

write(
  path.join(tablesDir, "ModelMetrics.tmdl"),
  `table ModelMetrics

\tmeasure 'Fit Concordance' = MIN(ModelMetrics[Concordance])
\t\tformatString: 0.00

\tmeasure 'Log-rank p' = MIN(ModelMetrics[LogRankP])
\t\tformatString: 0.00E+0

${col("N", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("Events", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("NCensored", "int64", { formatString: "#,0", summarizeBy: "none" })}
${col("Concordance", "double", { formatString: "0.000", summarizeBy: "none" })}
${col("LogRankP", "double", { formatString: "0.00E+0", summarizeBy: "none" })}
${csvPartition("ModelMetrics", "ModelMetrics.csv", [
  ["N", "Int64.Type"],
  ["Events", "Int64.Type"],
  ["NCensored", "Int64.Type"],
  ["Concordance", "type number"],
  ["LogRankP", "type number"],
])}
`
);

writePlatform(sm, "Study Duration", "SemanticModel");
writePlatform(rpt, "Study Duration", "Report");

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
      datasetReference: { byPath: { path: "../StudyDuration.SemanticModel" } },
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
      publicCustomVisuals: ["deneb7E15AEF80B9E4D4F8E12924291ECE89A"],
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
  argument: pageId(),
  context: pageId(),
};

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.landing, pages.pulse, pages.argument, pages.context],
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
pageShell(pages.pulse, "Pulse");
pageShell(pages.argument, "Argument");
pageShell(pages.context, "Context");

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      pbip: path.join(root, "StudyDuration.pbip"),
      goldDir,
      deneb: "deneb7E15AEF80B9E4D4F8E12924291ECE89A",
    },
    null,
    2
  )
);

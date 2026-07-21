/**
 * Scaffold CarePulse PBIP — multi-table clinical star + 4-page Nordic mist shells.
 * Gold CSVs expected under data/gold/. DimPatient key column is patient_nbr (verified from CSV header).
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

const sm = path.join(root, "CarePulse.SemanticModel");
const rpt = path.join(root, "CarePulse.Report");
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
  `database CarePulse
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimPatient","DimDate","FactEncounter","FactPathwayBridge","FactHeatBridge"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimPatient
ref table DimDate
ref table FactEncounter
ref table FactPathwayBridge
ref table FactHeatBridge
`
);

// DimPatient key is patient_nbr (CSV header) — relate FactEncounter.PatientID → DimPatient.patient_nbr
write(
  path.join(def, "relationships.tmdl"),
  `relationship FactEncounter_DimDate
\tfromColumn: FactEncounter.AdmissionDate
\ttoColumn: DimDate.Date

relationship FactEncounter_DimPatient
\tfromColumn: FactEncounter.PatientID
\ttoColumn: DimPatient.patient_nbr
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

// --- DimPatient (header: patient_nbr,Race,Gender,AgeBand,EncounterCount) ---
write(
  path.join(tablesDir, "DimPatient.tmdl"),
  `table DimPatient

${col("patient_nbr", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Race", "string")}
${col("Gender", "string")}
${col("AgeBand", "string")}
${col("EncounterCount", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("DimPatient", "DimPatient.csv", [
  ["patient_nbr", "Int64.Type"],
  ["Race", "type text"],
  ["Gender", "type text"],
  ["AgeBand", "type text"],
  ["EncounterCount", "Int64.Type"],
])}
`
);

// --- FactEncounter ---
write(
  path.join(tablesDir, "FactEncounter.tmdl"),
  `table FactEncounter

\tmeasure Encounters = COUNTROWS(FactEncounter)
\t\tformatString: #,0

\tmeasure Patients = DISTINCTCOUNT(FactEncounter[PatientID])
\t\tformatString: #,0

\tmeasure 'Readmit30 Encounters' = CALCULATE([Encounters], FactEncounter[Readmit30] = 1)
\t\tformatString: #,0

\tmeasure 'Readmit Rate' = DIVIDE([Readmit30 Encounters], [Encounters])
\t\tformatString: 0.0%

\tmeasure 'Avg Length of Stay' = AVERAGE(FactEncounter[LengthOfStay])
\t\tformatString: #,0.0

\tmeasure 'High Risk Discharges' = CALCULATE([Encounters], FactEncounter[RiskBand] = "High")
\t\tformatString: #,0

\tmeasure 'Avg Readmit Probability' = AVERAGE(FactEncounter[ReadmitProbability])
\t\tformatString: 0.0%

\tmeasure 'Avg Medications' = AVERAGE(FactEncounter[Medications])
\t\tformatString: #,0.0

${col("EncounterID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("PatientID", "int64", { formatString: "0", summarizeBy: "none" })}
${col("AdmissionDate", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" })}
${col("AdmissionType", "string")}
${col("AdmissionSource", "string")}
${col("DischargeDisposition", "string")}
${col("DischargeGroup", "string")}
${col("AgeBand", "string")}
${col("Gender", "string")}
${col("Race", "string")}
${col("DiagGroup", "string")}
${col("LengthOfStay", "int64", { formatString: "0", summarizeBy: "none" })}
${col("LabProcedures", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Procedures", "int64", { formatString: "0", summarizeBy: "none" })}
${col("Medications", "int64", { formatString: "0", summarizeBy: "none" })}
${col("PriorOutpatient", "int64", { formatString: "0", summarizeBy: "none" })}
${col("PriorEmergency", "int64", { formatString: "0", summarizeBy: "none" })}
${col("PriorInpatient", "int64", { formatString: "0", summarizeBy: "none" })}
${col("DiagnosesCount", "int64", { formatString: "0", summarizeBy: "none" })}
${col("DiabetesMed", "string")}
${col("MedChange", "string")}
${col("A1CResult", "string")}
${col("Insulin", "string")}
${col("ReadmittedRaw", "string")}
${col("Readmit30", "int64", { formatString: "0", summarizeBy: "none" })}
${col("ReadmitOutcome", "string")}
${col("LOSBand", "string")}
${col("ReadmitProbability", "double", { formatString: "0.0%" })}
${col("RiskBand", "string")}
${col("RiskRank", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactEncounter", "FactEncounter.csv", [
  ["EncounterID", "Int64.Type"],
  ["PatientID", "Int64.Type"],
  ["AdmissionDate", "type date"],
  ["AdmissionType", "type text"],
  ["AdmissionSource", "type text"],
  ["DischargeDisposition", "type text"],
  ["DischargeGroup", "type text"],
  ["AgeBand", "type text"],
  ["Gender", "type text"],
  ["Race", "type text"],
  ["DiagGroup", "type text"],
  ["LengthOfStay", "Int64.Type"],
  ["LabProcedures", "Int64.Type"],
  ["Procedures", "Int64.Type"],
  ["Medications", "Int64.Type"],
  ["PriorOutpatient", "Int64.Type"],
  ["PriorEmergency", "Int64.Type"],
  ["PriorInpatient", "Int64.Type"],
  ["DiagnosesCount", "Int64.Type"],
  ["DiabetesMed", "type text"],
  ["MedChange", "type text"],
  ["A1CResult", "type text"],
  ["Insulin", "type text"],
  ["ReadmittedRaw", "type text"],
  ["Readmit30", "Int64.Type"],
  ["ReadmitOutcome", "type text"],
  ["LOSBand", "type text"],
  ["ReadmitProbability", "type number"],
  ["RiskBand", "type text"],
  ["RiskRank", "Int64.Type"],
])}
`
);

// --- FactPathwayBridge (disconnected) ---
write(
  path.join(tablesDir, "FactPathwayBridge.tmdl"),
  `table FactPathwayBridge

\tmeasure 'Pathway Weight' = SUM(FactPathwayBridge[Weight])
\t\tformatString: #,0

${col("Source", "string")}
${col("Target", "string")}
${col("Weight", "int64", { formatString: "0" })}
${col("Hop", "int64", { formatString: "0", summarizeBy: "none" })}
${csvPartition("FactPathwayBridge", "FactPathwayBridge.csv", [
  ["Source", "type text"],
  ["Target", "type text"],
  ["Weight", "Int64.Type"],
  ["Hop", "Int64.Type"],
])}
`
);

// --- FactHeatBridge (disconnected) ---
write(
  path.join(tablesDir, "FactHeatBridge.tmdl"),
  `table FactHeatBridge

\tmeasure 'Heat Encounters' = SUM(FactHeatBridge[Encounters])
\t\tformatString: #,0

\tmeasure 'Heat Readmit Rate' = DIVIDE(SUM(FactHeatBridge[Readmit30]), SUM(FactHeatBridge[Encounters]))
\t\tformatString: 0.0%

${col("AgeBand", "string")}
${col("DiagGroup", "string")}
${col("Encounters", "int64", { formatString: "0" })}
${col("Readmit30", "int64", { formatString: "0" })}
${col("ReadmitRate", "double", { formatString: "0.0%" })}
${csvPartition("FactHeatBridge", "FactHeatBridge.csv", [
  ["AgeBand", "type text"],
  ["DiagGroup", "type text"],
  ["Encounters", "Int64.Type"],
  ["Readmit30", "Int64.Type"],
  ["ReadmitRate", "type number"],
])}
`
);

// --- Report scaffolding ---
const pages = {
  pulse: pageId(),
  pathways: pageId(),
  queue: pageId(),
  context: pageId(),
  profile: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "CarePulse.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "CarePulse.Report" } }],
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
      datasetReference: { byPath: { path: "../CarePulse.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Care Pulse", "Report");
writePlatform(sm, "Care Pulse", "SemanticModel");

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
      pageOrder: [pages.pulse, pages.pathways, pages.queue, pages.context, pages.profile],
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

pageShell(pages.pulse, "Care Pulse");
pageShell(pages.pathways, "Pathways & Drivers");
pageShell(pages.queue, "Discharge Risk Queue");
pageShell(pages.context, "Context");
pageShell(pages.profile, "Encounter Profile", { visibility: "HiddenInViewMode" });

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      sm,
      rpt,
      goldDir,
      dimPatientKey: "patient_nbr",
      relationships: [
        "FactEncounter.AdmissionDate → DimDate.Date",
        "FactEncounter.PatientID → DimPatient.patient_nbr",
        "FactPathwayBridge disconnected",
        "FactHeatBridge disconnected",
      ],
      pbip: path.join(root, "CarePulse.pbip"),
    },
    null,
    2
  )
);

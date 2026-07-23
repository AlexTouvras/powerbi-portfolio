/**
 * Scaffold CreditRisk PBIP — credit-scoring star schema + 6-page Nordic mist shells.
 * Gold CSVs expected under data/gold/. DimApplication key column is SK_ID_CURR.
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

const sm = path.join(root, "CreditRisk.SemanticModel");
const rpt = path.join(root, "CreditRisk.Report");
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
      throw new Error(`No M type mapping for dataType "${dataType}"`);
  }
}

function csvPartition(tableName, fileName, typeSteps) {
  // Step names must NOT match the query/table name — Desktop can rewrite
  // `in FactX` into a self-binding that throws "cyclic reference".
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

/** Long-format chart tables as DAX (no Power Query) — avoids dual CSV load + cyclic M risks. */
function calculatedPartition(daxExpression) {
  return `
	partition PLACEHOLDER = calculated
		mode: import
		source =
${daxExpression
  .split("\n")
  .map((l) => "\t\t\t" + l)
  .join("\n")}
`.trimEnd();
}

function col(name, dataType, opts = {}) {
  const lines = [`\tcolumn ${name}`, `\t\tdataType: ${dataType}`];
  if (opts.formatString) lines.push(`\t\tformatString: ${opts.formatString}`);
  if (opts.isHidden) lines.push(`\t\tisHidden`);
  if (opts.summarizeBy !== undefined) lines.push(`\t\tsummarizeBy: ${opts.summarizeBy}`);
  if (opts.dataCategory) lines.push(`\t\tdataCategory: ${opts.dataCategory}`);
  if (opts.sortByColumn) lines.push(`\t\tsortByColumn: ${opts.sortByColumn}`);
  const src = opts.sourceColumnBracketed ? `[${name}]` : name;
  lines.push(`\t\tsourceColumn: ${src}`);
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
  const typeSteps = cols.map(([n, t]) => [n, mtype(t)]);
  parts.push(csvPartition(tableName, csvFile, typeSteps));
  return parts.join("\n");
}

function calculatedTableBody(cols, tableName, daxExpression, measures = []) {
  const parts = [];
  if (measures.length) parts.push(measures.join("\n"));
  // Calculated-table columns use bracketed sourceColumn names.
  parts.push(
    cols
      .map(([n, t, o = {}]) => col(n, t, { ...o, sourceColumnBracketed: true }))
      .join("\n")
  );
  parts.push(calculatedPartition(daxExpression).replace("PLACEHOLDER", tableName));
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
  `database CreditRisk
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimApplication","DimDate","ModelMetrics","FactGradeBridge","DimScorecard","FactPsi","FactVintage","FactCalibration","FactCutoffCurve","FactCutoffPolicy","FactGiniCompare","FactRocCurve","FactPdDistribution","FactNewBusinessTS"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimApplication
ref table DimDate
ref table ModelMetrics
ref table FactGradeBridge
ref table DimScorecard
ref table FactPsi
ref table FactVintage
ref table FactCalibration
ref table FactCalibrationLong
ref table FactCutoffCurve
ref table FactCutoffLong
ref table FactCutoffPolicy
ref table FactGiniCompare
ref table FactRocCurve
ref table FactPdDistribution
ref table FactNewBusinessTS
ref table FactNewBusinessLong
`
);

// Single relationship: DimApplication[application_date] → DimDate[Date]. All other fact
// tables are standalone aggregate/reference tables — intentionally disconnected.
write(
  path.join(def, "relationships.tmdl"),
  `relationship DimApplication_DimDate
\tfromColumn: DimApplication.application_date
\ttoColumn: DimDate.Date
`
);

// --- DimDate ---
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

// --- DimApplication (application-level credit-risk star, header verified from CSV) ---
const dimApplicationCols = [
  ["SK_ID_CURR", "int64", { formatString: "0", summarizeBy: "none" }],
  ["application_date", "dateTime", { formatString: "yyyy-mm-dd", summarizeBy: "none" }],
  ["TARGET", "int64", { formatString: "0", summarizeBy: "none" }],
  ["NAME_CONTRACT_TYPE", "string", {}],
  ["CODE_GENDER", "string", {}],
  ["NAME_INCOME_TYPE", "string", {}],
  ["NAME_EDUCATION_TYPE", "string", {}],
  ["NAME_FAMILY_STATUS", "string", {}],
  ["NAME_HOUSING_TYPE", "string", {}],
  ["FLAG_OWN_CAR", "string", {}],
  ["FLAG_OWN_REALTY", "string", {}],
  ["AMT_INCOME_TOTAL", "double", { formatString: "#,0" }],
  ["AMT_CREDIT", "double", { formatString: "#,0" }],
  ["AMT_ANNUITY", "double", { formatString: "#,0" }],
  ["AgeYears", "double", { formatString: "#,0.0" }],
  ["EmploymentYears", "double", { formatString: "#,0.0" }],
  ["CreditIncomeRatio", "double", { formatString: "#,0.00" }],
  ["AnnuityIncomeRatio", "double", { formatString: "0.0%" }],
  ["REGION_RATING_CLIENT", "int64", { formatString: "0", summarizeBy: "none" }],
  ["EXT_SOURCE_1", "double", { formatString: "0.000" }],
  ["EXT_SOURCE_2", "double", { formatString: "0.000" }],
  ["EXT_SOURCE_3", "double", { formatString: "0.000" }],
  ["EXT_MEAN", "double", { formatString: "0.000" }],
  ["BUR_CNT", "double", { formatString: "#,0" }],
  ["BUR_AMT_CREDIT_SUM", "double", { formatString: "#,0" }],
  ["BUR_AMT_CREDIT_SUM_OVERDUE", "double", { formatString: "#,0" }],
  ["BUR_ACTIVE_CNT", "double", { formatString: "#,0" }],
  ["PREV_CNT", "double", { formatString: "#,0" }],
  ["PREV_REFUSED_RATE", "double", { formatString: "0.0%" }],
  ["PREV_APPROVED_RATE", "double", { formatString: "0.0%" }],
  ["INST_CNT", "double", { formatString: "#,0" }],
  ["INST_DELAY_MEAN", "double", { formatString: "#,0.0" }],
  ["EAD", "double", { formatString: "#,0" }],
  ["LGD", "double", { formatString: "0.0%" }],
  ["PD", "double", { formatString: "0.0%" }],
  ["Score", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["Grade", "string", { sortByColumn: "GradeSort" }],
  ["GradeSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["RiskBand", "string", {}],
  ["RiskRank", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["EL", "double", { formatString: "#,0" }],
  ["Stage", "string", {}],
  ["Decision", "string", {}],
  ["RecommendedAction", "string", {}],
  ["IsOOT", "int64", { formatString: "0", summarizeBy: "none" }],
  ["SampleSplit", "string", {}],
  ["VintageMonth", "string", {}],
];

const dimApplicationMeasures = [
  measure("Applications", "COUNTROWS(DimApplication)", "#,0"),
  measure("Defaults", "CALCULATE([Applications], DimApplication[TARGET] = 1)", "#,0"),
  measure("Default Rate", "DIVIDE([Defaults], [Applications])", "0.0%"),
  measure("Avg PD", "AVERAGE(DimApplication[PD])", "0.0%"),
  measure("Sum EAD", "SUM(DimApplication[EAD])", "#,0"),
  measure("Sum EL", "SUM(DimApplication[EL])", "#,0"),
  measure("EL Rate", "DIVIDE([Sum EL], [Sum EAD])", "0.0%"),
  measure("High Risk Applications", 'CALCULATE([Applications], DimApplication[RiskBand] = "High")', "#,0"),
  measure("Avg Score", "AVERAGE(DimApplication[Score])", "#,0"),
  measure("Approved Apps", 'CALCULATE([Applications], DimApplication[Decision] = "Approve")', "#,0"),
];

write(
  path.join(tablesDir, "DimApplication.tmdl"),
  `table DimApplication

${tableBody(dimApplicationCols, "DimApplication.csv", "DimApplication", dimApplicationMeasures)}
`
);

// --- ModelMetrics (single-row champion-model summary, disconnected) ---
const modelMetricsCols = [
  ["SampleN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["FullN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["DefaultRate", "double", { formatString: "0.0%" }],
  ["TrainN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["TestN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["OotN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["TrainAUC", "double", { formatString: "0.000" }],
  ["TrainGini", "double", { formatString: "0.0%" }],
  ["TrainKS", "double", { formatString: "0.000" }],
  ["TestAUC", "double", { formatString: "0.000" }],
  ["TestGini", "double", { formatString: "0.0%" }],
  ["TestKS", "double", { formatString: "0.000" }],
  ["TestBrier", "double", { formatString: "0.000" }],
  ["OotAUC", "double", { formatString: "0.000" }],
  ["OotGini", "double", { formatString: "0.0%" }],
  ["OotKS", "double", { formatString: "0.000" }],
  ["OotBrier", "double", { formatString: "0.000" }],
  ["CutoffPD", "double", { formatString: "0.0%" }],
  ["BudgetedBadRate", "double", { formatString: "0.0%" }],
  ["YoudenCutoffPD", "double", { formatString: "0.0%" }],
  ["ScorecardGoLive", "string", {}],
  ["OotApprovalRate", "double", { formatString: "0.0%" }],
  ["OotBadRateApproved", "double", { formatString: "0.0%" }],
  ["LGD", "double", { formatString: "0.0%" }],
  ["Champion", "string", {}],
  ["PsiBreachCount", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["PsiWatchCount", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["CalibMeanPredictedOOT", "double", { formatString: "0.0%" }],
  ["CalibMeanRealizedOOT", "double", { formatString: "0.0%" }],
];

const modelMetricsMeasures = [
  measure("OOT Gini", "MAX(ModelMetrics[OotGini])", "0.0%"),
  measure("Train Gini", "MAX(ModelMetrics[TrainGini])", "0.0%"),
  measure("Test Gini", "MAX(ModelMetrics[TestGini])", "0.0%"),
  measure("OOT AUC", "MAX(ModelMetrics[OotAUC])", "0.000"),
  measure("Test AUC", "MAX(ModelMetrics[TestAUC])", "0.000"),
  measure("OOT KS", "MAX(ModelMetrics[OotKS])", "0.000"),
  measure("Test KS", "MAX(ModelMetrics[TestKS])", "0.000"),
  measure("Champion Cutoff PD", "MAX(ModelMetrics[CutoffPD])", "0.0%"),
];

write(
  path.join(tablesDir, "ModelMetrics.tmdl"),
  `table ModelMetrics

${tableBody(modelMetricsCols, "ModelMetrics.csv", "ModelMetrics", modelMetricsMeasures)}
`
);

// --- FactGradeBridge (grade-level rollup, disconnected) ---
const factGradeBridgeCols = [
  ["Grade", "string", { sortByColumn: "GradeSort" }],
  ["GradeSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["Applications", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["DefaultRate", "double", { formatString: "0.0%" }],
  ["AvgPD", "double", { formatString: "0.0%" }],
  ["Exposure", "double", { formatString: "#,0" }],
  ["EL", "double", { formatString: "#,0" }],
];

const factGradeBridgeMeasures = [
  measure("Grade Default Rate", "AVERAGE(FactGradeBridge[DefaultRate])", "0.0%"),
  measure("Grade Avg PD", "AVERAGE(FactGradeBridge[AvgPD])", "0.0%"),
];

write(
  path.join(tablesDir, "FactGradeBridge.tmdl"),
  `table FactGradeBridge

${tableBody(factGradeBridgeCols, "FactGradeBridge.csv", "FactGradeBridge", factGradeBridgeMeasures)}
`
);

// --- DimScorecard (WoE/IV bins, disconnected) ---
const dimScorecardCols = [
  ["Feature", "string", {}],
  ["Bin", "string", {}],
  ["WoE", "double", { formatString: "0.00" }],
  ["IV", "double", { formatString: "0.000" }],
  ["N", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["BadRate", "double", { formatString: "0.0%" }],
  ["Points", "int64", { formatString: "#,0", summarizeBy: "none" }],
];

const dimScorecardMeasures = [measure("Max IV", "MAX(DimScorecard[IV])", "0.000")];

write(
  path.join(tablesDir, "DimScorecard.tmdl"),
  `table DimScorecard

${tableBody(dimScorecardCols, "DimScorecard.csv", "DimScorecard", dimScorecardMeasures)}
`
);

// --- FactPsi (population stability index, disconnected) ---
const factPsiCols = [
  ["Feature", "string", {}],
  ["PSI", "double", { formatString: "0.000" }],
  ["StabilityFlag", "string", {}],
  ["Threshold", "double", { formatString: "0.00" }],
  ["BaselineYear", "int64", { formatString: "0", summarizeBy: "none" }],
  ["RecentYear", "int64", { formatString: "0", summarizeBy: "none" }],
  ["RecentWindow", "string", {}],
];

const factPsiMeasures = [
  measure("Max PSI", "MAX(FactPsi[PSI])", "0.000"),
  measure("PSI Breach Features", 'CALCULATE(COUNTROWS(FactPsi), FactPsi[StabilityFlag] = "Breach")', "#,0"),
  measure("PSI Watch Features", 'CALCULATE(COUNTROWS(FactPsi), FactPsi[StabilityFlag] = "Watch")', "#,0"),
];

write(
  path.join(tablesDir, "FactPsi.tmdl"),
  `table FactPsi

${tableBody(factPsiCols, "FactPsi.csv", "FactPsi", factPsiMeasures)}
`
);

// --- FactVintage (vintage-curve rollup, disconnected; no measures — report uses column aggregation) ---
const factVintageCols = [
  ["VintageMonth", "string", {}],
  ["MOB", "int64", { formatString: "0", summarizeBy: "none" }],
  ["DefaultRate", "double", { formatString: "0.0%" }],
  ["Applications", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["Exposure", "double", { formatString: "#,0" }],
];

write(
  path.join(tablesDir, "FactVintage.tmdl"),
  `table FactVintage

${tableBody(factVintageCols, "FactVintage.csv", "FactVintage")}
`
);

// --- FactCalibration (decile calibration, disconnected; no measures — report uses column aggregation) ---
const factCalibrationCols = [
  ["Decile", "int64", { formatString: "0", summarizeBy: "none" }],
  ["PredictedPD", "double", { formatString: "0.0%" }],
  ["RealizedRate", "double", { formatString: "0.0%" }],
  ["N", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["DecileLabel", "string", { sortByColumn: "Decile" }],
  ["Gap", "double", { formatString: "0.0%" }],
];

write(
  path.join(tablesDir, "FactCalibration.tmdl"),
  `table FactCalibration

${tableBody(factCalibrationCols, "FactCalibration.csv", "FactCalibration")}
`
);

// --- FactCalibrationLong (DAX unpivot of FactCalibration — no Power Query) ---
const factCalibrationLongCols = [
  ["Decile", "int64", { formatString: "0", summarizeBy: "none" }],
  ["DecileLabel", "string", { sortByColumn: "Decile" }],
  ["N", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["Metric", "string", {}],
  ["Rate", "double", { formatString: "0.0%" }],
];

const factCalibrationLongMeasures = [measure("Calibration Rate", "AVERAGE(FactCalibrationLong[Rate])", "0.0%")];

const factCalibrationLongDax = `UNION(
				SELECTCOLUMNS(
					FactCalibration,
					"Decile", FactCalibration[Decile],
					"DecileLabel", FactCalibration[DecileLabel],
					"N", FactCalibration[N],
					"Metric", "Predicted PD",
					"Rate", FactCalibration[PredictedPD]
				),
				SELECTCOLUMNS(
					FactCalibration,
					"Decile", FactCalibration[Decile],
					"DecileLabel", FactCalibration[DecileLabel],
					"N", FactCalibration[N],
					"Metric", "Realized default rate",
					"Rate", FactCalibration[RealizedRate]
				)
			)`;

write(
  path.join(tablesDir, "FactCalibrationLong.tmdl"),
  `table FactCalibrationLong

${calculatedTableBody(factCalibrationLongCols, "FactCalibrationLong", factCalibrationLongDax, factCalibrationLongMeasures)}
`
);

// --- FactCutoffCurve (approval/bad-rate trade-off across candidate PD cut-offs, disconnected) ---
const factCutoffCurveCols = [
  ["CutoffPD", "double", { formatString: "0.00", summarizeBy: "none" }],
  ["CutoffScore", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["ApprovalRate", "double", { formatString: "0.0%" }],
  ["BadRateApproved", "double", { formatString: "0.0%" }],
  ["RejectRate", "double", { formatString: "0.0%" }],
  ["ApprovedN", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["MarginalPD", "double", { formatString: "0.0%" }],
  ["IsOperatingCutoff", "int64", { formatString: "0", summarizeBy: "none" }],
  ["IsYoudenCutoff", "int64", { formatString: "0", summarizeBy: "none" }],
  ["BudgetedBadRate", "double", { formatString: "0.0%" }],
];

write(
  path.join(tablesDir, "FactCutoffCurve.tmdl"),
  `table FactCutoffCurve

${tableBody(factCutoffCurveCols, "FactCutoffCurve.csv", "FactCutoffCurve")}
`
);

// --- FactCutoffLong (acceptance frontier: approval rate vs bad rate by scorecard) ---
const factCutoffLongCols = [
  ["Scorecard", "string", {}],
  ["ApprovalRate", "double", { formatString: "0.0%", summarizeBy: "none" }],
  ["BadRateApproved", "double", { formatString: "0.0%" }],
  ["PointSort", "int64", { formatString: "0", summarizeBy: "none", isHidden: true }],
];

const factCutoffLongMeasures = [
  measure("Frontier Bad Rate", "AVERAGE(FactCutoffLong[BadRateApproved])", "0.0%"),
];

write(
  path.join(tablesDir, "FactCutoffLong.tmdl"),
  `table FactCutoffLong

${tableBody(factCutoffLongCols, "FactCutoffLong.csv", "FactCutoffLong", factCutoffLongMeasures)}
`
);

// --- FactCutoffPolicy (risk–reward operating + Youden reference) ---
const factCutoffPolicyCols = [
  ["Method", "string", { sortByColumn: "MethodSort" }],
  ["Role", "string", {}],
  ["MethodSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["IsOperating", "int64", { formatString: "0", summarizeBy: "none" }],
  ["OperatingCutoffPD", "double", { formatString: "0.0%" }],
  ["OperatingCutoffScore", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["OotApprovalRate", "double", { formatString: "0.0%" }],
  ["OotBadRateApproved", "double", { formatString: "0.0%" }],
  ["OotRejectRate", "double", { formatString: "0.0%" }],
  ["BudgetedBadRate", "double", { formatString: "0.0%" }],
  ["MarginalPD", "double", { formatString: "0.0%" }],
  ["PolicyNote", "string", {}],
];

const factCutoffPolicyMeasures = [
  measure(
    "Operating Cutoff PD",
    "CALCULATE(MAX(FactCutoffPolicy[OperatingCutoffPD]), FactCutoffPolicy[IsOperating] = 1)",
    "0.0%"
  ),
  measure(
    "Operating Cutoff Score",
    "CALCULATE(MAX(FactCutoffPolicy[OperatingCutoffScore]), FactCutoffPolicy[IsOperating] = 1)",
    "#,0"
  ),
  measure(
    "Policy Approval Rate",
    "CALCULATE(MAX(FactCutoffPolicy[OotApprovalRate]), FactCutoffPolicy[IsOperating] = 1)",
    "0.0%"
  ),
  measure(
    "Policy Bad Rate",
    "CALCULATE(MAX(FactCutoffPolicy[OotBadRateApproved]), FactCutoffPolicy[IsOperating] = 1)",
    "0.0%"
  ),
  measure(
    "Budgeted Bad Rate",
    "CALCULATE(MAX(FactCutoffPolicy[BudgetedBadRate]), FactCutoffPolicy[IsOperating] = 1)",
    "0.0%"
  ),
];

write(
  path.join(tablesDir, "FactCutoffPolicy.tmdl"),
  `table FactCutoffPolicy

${tableBody(factCutoffPolicyCols, "FactCutoffPolicy.csv", "FactCutoffPolicy", factCutoffPolicyMeasures)}
`
);

// --- FactGiniCompare (Train vs OOT discrimination summary) ---
const factGiniCompareCols = [
  ["Sample", "string", { sortByColumn: "SampleSort" }],
  ["SampleSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["AUC", "double", { formatString: "0.000" }],
  ["Gini", "double", { formatString: "0.0%" }],
  ["KS", "double", { formatString: "0.000" }],
  ["N", "int64", { formatString: "#,0", summarizeBy: "none" }],
];

const factGiniCompareMeasures = [
  measure("Sample Gini", "AVERAGE(FactGiniCompare[Gini])", "0.0%"),
  measure("Sample AUC", "AVERAGE(FactGiniCompare[AUC])", "0.000"),
  measure("Sample KS", "AVERAGE(FactGiniCompare[KS])", "0.000"),
];

write(
  path.join(tablesDir, "FactGiniCompare.tmdl"),
  `table FactGiniCompare

${tableBody(factGiniCompareCols, "FactGiniCompare.csv", "FactGiniCompare", factGiniCompareMeasures)}
`
);

// --- FactRocCurve (ROC curves Train vs OOT for line chart) ---
const factRocCurveCols = [
  ["Sample", "string", {}],
  ["FprSort", "int64", { formatString: "0", summarizeBy: "none" }],
  ["FprLabel", "string", { sortByColumn: "FprSort" }],
  ["FPR", "double", { formatString: "0.0%" }],
  ["TPR", "double", { formatString: "0.0%" }],
];

const factRocCurveMeasures = [measure("True Positive Rate", "AVERAGE(FactRocCurve[TPR])", "0.0%")];

write(
  path.join(tablesDir, "FactRocCurve.tmdl"),
  `table FactRocCurve

${tableBody(factRocCurveCols, "FactRocCurve.csv", "FactRocCurve", factRocCurveMeasures)}
`
);

// --- FactPdDistribution (Good vs Bad PD density) ---
const factPdDistributionCols = [
  ["Class", "string", {}],
  ["PdBinSort", "int64", { formatString: "0", summarizeBy: "none" }],
  ["PdBinLabel", "string", { sortByColumn: "PdBinSort" }],
  ["PdBinMid", "double", { formatString: "0.0%" }],
  ["Density", "double", { formatString: "0.00" }],
  ["Share", "double", { formatString: "0.0%" }],
];

const factPdDistributionMeasures = [
  measure("PD Density", "AVERAGE(FactPdDistribution[Density])", "0.00"),
  measure("PD Share", "AVERAGE(FactPdDistribution[Share])", "0.0%"),
];

write(
  path.join(tablesDir, "FactPdDistribution.tmdl"),
  `table FactPdDistribution

${tableBody(factPdDistributionCols, "FactPdDistribution.csv", "FactPdDistribution", factPdDistributionMeasures)}
`
);

// --- FactNewBusinessTS (monthly origination PD vs realized) ---
const factNewBusinessTSCols = [
  ["OriginationMonth", "string", { sortByColumn: "MonthSort" }],
  ["MonthSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["PeriodFlag", "string", {}],
  ["GoLiveDate", "string", {}],
  ["Applications", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["AvgScorecardPD", "double", { formatString: "0.0%" }],
  ["RealizedDefaultRate", "double", { formatString: "0.0%" }],
  ["Exposure", "double", { formatString: "#,0" }],
];

write(
  path.join(tablesDir, "FactNewBusinessTS.tmdl"),
  `table FactNewBusinessTS

${tableBody(factNewBusinessTSCols, "FactNewBusinessTS.csv", "FactNewBusinessTS")}
`
);

// --- FactNewBusinessLong (DAX unpivot of FactNewBusinessTS — no Power Query) ---
const factNewBusinessLongCols = [
  ["OriginationMonth", "string", { sortByColumn: "MonthSort" }],
  ["MonthSort", "int64", { isHidden: true, summarizeBy: "none" }],
  ["PeriodFlag", "string", {}],
  ["GoLiveDate", "string", {}],
  ["Applications", "int64", { formatString: "#,0", summarizeBy: "none" }],
  ["Metric", "string", {}],
  ["Rate", "double", { formatString: "0.0%" }],
];

const factNewBusinessLongMeasures = [measure("New Business Rate", "AVERAGE(FactNewBusinessLong[Rate])", "0.0%")];

const factNewBusinessLongDax = `UNION(
				SELECTCOLUMNS(
					FactNewBusinessTS,
					"OriginationMonth", FactNewBusinessTS[OriginationMonth],
					"MonthSort", FactNewBusinessTS[MonthSort],
					"PeriodFlag", FactNewBusinessTS[PeriodFlag],
					"GoLiveDate", FactNewBusinessTS[GoLiveDate],
					"Applications", FactNewBusinessTS[Applications],
					"Metric", "Scorecard PD",
					"Rate", FactNewBusinessTS[AvgScorecardPD]
				),
				SELECTCOLUMNS(
					FactNewBusinessTS,
					"OriginationMonth", FactNewBusinessTS[OriginationMonth],
					"MonthSort", FactNewBusinessTS[MonthSort],
					"PeriodFlag", FactNewBusinessTS[PeriodFlag],
					"GoLiveDate", FactNewBusinessTS[GoLiveDate],
					"Applications", FactNewBusinessTS[Applications],
					"Metric", "Realized default rate",
					"Rate", FactNewBusinessTS[RealizedDefaultRate]
				)
			)`;

write(
  path.join(tablesDir, "FactNewBusinessLong.tmdl"),
  `table FactNewBusinessLong

${calculatedTableBody(factNewBusinessLongCols, "FactNewBusinessLong", factNewBusinessLongDax, factNewBusinessLongMeasures)}
`
);

// --- Report scaffolding ---
const pages = {
  landing: pageId(),
  pulse: pageId(),
  scorecard: pageId(),
  cutoff: pageId(),
  monitoring: pageId(),
  context: pageId(),
  profile: pageId(),
};
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

write(
  path.join(root, "CreditRisk.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "CreditRisk.Report" } }],
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
      datasetReference: { byPath: { path: "../CreditRisk.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Credit Risk", "Report");
writePlatform(sm, "Credit Risk", "SemanticModel");

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

// Wipe any pre-existing page directories (from prior scaffold runs) so stale
// ReportSection folders never linger outside the freshly generated pageOrder.
const pagesRootDir = path.join(rpt, "definition", "pages");
if (fs.existsSync(pagesRootDir)) fs.rmSync(pagesRootDir, { recursive: true, force: true });
ensureDir(pagesRootDir);

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.landing, pages.pulse, pages.scorecard, pages.cutoff, pages.monitoring, pages.context, pages.profile],
      activePageName: pages.landing,
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

pageShell(pages.landing, "Landing");
pageShell(pages.pulse, "Portfolio Risk Pulse");
pageShell(pages.scorecard, "Scorecard & Validation");
pageShell(pages.cutoff, "Cut-off Strategy");
pageShell(pages.monitoring, "Monitoring & Steering");
pageShell(pages.context, "Context");
pageShell(pages.profile, "Application Profile", { visibility: "HiddenInViewMode" });

console.log(
  JSON.stringify(
    {
      ok: true,
      pages,
      sm,
      rpt,
      goldDir,
      dimApplicationKey: "SK_ID_CURR",
      relationships: [
        "DimApplication.application_date → DimDate.Date",
        "ModelMetrics disconnected",
        "FactGradeBridge disconnected",
        "DimScorecard disconnected",
        "FactPsi disconnected",
        "FactVintage disconnected",
        "FactCalibration disconnected",
        "FactCalibrationLong disconnected",
        "FactCutoffCurve disconnected",
        "FactCutoffLong disconnected",
        "FactCutoffPolicy disconnected",
      ],
      pbip: path.join(root, "CreditRisk.pbip"),
    },
    null,
    2
  )
);

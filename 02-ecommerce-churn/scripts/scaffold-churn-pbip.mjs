/**
 * Scaffold ChurnRetention PBIP — semantic model + 3-page Nordic report.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const goldDir = path.join(root, "data", "gold").replace(/\\/g, "/");
const themeSrc = path.resolve(
  root,
  "../03-sales-executive/SalesExecutive.Report/StaticResources/RegisteredResources/Nordic-Boardroom-a1b2c3d4.json"
);
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const sm = path.join(root, "ChurnRetention.SemanticModel");
const rpt = path.join(root, "ChurnRetention.Report");
const def = path.join(sm, "definition");
const tablesDir = path.join(def, "tables");
const exprDir = path.join(def, "expressions");

const T = "DimCustomer";

function hex(n) {
  return crypto.randomBytes(n).toString("hex");
}
function visualId() {
  return hex(10);
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
  `database ChurnRetention
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

annotation PBI_QueryOrder = ["GoldDataFolder","DimCustomer"]

annotation __PBI_TimeIntelligenceEnabled = 0

ref expression GoldDataFolder
ref table DimCustomer
`
);

write(path.join(def, "relationships.tmdl"), "");

const dimTypes = [
  ["CustomerID", "Int64.Type"],
  ["Churn", "Int64.Type"],
  ["Tenure", "type number"],
  ["PreferredLoginDevice", "type text"],
  ["CityTier", "Int64.Type"],
  ["WarehouseToHome", "type number"],
  ["PreferredPaymentMode", "type text"],
  ["Gender", "type text"],
  ["HourSpendOnApp", "type number"],
  ["NumberOfDeviceRegistered", "Int64.Type"],
  ["PreferedOrderCat", "type text"],
  ["SatisfactionScore", "Int64.Type"],
  ["MaritalStatus", "type text"],
  ["NumberOfAddress", "Int64.Type"],
  ["Complain", "Int64.Type"],
  ["OrderAmountHikeFromlastYear", "type number"],
  ["CouponUsed", "type number"],
  ["OrderCount", "type number"],
  ["DaySinceLastOrder", "type number"],
  ["CashbackAmount", "type number"],
  ["CustomerStatus", "type text"],
  ["WarehouseDistanceBand", "type text"],
  ["TenureBand", "type text"],
  ["CashbackBand", "type text"],
  ["RecencyScore", "Int64.Type"],
  ["FrequencyScore", "Int64.Type"],
  ["ChurnProbability", "type number"],
  ["PredictedChurn", "Int64.Type"],
  ["RiskBand", "type text"],
  ["RiskRank", "Int64.Type"],
];

const dimCols = dimTypes
  .map(([c]) => {
    const hidden = ["PredictedChurn", "RiskRank"].includes(c) ? "\t\tisHidden\n" : "";
    const fmt =
      c === "ChurnProbability"
        ? "\t\tformatString: 0.0%\n"
        : c === "Churn"
          ? "\t\tformatString: 0\n"
          : "";
    return `\tcolumn ${c}
\t\tdataType: ${c.includes("Band") || ["CustomerStatus", "PreferredLoginDevice", "PreferredPaymentMode", "Gender", "PreferedOrderCat", "MaritalStatus"].includes(c) ? "string" : c === "CustomerID" || c.endsWith("Score") || c === "CityTier" || c === "NumberOfDeviceRegistered" || c === "NumberOfAddress" || c === "Complain" || c === "SatisfactionScore" || c === "PredictedChurn" || c === "RiskRank" ? "int64" : "double"}
${fmt}${hidden}\t\tsourceColumn: ${c}
`;
  })
  .join("\n");

write(
  path.join(tablesDir, "DimCustomer.tmdl"),
  `table DimCustomer

\tmeasure Customers = DISTINCTCOUNT(DimCustomer[CustomerID])
\t\tformatString: #,0

\tmeasure 'Churned Customers' = CALCULATE([Customers], DimCustomer[Churn] = 1)
\t\tformatString: #,0

\tmeasure 'Churn Rate' = DIVIDE([Churned Customers], [Customers])
\t\tformatString: 0.0%

\tmeasure 'Avg Churn Probability' = AVERAGE(DimCustomer[ChurnProbability])
\t\tformatString: 0.0%

\tmeasure 'High Risk Customers' = CALCULATE([Customers], DimCustomer[RiskBand] = "High")
\t\tformatString: #,0

\tmeasure 'Retained High Risk' = CALCULATE([Customers], DimCustomer[RiskBand] = "High", DimCustomer[Churn] = 0)
\t\tformatString: #,0

\tmeasure 'Lift vs Baseline' = [Churn Rate] - CALCULATE([Churn Rate], ALLSELECTED(DimCustomer))
\t\tformatString: 0.0%

${dimCols}
${csvPartition("DimCustomer", "DimCustomer.csv", dimTypes)}
`
);

// --- Report scaffolding ---
const pages = { pulse: pageId(), drivers: pageId(), queue: pageId() };
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

function lit(v) {
  if (typeof v === "boolean") return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number") return { expr: { Literal: { Value: Number.isInteger(v) ? `${v}L` : `${v}D` } } };
  return { expr: { Literal: { Value: `'${String(v).replace(/'/g, "''")}'` } } };
}
function measureProj(measure) {
  return {
    field: { Measure: { Expression: { SourceRef: { Entity: T } }, Property: measure } },
    queryRef: `${T}.${measure}`,
    nativeQueryRef: measure,
  };
}
function columnProj(column, active = true) {
  const p = {
    field: { Column: { Expression: { SourceRef: { Entity: T } }, Property: column } },
    queryRef: `${T}.${column}`,
    nativeQueryRef: column,
  };
  if (active) p.active = true;
  return p;
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

write(
  path.join(root, "ChurnRetention.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "ChurnRetention.Report" } }],
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
      datasetReference: { byPath: { path: "../ChurnRetention.SemanticModel" } },
    },
    null,
    2
  )
);

writePlatform(rpt, "Churn Retention", "Report");
writePlatform(sm, "Churn Retention", "SemanticModel");

ensureDir(path.join(rpt, "StaticResources", "SharedResources", "BaseThemes"));
ensureDir(path.join(rpt, "StaticResources", "RegisteredResources"));
fs.copyFileSync(themeSrc, path.join(rpt, "StaticResources", "RegisteredResources", themeFileName));
// Fix theme name inside copy
const themeJson = JSON.parse(fs.readFileSync(path.join(rpt, "StaticResources", "RegisteredResources", themeFileName), "utf8"));
themeJson.name = themeFileName;
fs.writeFileSync(path.join(rpt, "StaticResources", "RegisteredResources", themeFileName), JSON.stringify(themeJson, null, 2));

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
  JSON.stringify({ name: "CY25SU06", dataColors: ["#2F5F73"], foreground: "#0F1C24", background: "#FFFFFF" }, null, 2)
);

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.pulse, pages.drivers, pages.queue],
      activePageName: pages.pulse,
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
  return pageDir;
}

function writeVisual(pageDir, visual) {
  const dir = path.join(pageDir, "visuals", visual.name);
  write(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
}

function textbox(name, text, pos, size = "20pt") {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "textbox",
      objects: {
        general: [
          {
            properties: {
              paragraphs: [
                {
                  textRuns: [{ value: text, textStyle: { fontFamily: "Segoe UI Semibold", fontSize: size, color: "#0F1C24" } }],
                },
              ],
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

function card(name, measure, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measureProj(measure)] } } },
      visualContainerObjects: {
        title: [{ properties: { show: lit(true), text: lit(title) } }],
      },
    },
  };
}

function slicer(name, column, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: { queryState: { Values: { projections: [columnProj(column)] } } },
      objects: { data: [{ properties: { mode: lit("Dropdown") } }] },
      visualContainerObjects: { title: [{ properties: { show: lit(true), text: lit(column) } }] },
    },
  };
}

function barByCategory(name, category, measure, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredBarChart",
      query: {
        queryState: {
          Category: { projections: [columnProj(category)] },
          Y: { projections: [measureProj(measure)] },
        },
        sortDefinition: { sort: [{ field: measureProj(measure).field, direction: "Descending" }] },
      },
      visualContainerObjects: { title: [{ properties: { show: lit(true), text: lit(title) } }] },
    },
  };
}

function keyDrivers(name, pos) {
  const explainCols = [
    "TenureBand",
    "SatisfactionScore",
    "Complain",
    "PreferredPaymentMode",
    "CityTier",
    "WarehouseDistanceBand",
    "NumberOfDeviceRegistered",
    "CashbackBand",
    "Gender",
    "MaritalStatus",
  ];
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "keyDriversVisual",
      query: {
        queryState: {
          Target: { projections: [columnProj("Churn")] },
          ExplainBy: { projections: explainCols.map((c) => columnProj(c)) },
        },
      },
      visualContainerObjects: {
        title: [{ properties: { show: lit(true), text: lit("Key influencers — what drives churn?") } }],
      },
    },
  };
}

function decompTree(name, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "decompositionTreeVisual",
      query: {
        queryState: {
          Analyze: { projections: [measureProj("Churn Rate")] },
          ExplainBy: {
            projections: [
              columnProj("RiskBand"),
              columnProj("TenureBand"),
              columnProj("PreferredPaymentMode"),
              columnProj("CityTier"),
              columnProj("SatisfactionScore"),
            ],
          },
        },
      },
      visualContainerObjects: {
        title: [{ properties: { show: lit(true), text: lit("Decomposition — churn rate breakdown") } }],
      },
    },
  };
}

function matrixSegment(name, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: { projections: [columnProj("PreferredPaymentMode")] },
          Columns: { projections: [columnProj("CityTier")] },
          Values: { projections: [measureProj("Churn Rate"), measureProj("Customers")] },
        },
      },
      visualContainerObjects: {
        title: [{ properties: { show: lit(true), text: lit("Churn rate by payment mode and city tier") } }],
      },
    },
  };
}

function riskTable(name, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: [
              columnProj("CustomerID"),
              columnProj("ChurnProbability"),
              columnProj("RiskBand"),
              columnProj("Tenure"),
              columnProj("DaySinceLastOrder"),
              columnProj("SatisfactionScore"),
              columnProj("Complain"),
              columnProj("CustomerStatus"),
            ],
          },
        },
        sortDefinition: {
          sort: [{ field: columnProj("ChurnProbability").field, direction: "Descending" }],
        },
      },
      visualContainerObjects: {
        title: [{ properties: { show: lit(true), text: lit("Customer risk queue — sort by propensity") } }],
      },
    },
  };
}

function pageNavigator(name, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pageNavigator",
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

// Page 1 — Retention Pulse
{
  const d = pageShell(pages.pulse, "Retention Pulse");
  let z = 0;
  [
    textbox(visualId(), "Retention Pulse — Portfolio health and risk concentration", { x: 32, y: 20, z: z++, height: 48, width: 1100, tabOrder: 0 }),
    textbox(
      visualId(),
      "Churn rate, propensity, and tenure mix. ML scores are illustrative sample-model output.",
      { x: 32, y: 72, z: z++, height: 36, width: 1100, tabOrder: 1 },
      "11pt"
    ),
    pageNavigator(visualId(), { x: 1560, y: 20, z: z++, height: 48, width: 328, tabOrder: 2 }),
    slicer(visualId(), "RiskBand", { x: 1120, y: 16, z: z++, height: 80, width: 200, tabOrder: 3 }),
    slicer(visualId(), "CityTier", { x: 1340, y: 16, z: z++, height: 80, width: 200, tabOrder: 4 }),
    card(visualId(), "Churn Rate", { x: 32, y: 112, z: z++, height: 120, width: 440, tabOrder: 5 }, "Churn rate"),
    card(visualId(), "Customers", { x: 488, y: 112, z: z++, height: 120, width: 440, tabOrder: 6 }, "Customers"),
    card(visualId(), "Avg Churn Probability", { x: 944, y: 112, z: z++, height: 120, width: 440, tabOrder: 7 }, "Avg propensity"),
    card(visualId(), "Retained High Risk", { x: 1400, y: 112, z: z++, height: 120, width: 488, tabOrder: 8 }, "Retained high risk"),
    barByCategory(
      visualId(),
      "TenureBand",
      "Churn Rate",
      { x: 32, y: 256, z: z++, height: 784, width: 1856, tabOrder: 9 },
      "Churn rate by tenure band"
    ),
  ].forEach((v) => writeVisual(d, v));
}

// Page 2 — Churn Drivers
{
  const d = pageShell(pages.drivers, "Churn Drivers");
  let z = 0;
  [
    textbox(visualId(), "Churn Drivers — What moves retention", { x: 32, y: 20, z: z++, height: 48, width: 900, tabOrder: 0 }),
    pageNavigator(visualId(), { x: 1560, y: 20, z: z++, height: 48, width: 328, tabOrder: 1 }),
    slicer(visualId(), "TenureBand", { x: 32, y: 88, z: z++, height: 80, width: 220, tabOrder: 2 }),
    slicer(visualId(), "PreferredPaymentMode", { x: 272, y: 88, z: z++, height: 80, width: 260, tabOrder: 3 }),
    keyDrivers(visualId(), { x: 32, y: 184, z: z++, height: 420, width: 920, tabOrder: 4 }),
    decompTree(visualId(), { x: 976, y: 184, z: z++, height: 420, width: 912, tabOrder: 5 }),
    matrixSegment(visualId(), { x: 32, y: 624, z: z++, height: 416, width: 1856, tabOrder: 6 }),
  ].forEach((v) => writeVisual(d, v));
}

// Page 3 — At-Risk Queue
{
  const d = pageShell(pages.queue, "At-Risk Queue");
  let z = 0;
  [
    textbox(visualId(), "At-Risk Queue — Intervention list", { x: 32, y: 20, z: z++, height: 48, width: 900, tabOrder: 0 }),
    pageNavigator(visualId(), { x: 1560, y: 20, z: z++, height: 48, width: 328, tabOrder: 1 }),
    slicer(visualId(), "RiskBand", { x: 1120, y: 16, z: z++, height: 80, width: 200, tabOrder: 2 }),
    slicer(visualId(), "CityTier", { x: 1340, y: 16, z: z++, height: 80, width: 200, tabOrder: 3 }),
    slicer(visualId(), "SatisfactionScore", { x: 1560, y: 16, z: z++, height: 80, width: 200, tabOrder: 4 }),
    card(visualId(), "High Risk Customers", { x: 32, y: 96, z: z++, height: 100, width: 420, tabOrder: 5 }, "High risk"),
    card(visualId(), "Retained High Risk", { x: 472, y: 96, z: z++, height: 100, width: 420, tabOrder: 6 }, "Retained high risk"),
    riskTable(visualId(), { x: 32, y: 216, z: z++, height: 824, width: 1856, tabOrder: 7 }),
  ].forEach((v) => writeVisual(d, v));
}

console.log(
  JSON.stringify({ ok: true, pbip: path.join(root, "ChurnRetention.pbip"), pages, goldDir }, null, 2)
);

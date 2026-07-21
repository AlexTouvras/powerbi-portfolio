/**
 * Elevate CarePulse report — Nordic Boardroom polish across 4 pages.
 * Reads page IDs dynamically from pages.json (do not hardcode ReportSection IDs).
 * Sync groups: CareSync_${col} (one field per group).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REPORT = path.join(root, "CarePulse.Report");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";
const SANKEY_GUID = "sankey02300D1BE6F5427989F3DE31CCA9E0F32020";
const SANKEY_SRC = path.join(
  root,
  "_tmp",
  "powerbi-visuals-sankey",
  "dist"
);

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const SYNC_PREFIX = "CareSync";
const FOOTER =
  "Source: UCI Diabetes 130-US Hospitals · Local PBIP · Nordic Boardroom · 30d readmission propensity (sample model)";
/** Four visible pages — slicers end before NAV (gap ≥16px). */
const NAV = { x: 1496, y: 12, z: 0, height: 80, width: 392 };
const SL = {
  a: { x: 900, y: 12, height: 80, width: 176 },
  b: { x: 1088, y: 12, height: 80, width: 176 },
  c: { x: 1276, y: 12, height: 80, width: 200 },
};

const ACCENTS = {
  readmit: "#B42318",
  encounters: "#2F5F73",
  los: "#C17B3A",
  highRisk: "#B42318",
  probability: "#C17B3A",
  meds: "#2F5F73",
  labs: "#5B8FA3",
  teal: "#2F5F73",
};

function id() {
  return crypto.randomBytes(10).toString("hex");
}
function lit(v) {
  if (typeof v === "boolean")
    return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number" && Number.isInteger(v))
    return { expr: { Literal: { Value: `${v}L` } } };
  if (typeof v === "number")
    return { expr: { Literal: { Value: `${v}D` } } };
  return { expr: { Literal: { Value: `'${String(v).replace(/'/g, "''")}'` } } };
}
function litD(v) {
  return { expr: { Literal: { Value: `${v}D` } } };
}
function solid(hex) {
  return { solid: { color: { expr: { Literal: { Value: `'${hex}'` } } } } };
}

function measure(entity, name) {
  return {
    field: {
      Measure: {
        Expression: { SourceRef: { Entity: entity } },
        Property: name,
      },
    },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
}
function column(entity, name, active = true) {
  const p = {
    field: {
      Column: {
        Expression: { SourceRef: { Entity: entity } },
        Property: name,
      },
    },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
  if (active) p.active = true;
  return p;
}

/** Aggregation Function: 0=Sum, 1=Avg, 2=Min, 3=Max, 4=Count, 5=DistinctCount */
function aggColumn(entity, col, func = 1) {
  const labels = {
    0: "Sum",
    1: "Average",
    2: "Min",
    3: "Max",
    4: "Count",
    5: "CountDistinct",
  };
  const prefix = labels[func] || "Avg";
  return {
    field: {
      Aggregation: {
        Expression: {
          Column: {
            Expression: { SourceRef: { Entity: entity } },
            Property: col,
          },
        },
        Function: func,
      },
    },
    queryRef: `${prefix}(${entity}.${col})`,
    nativeQueryRef: `${prefix} of ${col}`,
  };
}

function ensureContextPage(meta) {
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
    if (!fs.existsSync(pagePath)) continue;
    const pj = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    byDisplay[pj.displayName] = pageKey;
  }
  if (byDisplay["Context"]) return meta;

  const pageKey = "ReportSection" + crypto.randomBytes(12).toString("hex");
  const pageDir = path.join(REPORT, "definition/pages", pageKey);
  fs.mkdirSync(path.join(pageDir, "visuals"), { recursive: true });
  fs.writeFileSync(
    path.join(pageDir, "page.json"),
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: pageKey,
        displayName: "Context",
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

  // Insert Context as last visible page (before hidden Encounter Profile if present)
  const profileKey = byDisplay["Encounter Profile"];
  const order = meta.pageOrder.filter((k) => k !== profileKey);
  order.push(pageKey);
  if (profileKey) order.push(profileKey);
  meta.pageOrder = order;
  fs.writeFileSync(
    path.join(REPORT, "definition/pages/pages.json"),
    JSON.stringify(
      {
        $schema:
          "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
        pageOrder: meta.pageOrder,
        activePageName: meta.activePageName,
      },
      null,
      2
    )
  );
  return meta;
}

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  if (!fs.existsSync(pagesPath)) {
    throw new Error(`Missing ${pagesPath} — run scaffold-healthcare-pbip.mjs first`);
  }
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  meta = ensureContextPage(meta);
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pj = JSON.parse(
      fs.readFileSync(path.join(REPORT, "definition/pages", pageKey, "page.json"), "utf8")
    );
    byDisplay[pj.displayName] = pageKey;
  }
  const required = [
    "Care Pulse",
    "Pathways & Drivers",
    "Discharge Risk Queue",
    "Context",
    "Encounter Profile",
  ];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  return {
    pulse: byDisplay["Care Pulse"],
    pathways: byDisplay["Pathways & Drivers"],
    queue: byDisplay["Discharge Risk Queue"],
    context: byDisplay["Context"],
    profile: byDisplay["Encounter Profile"],
    meta,
  };
}

function clearVisuals(pageName) {
  const dir = path.join(REPORT, "definition/pages", pageName, "visuals");
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
function writeVisual(pageName, visual) {
  const dir = path.join(REPORT, "definition/pages", pageName, "visuals", visual.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
}

function cardChrome(title) {
  return {
    background: [
      {
        properties: {
          show: lit(true),
          color: solid("#FFFFFF"),
          transparency: litD(0),
        },
      },
    ],
    border: [
      {
        properties: {
          show: lit(true),
          color: solid("#E8EEF2"),
          radius: litD(8),
        },
      },
    ],
    title: title
      ? [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ]
      : [{ properties: { show: lit(false) } }],
    visualHeader: [{ properties: { show: lit(false) } }],
    padding: [
      {
        properties: {
          top: litD(8),
          bottom: litD(8),
          left: litD(12),
          right: litD(12),
        },
      },
    ],
  };
}

function pageChrome(pageKey, displayName, extras = {}) {
  const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
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
      outspacePane: [
        {
          properties: {
            width: { expr: { Literal: { Value: "200D" } } },
            backgroundColor: {
              solid: { color: { expr: { Literal: { Value: "'#FFFFFF'" } } } },
            },
            foregroundColor: {
              solid: { color: { expr: { Literal: { Value: "'#0F1C24'" } } } },
            },
            border: { expr: { Literal: { Value: "true" } } },
            borderColor: {
              solid: { color: { expr: { Literal: { Value: "'#E8EEF2'" } } } },
            },
            checkboxAndApplyColor: {
              solid: { color: { expr: { Literal: { Value: "'#2F5F73'" } } } },
            },
            inputBoxColor: {
              solid: { color: { expr: { Literal: { Value: "'#FFFFFF'" } } } },
            },
            fontFamily: { expr: { Literal: { Value: "'Segoe UI'" } } },
            titleSize: { expr: { Literal: { Value: "11D" } } },
            headerSize: { expr: { Literal: { Value: "10D" } } },
          },
        },
      ],
    },
    ...extras,
  };
  fs.writeFileSync(pagePath, JSON.stringify(page, null, 2));
}

function textbox(name, pos, lines) {
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
              paragraphs: lines.map((l) => ({
                textRuns: [
                  {
                    value: l.text,
                    textStyle: {
                      fontFamily: l.font || "Segoe UI",
                      fontSize: l.size || "12pt",
                      color: l.color || "#0F1C24",
                      fontWeight: l.bold ? "bold" : undefined,
                    },
                  },
                ],
                horizontalTextAlignment: l.align || "left",
              })),
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(0),
              bottom: litD(0),
              left: litD(0),
              right: litD(0),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
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
      objects: {
        pages: [{ properties: { showHiddenPages: lit(false) } }],
        fill: [
          {
            properties: {
              show: lit(true),
              fillColor: solid("#FFFFFF"),
              transparency: litD(0),
            },
            selector: { id: "default" },
          },
          {
            properties: {
              show: lit(true),
              fillColor: solid("#2F5F73"),
              transparency: litD(0),
            },
            selector: { id: "selected" },
          },
          {
            properties: {
              show: lit(true),
              fillColor: solid("#D7E6EC"),
              transparency: litD(0),
            },
            selector: { id: "hover" },
          },
        ],
        outline: [
          {
            properties: {
              show: lit(true),
              weight: litD(1),
              lineColor: solid("#C5CED4"),
            },
            selector: { id: "default" },
          },
          {
            properties: {
              show: lit(true),
              weight: litD(1),
              lineColor: solid("#2F5F73"),
            },
            selector: { id: "selected" },
          },
        ],
        text: [
          {
            properties: {
              show: lit(true),
              fontSize: litD(10),
              fontFamily: lit("Segoe UI Semibold"),
              fontColor: solid("#0F1C24"),
              horizontalAlignment: lit("center"),
              verticalAlignment: lit("middle"),
            },
            selector: { id: "default" },
          },
          {
            properties: {
              show: lit(true),
              fontSize: litD(10),
              fontFamily: lit("Segoe UI Semibold"),
              fontColor: solid("#FFFFFF"),
              horizontalAlignment: lit("center"),
              verticalAlignment: lit("middle"),
            },
            selector: { id: "selected" },
          },
        ],
        shape: [
          {
            properties: { tileShape: lit("rectangleRounded") },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(0),
              bottom: litD(0),
              left: litD(0),
              right: litD(0),
            },
          },
        ],
      },
    },
  };
}

function dropdownSlicer(name, pos, entity, col, title, syncGroup) {
  const v = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: {
        queryState: {
          Values: { projections: [column(entity, col)] },
        },
      },
      objects: {
        data: [{ properties: { mode: lit("Dropdown") } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: litD(6),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(4),
              bottom: litD(4),
              left: litD(8),
              right: litD(8),
            },
          },
        ],
      },
    },
  };
  if (syncGroup) {
    const groupName =
      syncGroup === true || syncGroup === SYNC_PREFIX
        ? `${SYNC_PREFIX}_${col}`
        : String(syncGroup);
    v.visual.syncGroup = {
      groupName,
      fieldChanges: false,
      filterChanges: true,
    };
  }
  return v;
}

function classicCard(name, pos, entity, measureName, title, accent) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measure(entity, measureName)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(28),
              bold: lit(true),
              color: solid(accent),
            },
          },
        ],
        categoryLabels: [
          {
            properties: {
              show: lit(true),
              fontSize: litD(10),
              color: solid("#5A6B75"),
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [
          {
            properties: {
              show: lit(true),
              color: solid("#FFFFFF"),
              transparency: litD(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: litD(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(8),
              bottom: litD(8),
              left: litD(12),
              right: litD(12),
            },
          },
        ],
      },
    },
  };
}

/** Classic card bound to a column aggregation (profile drillthrough fields). */
function aggCard(name, pos, entity, col, title, accent, func = 1) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [aggColumn(entity, col, func)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(28),
              bold: lit(true),
              color: solid(accent),
            },
          },
        ],
        categoryLabels: [
          {
            properties: {
              show: lit(true),
              fontSize: litD(10),
              color: solid("#5A6B75"),
            },
          },
        ],
      },
      visualContainerObjects: {
        background: [
          {
            properties: {
              show: lit(true),
              color: solid("#FFFFFF"),
              transparency: litD(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: litD(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(8),
              bottom: litD(8),
              left: litD(12),
              right: litD(12),
            },
          },
        ],
      },
    },
  };
}

function lineChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("DimDate", "YearMonth")] },
          Y: { projections: [measure("FactEncounter", "Encounters")] },
        },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              showAxisTitle: lit(false),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
            },
          },
        ],
        dataPoint: [
          {
            properties: {
              defaultColor: solid("#2F5F73"),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function clusteredBar(name, pos, opts) {
  const {
    title,
    entity,
    categoryCol,
    measureEntity,
    measureName,
    sortDesc = true,
    gradient = true,
  } = opts;
  const sortField = {
    Measure: {
      Expression: { SourceRef: { Entity: measureEntity } },
      Property: measureName,
    },
  };
  const objects = {
    labels: [
      {
        properties: {
          show: lit(true),
          labelDisplayUnits: lit("0"),
          fontSize: litD(9),
          color: solid("#0F1C24"),
        },
      },
    ],
    valueAxis: [{ properties: { show: lit(false), gridlineShow: lit(false) } }],
    categoryAxis: [
      {
        properties: {
          show: lit(true),
          showAxisTitle: lit(false),
          labelColor: solid("#5A6B75"),
          fontSize: litD(9),
        },
      },
    ],
  };
  if (gradient) {
    objects.dataPoint = [
      {
        properties: {
          fill: {
            solid: {
              color: {
                expr: {
                  FillRule: {
                    Input: {
                      Measure: {
                        Expression: { SourceRef: { Entity: measureEntity } },
                        Property: measureName,
                      },
                    },
                    FillRule: {
                      linearGradient2: {
                        min: { color: { Literal: { Value: "'#D7E6EC'" } } },
                        max: { color: { Literal: { Value: "'#2F5F73'" } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];
  } else {
    objects.dataPoint = [{ properties: { fill: solid("#2F5F73") } }];
  }
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredBarChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, categoryCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: sortField,
              direction: sortDesc ? "Descending" : "Ascending",
            },
          ],
        },
      },
      objects,
      visualContainerObjects: cardChrome(title),
    },
  };
}

/**
 * Microsoft Sankey — Source → Destination with Pathway Weight.
 * Packaged from microsoft/powerbi-visuals-sankey 3.4.5.0 (MIT).
 */
function pathwaySankey(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: SANKEY_GUID,
      query: {
        queryState: {
          Source: {
            projections: [column("FactPathwayBridge", "Source")],
          },
          Destination: {
            projections: [column("FactPathwayBridge", "Target")],
          },
          Weight: {
            projections: [measure("FactPathwayBridge", "Pathway Weight")],
          },
        },
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Clinical heatmap: matrix AgeBand × DiagGroup × Readmit Rate (filterable via FactEncounter) */
function heatMatrix(name, pos, title) {
  const measureRef = "FactEncounter.Readmit Rate";
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: { projections: [column("FactEncounter", "AgeBand")] },
          Columns: { projections: [column("FactEncounter", "DiagGroup")] },
          Values: { projections: [measure("FactEncounter", "Readmit Rate")] },
        },
      },
      objects: {
        columnHeaders: [
          {
            properties: {
              columnAdjustment: lit("growToFit"),
              autoSizeColumnWidth: lit(true),
              fontSize: litD(9),
              fontColor: solid("#0F1C24"),
              backColor: solid("#F7FAFC"),
            },
          },
        ],
        rowHeaders: [
          {
            properties: {
              fontSize: litD(9),
              fontColor: solid("#0F1C24"),
            },
          },
        ],
        values: [
          {
            properties: {
              fontSize: litD(9),
              backColorPrimary: solid("#FFFFFF"),
              backColorSecondary: solid("#F7FAFC"),
            },
          },
          {
            properties: {
              backColor: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: {
                          SelectRef: { ExpressionName: measureRef },
                        },
                        FillRule: {
                          linearGradient2: {
                            min: { color: { Literal: { Value: "'#F7FAFC'" } } },
                            max: { color: { Literal: { Value: "'#B42318'" } } },
                            nullColoringStrategy: {
                              strategy: { Literal: { Value: "'noColor'" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            selector: {
              data: [{ dataViewWildcard: { matchingOption: 1 } }],
              metadata: measureRef,
            },
          },
        ],
      },
      visualContainerObjects: {
        ...cardChrome(title),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
  };
}

function riskQueue(name, pos, title) {
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
              column("FactEncounter", "EncounterID"),
              column("FactEncounter", "PatientID"),
              column("FactEncounter", "AgeBand"),
              column("FactEncounter", "DiagGroup"),
              column("FactEncounter", "DischargeGroup"),
              column("FactEncounter", "LengthOfStay"),
              column("FactEncounter", "ReadmitProbability"),
              column("FactEncounter", "RiskBand"),
              column("FactEncounter", "Readmit30"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "FactEncounter" } },
                  Property: "ReadmitProbability",
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      objects: {
        columnHeaders: [
          {
            properties: {
              columnAdjustment: lit("growToFit"),
              autoSizeColumnWidth: lit(true),
            },
          },
        ],
      },
      visualContainerObjects: {
        ...cardChrome(title),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
  };
}

function encounterDetailTable(name, pos, title) {
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
              column("FactEncounter", "EncounterID"),
              column("FactEncounter", "PatientID"),
              column("FactEncounter", "AdmissionDate"),
              column("FactEncounter", "AdmissionType"),
              column("FactEncounter", "DiagGroup"),
              column("FactEncounter", "DischargeGroup"),
              column("FactEncounter", "LengthOfStay"),
              column("FactEncounter", "Medications"),
              column("FactEncounter", "LabProcedures"),
              column("FactEncounter", "ReadmitProbability"),
              column("FactEncounter", "RiskBand"),
              column("FactEncounter", "Readmit30"),
              column("FactEncounter", "ReadmitOutcome"),
            ],
          },
        },
      },
      objects: {
        columnHeaders: [
          {
            properties: {
              columnAdjustment: lit("growToFit"),
              autoSizeColumnWidth: lit(true),
            },
          },
        ],
      },
      visualContainerObjects: {
        ...cardChrome(title),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
  };
}

function drillthroughExtras() {
  const filterEncounter = "Filter" + crypto.randomBytes(12).toString("hex");
  const filterPatient = "Filter" + crypto.randomBytes(12).toString("hex");
  return {
    visibility: "HiddenInViewMode",
    filterConfig: {
      filters: [
        {
          name: filterEncounter,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "FactEncounter" } },
              Property: "EncounterID",
            },
          },
          type: "Categorical",
          howCreated: "Drillthrough",
        },
        {
          name: filterPatient,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "FactEncounter" } },
              Property: "PatientID",
            },
          },
          type: "Categorical",
          howCreated: "Drillthrough",
        },
      ],
    },
    pageBinding: {
      name: "Pod",
      type: "Drillthrough",
      parameters: [
        {
          name: "Param_" + filterEncounter,
          boundFilter: filterEncounter,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "FactEncounter" } },
              Property: "EncounterID",
            },
          },
        },
        {
          name: "Param_" + filterPatient,
          boundFilter: filterPatient,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "FactEncounter" } },
              Property: "PatientID",
            },
          },
        },
      ],
    },
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function ensureSankeyCustomVisual() {
  const pbivizFile = path.join(SANKEY_SRC, `${SANKEY_GUID}.3.4.5.0.pbiviz`);
  const pkg = path.join(SANKEY_SRC, "package.json");
  const res = path.join(SANKEY_SRC, "resources", `${SANKEY_GUID}.pbiviz.json`);
  const dest = path.join(REPORT, "CustomVisuals", SANKEY_GUID);
  const destPkg = path.join(dest, "package.json");
  const hasSource = fs.existsSync(pbivizFile) || (fs.existsSync(pkg) && fs.existsSync(res));
  if (!hasSource) {
    if (fs.existsSync(destPkg)) return; // keep Desktop-saved / previously embedded package
    throw new Error(
      `Microsoft Sankey package missing under ${SANKEY_SRC}. Run: cd _tmp/powerbi-visuals-sankey && npx pbiviz package`
    );
  }
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(REPORT, "CustomVisuals"), { recursive: true });

  if (fs.existsSync(pbivizFile)) {
    // .pbiviz is a zip — extract as CustomVisuals/<guid>/
    const tmpZip = path.join(root, "_tmp", `${SANKEY_GUID}.zip`);
    fs.copyFileSync(pbivizFile, tmpZip);
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${tmpZip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" }
    );
  } else {
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(pkg, path.join(dest, "package.json"));
    copyDir(path.join(SANKEY_SRC, "resources"), path.join(dest, "resources"));
  }
  if (!fs.existsSync(destPkg)) {
    throw new Error(`Sankey CustomVisuals extract failed at ${dest}`);
  }
}

function ensureReportTheme() {
  ensureSankeyCustomVisual();
  const reportPath = path.join(REPORT, "definition", "report.json");
  if (!fs.existsSync(reportPath)) return;
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const reportVersionAtImport = { visual: "1.8.92", report: "2.0.84", page: "1.3.40" };
  report.themeCollection = {
    baseTheme: { name: "CY25SU06", reportVersionAtImport, type: "SharedResources" },
    customTheme: { name: themeFileName, reportVersionAtImport, type: "RegisteredResources" },
  };
  report.publicCustomVisuals = [SANKEY_GUID];
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

// --- Build ---
const PAGES = resolvePages();
ensureReportTheme();

fs.writeFileSync(
  path.join(REPORT, "definition/pages/pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [PAGES.pulse, PAGES.pathways, PAGES.queue, PAGES.context, PAGES.profile],
      activePageName: PAGES.pulse,
    },
    null,
    2
  )
);

// --- Page 1: Care Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Care Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Care Pulse — Utilization and 30-day readmission",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Encounter volume, length of stay, and high-risk discharge KPIs.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { ...SL.a, z: z++, tabOrder: 2 },
      "FactEncounter",
      "RiskBand",
      "Risk band",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { ...SL.b, z: z++, tabOrder: 3 },
      "FactEncounter",
      "AgeBand",
      "Age band",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { ...SL.c, z: z++, tabOrder: 4 },
      "FactEncounter",
      "AdmissionType",
      "Admission type",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    classicCard(
      id(),
      { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 },
      "FactEncounter",
      "Readmit Rate",
      "Readmit rate",
      ACCENTS.readmit
    ),
    classicCard(
      id(),
      { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 },
      "FactEncounter",
      "Encounters",
      "Encounters",
      ACCENTS.encounters
    ),
    classicCard(
      id(),
      { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 8 },
      "FactEncounter",
      "Avg Length of Stay",
      "Avg length of stay",
      ACCENTS.los
    ),
    classicCard(
      id(),
      { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 9 },
      "FactEncounter",
      "High Risk Discharges",
      "High risk discharges",
      ACCENTS.highRisk
    ),
    lineChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 920, tabOrder: 10 },
      "Monthly encounter volume"
    ),
    clusteredBar(id(), { x: 976, y: 276, z: z++, height: 736, width: 912, tabOrder: 11 }, {
      title: "Readmit rate by diagnosis group",
      entity: "FactEncounter",
      categoryCol: "DiagGroup",
      measureEntity: "FactEncounter",
      measureName: "Readmit Rate",
    }),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 12 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Pathways & Drivers ---
{
  const p = PAGES.pathways;
  pageChrome(p, "Pathways & Drivers");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Pathways & Drivers — Flow and clinical heat",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1000, tabOrder: 1 }, [
      {
        text: "Admission→disposition pathway weights, age × diagnosis readmit heat, and disposition risk.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { ...SL.b, z: z++, tabOrder: 2 },
      "FactEncounter",
      "AgeBand",
      "Age band",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { ...SL.c, z: z++, tabOrder: 3 },
      "FactEncounter",
      "Gender",
      "Gender",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    pathwaySankey(
      id(),
      { x: 32, y: 112, z: z++, height: 440, width: 920, tabOrder: 5 },
      "Care pathway — admission → disposition"
    ),
    heatMatrix(
      id(),
      { x: 976, y: 112, z: z++, height: 440, width: 912, tabOrder: 6 },
      "Readmit heat — age band × diagnosis group"
    ),
    clusteredBar(id(), { x: 32, y: 576, z: z++, height: 436, width: 1856, tabOrder: 7 }, {
      title: "Readmit rate by discharge group",
      entity: "FactEncounter",
      categoryCol: "DischargeGroup",
      measureEntity: "FactEncounter",
      measureName: "Readmit Rate",
    }),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: Discharge Risk Queue ---
{
  const p = PAGES.queue;
  pageChrome(p, "Discharge Risk Queue");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Discharge Risk Queue — High-propensity encounters",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1000, tabOrder: 1 }, [
      {
        text: "Ranked by readmit probability. Drill through a row to Encounter Profile.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { ...SL.a, z: z++, tabOrder: 2 },
      "FactEncounter",
      "RiskBand",
      "Risk band",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { ...SL.b, z: z++, tabOrder: 3 },
      "FactEncounter",
      "AgeBand",
      "Age band",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { ...SL.c, z: z++, tabOrder: 4 },
      "FactEncounter",
      "DischargeGroup",
      "Discharge group",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    classicCard(
      id(),
      { x: 32, y: 112, z: z++, height: 120, width: 600, tabOrder: 6 },
      "FactEncounter",
      "High Risk Discharges",
      "High risk discharges",
      ACCENTS.highRisk
    ),
    classicCard(
      id(),
      { x: 656, y: 112, z: z++, height: 120, width: 600, tabOrder: 7 },
      "FactEncounter",
      "Avg Readmit Probability",
      "Avg readmit probability",
      ACCENTS.probability
    ),
    classicCard(
      id(),
      { x: 1280, y: 112, z: z++, height: 120, width: 608, tabOrder: 8 },
      "FactEncounter",
      "Readmit Rate",
      "Readmit rate",
      ACCENTS.readmit
    ),
    riskQueue(
      id(),
      { x: 32, y: 256, z: z++, height: 756, width: 1856, tabOrder: 9 },
      "Risk queue — sorted by readmit probability"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 4: Context (last visible) ---
{
  const p = PAGES.context;
  pageChrome(p, "Context");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Context — How to read Care Pulse",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Short framing for demos — Care Pulse stays the landing page; this is reference, not the open.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 32, y: 120, z: z++, height: 120, width: 1856, tabOrder: 3 }, [
      {
        text: "Audience",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "Hospital CMO / quality & utilization lead. Use Care Pulse for portfolio health, Pathways for flow and heat, Discharge Risk Queue for intervention lists.",
        size: "12pt",
        color: "#0F1C24",
      },
    ]),
    textbox(id(), { x: 32, y: 260, z: z++, height: 220, width: 900, tabOrder: 4 }, [
      {
        text: "Questions this report answers",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      { text: "• What is our 30-day readmit rate, volume, and LOS?", size: "12pt" },
      { text: "• Where do admission→disposition pathways concentrate?", size: "12pt" },
      { text: "• Which age × diagnosis cells run hot on readmit?", size: "12pt" },
      { text: "• Which discharges rank highest on readmit propensity?", size: "12pt" },
    ]),
    textbox(id(), { x: 976, y: 260, z: z++, height: 220, width: 912, tabOrder: 5 }, [
      {
        text: "How to read the Sankey",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "Left = admission type. Right = discharge disposition.",
        size: "12pt",
      },
      {
        text: "Link width = encounter volume (Pathway Weight).",
        size: "12pt",
      },
      {
        text: "This is flow volume — not causality or predicted risk.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 520, z: z++, height: 280, width: 1856, tabOrder: 6 }, [
      {
        text: "Data & model caveats",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "• Source: UCI Diabetes 130-US Hospitals (de-identified) — ~35k encounter sample for Desktop demos.",
        size: "12pt",
      },
      {
        text: "• ReadmitProbability / RiskBand: local sample logistic model — portfolio analytics, not clinical decision support.",
        size: "12pt",
      },
      {
        text: "• Heat uses FactEncounter readmit rate (filterable). Pathway bridge is admission→disposition only.",
        size: "12pt",
      },
      {
        text: "• Encounter Profile is a hidden drillthrough target from the risk queue.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 840, z: z++, height: 60, width: 1856, tabOrder: 7 }, [
      {
        text: "Suggested walkthrough: Care Pulse → Pathways & Drivers (Sankey + heat) → Discharge Risk Queue → (optional) Context.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 5: Encounter Profile (hidden drillthrough) ---
{
  const p = PAGES.profile;
  pageChrome(p, "Encounter Profile", drillthroughExtras());
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Encounter Profile",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Drillthrough target — clinical detail for one encounter (and patient context).",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    aggCard(
      id(),
      { x: 32, y: 100, z: z++, height: 120, width: 448, tabOrder: 2 },
      "FactEncounter",
      "LengthOfStay",
      "Length of stay",
      ACCENTS.los
    ),
    aggCard(
      id(),
      { x: 504, y: 100, z: z++, height: 120, width: 448, tabOrder: 3 },
      "FactEncounter",
      "ReadmitProbability",
      "Readmit probability",
      ACCENTS.probability
    ),
    aggCard(
      id(),
      { x: 976, y: 100, z: z++, height: 120, width: 448, tabOrder: 4 },
      "FactEncounter",
      "Medications",
      "Medications",
      ACCENTS.meds
    ),
    aggCard(
      id(),
      { x: 1448, y: 100, z: z++, height: 120, width: 440, tabOrder: 5 },
      "FactEncounter",
      "LabProcedures",
      "Lab procedures",
      ACCENTS.labs
    ),
    textbox(id(), { x: 32, y: 240, z: z++, height: 48, width: 1856, tabOrder: 6 }, [
      {
        text: "Note: Propensity scores are from a sample local model on de-identified UCI data — not clinical decision support.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    encounterDetailTable(
      id(),
      { x: 32, y: 304, z: z++, height: 700, width: 1856, tabOrder: 7 },
      "Encounter detail"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pages: {
        pulse: PAGES.pulse,
        pathways: PAGES.pathways,
        queue: PAGES.queue,
        context: PAGES.context,
        profile: PAGES.profile,
      },
      syncGroup: "CareSync_<column>",
      sankey: SANKEY_GUID,
      pathwayVisual: "Microsoft Sankey (FactPathwayBridge Source → Target × Pathway Weight)",
      heatVisual: "pivotTable (FactEncounter AgeBand × DiagGroup × Readmit Rate)",
      profile: "HiddenInViewMode + drillthrough EncounterID + PatientID",
      report: REPORT,
    },
    null,
    2
  )
);

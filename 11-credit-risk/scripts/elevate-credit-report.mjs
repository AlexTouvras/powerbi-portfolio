/**
 * Elevate Credit Risk report — Nordic Boardroom polish across 6 pages.
 * Reads page IDs dynamically from pages.json (do not hardcode ReportSection IDs).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  ensureLandingAtmosphere,
  pageBackgroundWithAtmosphere,
} from "../../_shared/scripts/ensure-landing-atmosphere.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REPORT = path.join(root, "CreditRisk.Report");

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const T = "DimApplication";
const FOOTER =
  "Source: Home Credit Default Risk (sample) · Local PBIP · Nordic Boardroom · PD = LightGBM + Platt sample scorecard — not production IRB";
/** Six visible pages (Landing + 4 analysis + Context) — slicers end before NAV. */
const NAV = { x: 1280, y: 12, height: 80, width: 608 };
const SL = {
  a: { x: 720, y: 12, height: 80, width: 168 },
  b: { x: 900, y: 12, height: 80, width: 168 },
  c: { x: 1080, y: 12, height: 80, width: 176 },
};

const ACCENTS = {
  applications: "#2F5F73",
  defaultRate: "#B42318",
  avgPD: "#C17B3A",
  elRate: "#B42318",
  maxPsi: "#B42318",
  breach: "#B42318",
  highRisk: "#A67C52",
  gini: "#2F5F73",
  auc: "#1B7A4E",
  ks: "#5B8FA3",
};

function id() {
  return crypto.randomBytes(10).toString("hex");
}
function lit(v) {
  if (typeof v === "boolean") return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number" && Number.isInteger(v)) return { expr: { Literal: { Value: `${v}L` } } };
  if (typeof v === "number") return { expr: { Literal: { Value: `${v}D` } } };
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
/** Average-aggregation projection for tables without a defined measure (FactCalibration). */
function avgColumn(entity, name) {
  return {
    field: {
      Aggregation: {
        Expression: {
          Column: {
            Expression: { SourceRef: { Entity: entity } },
            Property: name,
          },
        },
        Function: 1,
      },
    },
    queryRef: `Avg(${entity}.${name})`,
    nativeQueryRef: `Average of ${name}`,
  };
}

function sortByColumnField(entity, name, direction = "Ascending") {
  return {
    field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: name } },
    direction,
  };
}
function sortByMeasureField(entity, name, direction = "Descending") {
  return {
    field: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: name } },
    direction,
  };
}

/** Scope-identity dataPoint color override for one value of a Series/category grouping column. */
function scopeColor(entity, colName, value, hex) {
  return {
    properties: { fill: solid(hex) },
    selector: {
      data: [
        {
          scopeId: {
            Comparison: {
              ComparisonKind: 0,
              Left: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: colName } },
              Right: { Literal: { Value: `'${value}'` } },
            },
          },
        },
      ],
    },
  };
}

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  if (!fs.existsSync(pagesPath)) {
    throw new Error(`Missing ${pagesPath} — run scaffold-credit-pbip.mjs first`);
  }
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pj = JSON.parse(
      fs.readFileSync(path.join(REPORT, "definition/pages", pageKey, "page.json"), "utf8")
    );
    byDisplay[pj.displayName] = pageKey;
  }

  const required = [
    "Landing",
    "Portfolio Risk Pulse",
    "Scorecard & Validation",
    "Cut-off Strategy",
    "Monitoring & Steering",
    "Context",
    "Application Profile",
  ];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  return {
    landing: byDisplay["Landing"],
    pulse: byDisplay["Portfolio Risk Pulse"],
    scorecard: byDisplay["Scorecard & Validation"],
    cutoff: byDisplay["Cut-off Strategy"],
    monitoring: byDisplay["Monitoring & Steering"],
    context: byDisplay["Context"],
    profile: byDisplay["Application Profile"],
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
    background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } }],
    border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
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
    padding: [{ properties: { top: litD(8), bottom: litD(8), left: litD(12), right: litD(12) } }],
  };
}

function pageChrome(pageKey, displayName, extras = {}, outspaceWidth = 200) {
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
            width: { expr: { Literal: { Value: `${outspaceWidth}D` } } },
            backgroundColor: { solid: { color: { expr: { Literal: { Value: "'#FFFFFF'" } } } } },
            foregroundColor: { solid: { color: { expr: { Literal: { Value: "'#0F1C24'" } } } } },
            border: { expr: { Literal: { Value: "true" } } },
            borderColor: { solid: { color: { expr: { Literal: { Value: "'#E8EEF2'" } } } } },
            checkboxAndApplyColor: { solid: { color: { expr: { Literal: { Value: "'#2F5F73'" } } } } },
            inputBoxColor: { solid: { color: { expr: { Literal: { Value: "'#FFFFFF'" } } } } },
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

const LANDING_ATMOSPHERE = "coastal-fog"; // ledger-mist not in enum yet; coastal-fog is banking-adjacent

function landingChrome(pageKey) {
  ensureLandingAtmosphere(REPORT, LANDING_ATMOSPHERE);
  const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
  fs.writeFileSync(
    pagePath,
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: pageKey,
        displayName: "Landing",
        displayOption: "FitToPage",
        height: 1080,
        width: 1920,
        objects: {
          background: pageBackgroundWithAtmosphere("#F7FAFC", 22, LANDING_ATMOSPHERE),
          outspacePane: [{ properties: { width: { expr: { Literal: { Value: "0D" } } } } }],
        },
      },
      null,
      2
    )
  );
}

function editorialHero(name, pos, entity, measureName, accent, caption) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measure(entity, measureName)] } } },
      objects: {
        labels: [{ properties: { fontSize: litD(64), bold: lit(true), color: solid(accent) } }],
        categoryLabels: [{ properties: { show: lit(false) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(18) } }],
        border: [{ properties: { show: lit(false) } }],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(caption),
              fontSize: litD(12),
              fontColor: solid("#5A6B75"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(16), bottom: litD(16), left: litD(20), right: litD(20) } }],
      },
    },
  };
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
        padding: [{ properties: { top: litD(0), bottom: litD(0), left: litD(0), right: litD(0) } }],
        visualHeader: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

function shapeRect(name, pos, fillHex) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "shape",
      objects: {
        shape: [{ properties: { tileShape: lit("rectangle") } }],
        fill: [{ properties: { fillColor: solid(fillHex), transparency: litD(0) }, selector: { id: "default" } }],
        outline: [{ properties: { show: lit(false) }, selector: { id: "default" } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(0), bottom: litD(0), left: litD(0), right: litD(0) } }],
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
          { properties: { show: lit(true), fillColor: solid("#FFFFFF"), transparency: litD(0) }, selector: { id: "default" } },
          { properties: { show: lit(true), fillColor: solid("#2F5F73"), transparency: litD(0) }, selector: { id: "selected" } },
          { properties: { show: lit(true), fillColor: solid("#D7E6EC"), transparency: litD(0) }, selector: { id: "hover" } },
        ],
        outline: [
          { properties: { show: lit(true), weight: litD(1), lineColor: solid("#C5CED4") }, selector: { id: "default" } },
          { properties: { show: lit(true), weight: litD(1), lineColor: solid("#2F5F73") }, selector: { id: "selected" } },
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
        shape: [{ properties: { tileShape: lit("rectangleRounded") }, selector: { id: "default" } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(0), bottom: litD(0), left: litD(0), right: litD(0) } }],
      },
    },
  };
}

function slicer(name, pos, entity, col, title, syncGroup) {
  const v = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: { queryState: { Values: { projections: [column(entity, col)] } } },
      objects: { data: [{ properties: { mode: lit("Dropdown") } }] },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(6) } }],
        title: [{ properties: { show: lit(true), text: lit(title), fontSize: litD(10), fontColor: solid("#5A6B75") } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(4), bottom: litD(4), left: litD(8), right: litD(8) } }],
      },
    },
  };
  if (syncGroup) {
    v.visual.syncGroup = { groupName: `${syncGroup}_${col}`, fieldChanges: false, filterChanges: true };
  }
  return v;
}

function kpiCard(name, pos, entity, measureName, title, accent) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measure(entity, measureName)] } } },
      objects: {
        labels: [{ properties: { fontSize: litD(28), bold: lit(true), color: solid(accent) } }],
        // Hide category label — same text as container title (otherwise title appears twice)
        categoryLabels: [{ properties: { show: lit(false) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
        title: [{ properties: { show: lit(true), text: lit(title), fontSize: litD(10), fontColor: solid("#5A6B75") } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(8), bottom: litD(8), left: litD(12), right: litD(12) } }],
      },
    },
  };
}

/** Horizontal bar (barChart) — Category on Y-axis, single measure on X. */
function barChart(name, pos, entity, catCol, measureName, title, hue, tint, sort) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, catCol)] },
          Y: { projections: [measure(entity, measureName)] },
        },
        sortDefinition: { sort: [sort || sortByMeasureField(entity, measureName, "Descending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(true), labelDisplayUnits: lit("0"), fontSize: litD(9), color: solid("#0F1C24") } }],
        valueAxis: [{ properties: { show: lit(false), gridlineShow: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [
          {
            properties: {
              fill: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: measureName } },
                        FillRule: {
                          linearGradient2: {
                            min: { color: { Literal: { Value: `'${tint}'` } } },
                            max: { color: { Literal: { Value: `'${hue}'` } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function donutChart(name, pos, entity, catCol, measureName, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "donutChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, catCol)] },
          Y: { projections: [measure(entity, measureName)] },
        },
        sortDefinition: { sort: [sortByMeasureField(entity, measureName, "Descending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(true), fontSize: litD(9), color: solid("#0F1C24") } }],
        legend: [{ properties: { show: lit(true), position: lit("Right"), fontSize: litD(9) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Calibration line chart: DecileLabel category (sorted by Decile), Metric series, Calibration Rate measure. */
function calibrationLineChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactCalibrationLong", "DecileLabel")] },
          Series: { projections: [column("FactCalibrationLong", "Metric")] },
          Y: { projections: [measure("FactCalibrationLong", "Calibration Rate")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactCalibrationLong", "Decile", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        dataPoint: [
          scopeColor("FactCalibrationLong", "Metric", "Predicted PD", "#2F5F73"),
          scopeColor("FactCalibrationLong", "Metric", "Realized default rate", "#C17B3A"),
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Guide-style cut-off frontier: approval rate (x) vs bad rate (y), new vs existing score + budget. */
function loadCutoffMarkers() {
  const policyPath = path.join(root, "data/gold/FactCutoffPolicy.csv");
  const text = fs.readFileSync(policyPath, "utf8").trim().split(/\r?\n/);
  const headers = text[0].split(",");
  const rows = text.slice(1).map((line) => {
    const cols = line.split(",");
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cols[i];
    });
    return o;
  });
  const operating = rows.find((r) => r.IsOperating === "1") || rows[0];
  const youden = rows.find((r) => String(r.Method || "").includes("Youden")) || rows[1];
  return {
    operatingApproval: Number(operating.OotApprovalRate),
    youdenApproval: Number(youden.OotApprovalRate),
    budgeted: Number(operating.BudgetedBadRate),
  };
}

function axisRefLine(id, value, name, color, style = "dashed") {
  return {
    properties: {
      show: lit(true),
      value: litD(value),
      displayName: lit(name),
      lineColor: solid(color),
      style: lit(style),
      width: litD(2.25),
      transparency: litD(0),
      position: lit("front"),
      dataLabelShow: lit(true),
      dataLabelText: lit("Name"),
      dataLabelColor: solid(color),
      dataLabelHorizontalPosition: lit("right"),
      dataLabelVerticalPosition: lit("above"),
    },
    selector: { id },
  };
}

function seriesLineStyle(scorecard, props) {
  return {
    properties: props,
    selector: {
      data: [
        {
          scopeId: {
            Comparison: {
              ComparisonKind: 0,
              Left: { Column: { Expression: { SourceRef: { Entity: "FactCutoffLong" } }, Property: "Scorecard" } },
              Right: { Literal: { Value: `'${scorecard}'` } },
            },
          },
        },
      ],
    },
  };
}

function cutoffLineChart(name, pos, title) {
  const markers = loadCutoffMarkers();
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactCutoffLong", "ApprovalRate")] },
          Series: { projections: [column("FactCutoffLong", "Scorecard")] },
          Y: { projections: [measure("FactCutoffLong", "Frontier Bad Rate")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactCutoffLong", "ApprovalRate", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              start: litD(0),
              gridlineShow: lit(true),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              showAxisTitle: lit(true),
              titleText: lit("Cumulative bad rate"),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              axisType: lit("Scalar"),
              start: litD(0),
              end: litD(1),
              showAxisTitle: lit(true),
              titleText: lit("Cumulative approval rate"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
            },
          },
        ],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        lineStyles: [
          { properties: { strokeWidth: litD(2.5), showMarker: lit(false) } },
          seriesLineStyle("Existing score (EXT_MEAN)", { strokeWidth: litD(2.25), showMarker: lit(false) }),
          seriesLineStyle("New scorecard", { strokeWidth: litD(2.75), showMarker: lit(false) }),
          seriesLineStyle("Budget", { strokeWidth: litD(2), lineStyle: lit("dashed"), showMarker: lit(false) }),
        ],
        dataPoint: [
          scopeColor("FactCutoffLong", "Scorecard", "Existing score (EXT_MEAN)", "#B42318"),
          scopeColor("FactCutoffLong", "Scorecard", "New scorecard", "#1A1A1A"),
          scopeColor("FactCutoffLong", "Scorecard", "Budget", "#6B4C9A"),
        ],
        // Strategy markers at operating / Youden approval (x); budget also as series
        xAxisReferenceLine: [
          axisRefLine("operating", markers.operatingApproval, "Operating cut-off", "#2F5F73", "solid"),
          axisRefLine("youden", markers.youdenApproval, "Youden / max KS", "#C17B3A", "dashed"),
        ],
        y1AxisReferenceLine: [axisRefLine("budgeted", markers.budgeted, "Budget", "#6B4C9A", "dashed")],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Guide-style ROC: continuous FPR (scalar), TPR, Train/Test/OOT + Random diagonal + Youden marker. */
function rocLineChart(name, pos, title) {
  function seriesLineStyle(sample, props) {
    return {
      properties: props,
      selector: {
        data: [
          {
            scopeId: {
              Comparison: {
                ComparisonKind: 0,
                Left: { Column: { Expression: { SourceRef: { Entity: "FactRocCurve" } }, Property: "Sample" } },
                Right: { Literal: { Value: `'${sample}'` } },
              },
            },
          },
        ],
      },
    };
  }
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactRocCurve", "FPR")] },
          Series: { projections: [column("FactRocCurve", "Sample")] },
          Y: { projections: [measure("FactRocCurve", "True Positive Rate")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactRocCurve", "FPR", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              start: litD(0),
              end: litD(1),
              gridlineShow: lit(true),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              labelPrecision: lit(0),
              showAxisTitle: lit(true),
              titleText: lit("True positive rate"),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              axisType: lit("Scalar"),
              start: litD(0),
              end: litD(1),
              showAxisTitle: lit(true),
              titleText: lit("False positive rate"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              labelPrecision: lit(0),
              gridlineShow: lit(true),
            },
          },
        ],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        lineStyles: [
          { properties: { strokeWidth: litD(2), showMarker: lit(false), lineChartType: lit("smooth") } },
          seriesLineStyle("Train", { strokeWidth: litD(2.5), strokeColor: solid("#2F5F73"), showMarker: lit(false) }),
          seriesLineStyle("Test", { strokeWidth: litD(2.5), strokeColor: solid("#1B7A4E"), showMarker: lit(false) }),
          seriesLineStyle("OOT", { strokeWidth: litD(2.5), strokeColor: solid("#C17B3A"), showMarker: lit(false) }),
          seriesLineStyle("Random", {
            strokeWidth: litD(1.5),
            strokeColor: solid("#9AA8B0"),
            lineStyle: lit("dashed"),
            showMarker: lit(false),
          }),
          seriesLineStyle("Youden", {
            strokeShow: lit(false),
            showMarker: lit(true),
            markerShape: lit("circle"),
            markerSize: litD(14),
            markerColor: solid("#B42318"),
          }),
        ],
        dataPoint: [
          scopeColor("FactRocCurve", "Sample", "Train", "#2F5F73"),
          scopeColor("FactRocCurve", "Sample", "Test", "#1B7A4E"),
          scopeColor("FactRocCurve", "Sample", "OOT", "#C17B3A"),
          scopeColor("FactRocCurve", "Sample", "Random", "#9AA8B0"),
          scopeColor("FactRocCurve", "Sample", "Youden", "#B42318"),
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Train / Test / OOT Gini clustered column. */
function giniCompareColumnChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredColumnChart",
      query: {
        queryState: {
          Category: { projections: [column("FactGiniCompare", "Sample")] },
          Y: { projections: [measure("FactGiniCompare", "Sample Gini")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactGiniCompare", "SampleSort", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(true), fontSize: litD(10) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(10) } }],
        dataPoint: [{ properties: { fill: solid("#2F5F73") } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** PD density: Good vs Bad over PD bins. */
function pdDistributionLineChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactPdDistribution", "PdBinLabel")] },
          Series: { projections: [column("FactPdDistribution", "Class")] },
          Y: { projections: [measure("FactPdDistribution", "PD Density")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactPdDistribution", "PdBinSort", "Ascending")] },
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
              showAxisTitle: lit(true),
              titleText: lit("Density"),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(true),
              titleText: lit("Predicted PD"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
            },
          },
        ],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        dataPoint: [
          scopeColor("FactPdDistribution", "Class", "Good (non-default)", "#2F5F73"),
          scopeColor("FactPdDistribution", "Class", "Bad (default)", "#B42318"),
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** New business: scorecard PD vs realized default by origination month. */
function newBusinessLineChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactNewBusinessLong", "OriginationMonth")] },
          Series: { projections: [column("FactNewBusinessLong", "Metric")] },
          Y: { projections: [measure("FactNewBusinessLong", "New Business Rate")] },
        },
        sortDefinition: { sort: [sortByColumnField("FactNewBusinessLong", "MonthSort", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(8) } }],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        lineStyles: [
          { properties: { strokeWidth: litD(2.5), showMarker: lit(false) } },
          {
            properties: { strokeWidth: litD(2.5), lineStyle: lit("dotted"), showMarker: lit(false) },
            selector: {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: { Column: { Expression: { SourceRef: { Entity: "FactNewBusinessLong" } }, Property: "Metric" } },
                      Right: { Literal: { Value: "'Scorecard PD'" } },
                    },
                  },
                },
              ],
            },
          },
          {
            properties: { strokeWidth: litD(2.75), lineStyle: lit("solid"), showMarker: lit(false) },
            selector: {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: { Column: { Expression: { SourceRef: { Entity: "FactNewBusinessLong" } }, Property: "Metric" } },
                      Right: { Literal: { Value: "'Realized default rate'" } },
                    },
                  },
                },
              ],
            },
          },
        ],
        dataPoint: [
          scopeColor("FactNewBusinessLong", "Metric", "Scorecard PD", "#2F5F73"),
          scopeColor("FactNewBusinessLong", "Metric", "Realized default rate", "#C17B3A"),
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Vintage curve line chart: MOB on category, Series = VintageMonth, filtered to the most recent cohorts. */
function vintageLineChart(name, pos, title, vintageMonths) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    filterConfig: {
      filters: [
        {
          name: "Filter" + crypto.randomBytes(12).toString("hex"),
          field: { Column: { Expression: { SourceRef: { Entity: "FactVintage" } }, Property: "VintageMonth" } },
          type: "Categorical",
          filter: {
            Version: 2,
            From: [{ Name: "f", Entity: "FactVintage", Type: 0 }],
            Where: [
              {
                Condition: {
                  In: {
                    Expressions: [{ Column: { Expression: { SourceRef: { Source: "f" } }, Property: "VintageMonth" } }],
                    Values: vintageMonths.map((m) => [{ Literal: { Value: `'${m}'` } }]),
                  },
                },
              },
            ],
          },
          howCreated: "User",
        },
      ],
    },
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactVintage", "MOB")] },
          Series: { projections: [column("FactVintage", "VintageMonth")] },
          Y: { projections: [avgColumn("FactVintage", "DefaultRate")] },
        },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(true), titleText: lit("Month on book"), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        legend: [{ properties: { show: lit(true), position: lit("Right"), fontSize: litD(9) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function scorecardTable(name, pos, title) {
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
              column("DimScorecard", "Feature"),
              column("DimScorecard", "Bin"),
              column("DimScorecard", "WoE"),
              column("DimScorecard", "IV"),
              column("DimScorecard", "Points"),
            ],
          },
        },
        sortDefinition: { sort: [sortByColumnField("DimScorecard", "IV", "Descending")] },
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function riskByBandColumnChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "columnChart",
      query: {
        queryState: {
          Category: { projections: [column(T, "RiskBand")] },
          Y: { projections: [measure(T, "Avg PD")] },
        },
        sortDefinition: { sort: [sortByMeasureField(T, "Avg PD", "Descending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(true), labelDisplayUnits: lit("0"), fontSize: litD(9), color: solid("#0F1C24") } }],
        valueAxis: [{ properties: { show: lit(false), gridlineShow: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [{ properties: { defaultColor: solid("#B42318") } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function steeringQueueTable(name, pos, title) {
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
              column(T, "SK_ID_CURR"),
              column(T, "Grade"),
              column(T, "PD"),
              column(T, "EL"),
              column(T, "RiskBand"),
              column(T, "Decision"),
              column(T, "RecommendedAction"),
              column(T, "NAME_INCOME_TYPE"),
            ],
          },
        },
        sortDefinition: { sort: [sortByColumnField(T, "RiskRank", "Ascending")] },
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Cut-off methods: risk–reward (operating) vs Youden reference — from optimal cut-off guidelines. */
function cutoffPolicyTable(name, pos, title) {
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
              column("FactCutoffPolicy", "Method"),
              column("FactCutoffPolicy", "Role"),
              column("FactCutoffPolicy", "OperatingCutoffPD"),
              column("FactCutoffPolicy", "OperatingCutoffScore"),
              column("FactCutoffPolicy", "OotApprovalRate"),
              column("FactCutoffPolicy", "OotBadRateApproved"),
              column("FactCutoffPolicy", "BudgetedBadRate"),
            ],
          },
        },
        sortDefinition: { sort: [sortByColumnField("FactCutoffPolicy", "MethodSort", "Ascending")] },
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function profileDetailTable(name, pos, title) {
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
              column(T, "SK_ID_CURR"),
              column(T, "application_date"),
              column(T, "NAME_CONTRACT_TYPE"),
              column(T, "NAME_INCOME_TYPE"),
              column(T, "NAME_EDUCATION_TYPE"),
              column(T, "AMT_INCOME_TOTAL"),
              column(T, "AMT_CREDIT"),
              column(T, "Score"),
              column(T, "Grade"),
              column(T, "PD"),
              column(T, "LGD"),
              column(T, "EL"),
              column(T, "RiskBand"),
              column(T, "Stage"),
              column(T, "RecommendedAction"),
            ],
          },
        },
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Drillthrough target extras for the hidden Application Profile page (single-field SK_ID_CURR filter). */
function drillthroughExtras() {
  const filterId = "Filter" + crypto.randomBytes(12).toString("hex");
  return {
    visibility: "HiddenInViewMode",
    filterConfig: {
      filters: [
        {
          name: filterId,
          field: { Column: { Expression: { SourceRef: { Entity: T } }, Property: "SK_ID_CURR" } },
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
          name: "Param_" + filterId,
          boundFilter: filterId,
          fieldExpr: { Column: { Expression: { SourceRef: { Entity: T } }, Property: "SK_ID_CURR" } },
        },
      ],
    },
  };
}

// --- Build ---
const PAGES = resolvePages();

fs.writeFileSync(
  path.join(REPORT, "definition/pages/pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [
        PAGES.landing,
        PAGES.pulse,
        PAGES.scorecard,
        PAGES.cutoff,
        PAGES.monitoring,
        PAGES.context,
        PAGES.profile,
      ],
      activePageName: PAGES.landing,
    },
    null,
    2
  )
);

// --- Page 0: Landing (poster cover) ---
{
  const p = PAGES.landing;
  landingChrome(p);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    shapeRect(id(), { x: 0, y: 0, z: z++, height: 1080, width: 14, tabOrder: 0 }, "#2F5F73"),
    shapeRect(id(), { x: 48, y: 140, z: z++, height: 820, width: 1180, tabOrder: 1 }, "#FFFFFF"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 88, y: 180, z: z++, height: 80, width: 1080, tabOrder: 3 }, [
      { text: "Credit Risk Pulse", size: "40pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 88, y: 268, z: z++, height: 56, width: 1080, tabOrder: 4 }, [
      {
        text: "A PD scorecard and steering view — grade migration, validation, and a ranked action queue in one book.",
        size: "16pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 88, y: 340, z: z++, height: 4, width: 280, tabOrder: 5 }, "#C17B3A"),
    editorialHero(
      id(),
      { x: 88, y: 380, z: z++, height: 240, width: 520, tabOrder: 6 },
      "ModelMetrics",
      "OOT Gini",
      ACCENTS.gini,
      "Champion model — OOT Gini"
    ),
    textbox(id(), { x: 640, y: 400, z: z++, height: 200, width: 520, tabOrder: 7 }, [
      { text: "What you’ll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  Portfolio Risk Pulse — grade mix and loss rate", size: "13pt" },
      { text: "02  Scorecard & Validation — Train/Test/OOT Gini, ROC, PD density, calibration", size: "13pt" },
      { text: "03  Cut-off Strategy — approval vs expected default and operating policy", size: "13pt" },
      { text: "04  Monitoring & Steering — new-business PD vs realized, PSI, queue", size: "13pt" },
      { text: "05  Context — facts and model caveats", size: "13pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 88, y: 660, z: z++, height: 40, width: 1080, tabOrder: 8 }, [
      { text: "Audience · CRO / credit risk / model monitoring", size: "13pt", color: "#0F1C24" },
    ]),
    textbox(id(), { x: 88, y: 720, z: z++, height: 80, width: 1080, tabOrder: 9 }, [
      {
        text: "Signature · Grade-level scorecard with WoE/IV strength, PSI stability, and a RiskRank steering queue.",
        size: "13pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 88, y: 920, z: z++, height: 28, width: 1080, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 1: Portfolio Risk Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Portfolio Risk Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      { text: "Portfolio Risk Pulse — Is the book on track?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      { text: "Volume, default rate, and expected loss — by grade and risk band.", size: "11pt", color: "#5A6B75" },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, T, "Grade", "Grade", "CreditSync"),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, T, "RiskBand", "Risk band", "CreditSync"),
    slicer(id(), { ...SL.c, z: z++, tabOrder: 4 }, T, "NAME_CONTRACT_TYPE", "Contract type", "CreditSync"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    kpiCard(id(), { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 }, T, "Applications", "Applications", ACCENTS.applications),
    kpiCard(id(), { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 }, T, "Default Rate", "Default rate", ACCENTS.defaultRate),
    kpiCard(id(), { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 8 }, T, "Avg PD", "Avg PD", ACCENTS.avgPD),
    kpiCard(id(), { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 9 }, T, "EL Rate", "EL rate", ACCENTS.elRate),
    barChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 608, tabOrder: 10 },
      "FactGradeBridge",
      "Grade",
      "Grade Avg PD",
      "Avg PD by grade",
      "#2F5F73",
      "#D7E6EC",
      sortByColumnField("FactGradeBridge", "GradeSort", "Ascending")
    ),
    barChart(
      id(),
      { x: 664, y: 276, z: z++, height: 736, width: 608, tabOrder: 11 },
      "FactGradeBridge",
      "Grade",
      "Grade Default Rate",
      "Default rate by grade",
      "#B42318",
      "#F3D9D4",
      sortByColumnField("FactGradeBridge", "GradeSort", "Ascending")
    ),
    donutChart(
      id(),
      { x: 1296, y: 276, z: z++, height: 736, width: 592, tabOrder: 12 },
      T,
      "RiskBand",
      "Applications",
      "Applications by risk band"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 13 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Scorecard & Validation ---
{
  const p = PAGES.scorecard;
  pageChrome(p, "Scorecard & Validation");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Scorecard & Validation — Does the model separate, and does PD hold up?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Train / Test / OOT Gini & ROC, PD density (good vs bad), and OOT decile calibration.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),

    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 448, tabOrder: 3 }, "ModelMetrics", "Train Gini", "Train Gini", ACCENTS.gini),
    kpiCard(id(), { x: 504, y: 100, z: z++, height: 96, width: 448, tabOrder: 4 }, "ModelMetrics", "Test Gini", "Test Gini", ACCENTS.auc),
    kpiCard(id(), { x: 976, y: 100, z: z++, height: 96, width: 448, tabOrder: 5 }, "ModelMetrics", "OOT Gini", "OOT Gini", ACCENTS.avgPD),
    kpiCard(id(), { x: 1448, y: 100, z: z++, height: 96, width: 440, tabOrder: 6 }, "ModelMetrics", "OOT KS", "OOT KS", ACCENTS.ks),

    rocLineChart(
      id(),
      { x: 32, y: 212, z: z++, height: 360, width: 1216, tabOrder: 7 },
      "ROC — Train / Test / OOT (Youden optimum in red, as in cut-off guidelines)"
    ),
    giniCompareColumnChart(
      id(),
      { x: 1272, y: 212, z: z++, height: 360, width: 616, tabOrder: 8 },
      "Gini — Train / Test / OOT"
    ),

    pdDistributionLineChart(
      id(),
      { x: 32, y: 588, z: z++, height: 420, width: 912, tabOrder: 9 },
      "PD distribution — good vs bad density"
    ),
    calibrationLineChart(
      id(),
      { x: 976, y: 588, z: z++, height: 420, width: 912, tabOrder: 10 },
      "Calibration — predicted PD vs realized default (OOT deciles)"
    ),

    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: Cut-off Strategy (risk–reward from optimal cut-off guidelines) ---
{
  const p = PAGES.cutoff;
  pageChrome(p, "Cut-off Strategy");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 1100, tabOrder: 0 }, [
      { text: "Cut-off Strategy — Simulated for each cut-off point", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1200, tabOrder: 1 }, [
      {
        text: "Cumulative approval vs bad rate on OOT — new scorecard vs existing EXT_MEAN; budget = risk appetite.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),

    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 352, tabOrder: 3 }, "FactCutoffPolicy", "Budgeted Bad Rate", "Budgeted bad rate (appetite)", ACCENTS.breach),
    kpiCard(id(), { x: 400, y: 100, z: z++, height: 96, width: 352, tabOrder: 4 }, "FactCutoffPolicy", "Operating Cutoff PD", "Operating cut-off PD", ACCENTS.avgPD),
    kpiCard(id(), { x: 768, y: 100, z: z++, height: 96, width: 352, tabOrder: 5 }, "FactCutoffPolicy", "Operating Cutoff Score", "Operating cut-off score", ACCENTS.ks),
    kpiCard(id(), { x: 1136, y: 100, z: z++, height: 96, width: 352, tabOrder: 6 }, "FactCutoffPolicy", "Policy Approval Rate", "Approval rate at cut-off", ACCENTS.gini),
    kpiCard(id(), { x: 1504, y: 100, z: z++, height: 96, width: 384, tabOrder: 7 }, "FactCutoffPolicy", "Policy Bad Rate", "Expected default at cut-off", ACCENTS.highRisk),

    cutoffLineChart(
      id(),
      { x: 32, y: 216, z: z++, height: 480, width: 1856, tabOrder: 8 },
      "Simulated for each cut-off point — new scorecard vs existing score (EXT_MEAN)"
    ),

    cutoffPolicyTable(
      id(),
      { x: 32, y: 716, z: z++, height: 160, width: 1240, tabOrder: 9 },
      "Cut-off methods — Operating (risk–reward) vs Youden/KS reference"
    ),
    textbox(id(), { x: 1296, y: 716, z: z++, height: 160, width: 592, tabOrder: 10 }, [
      { text: "How to read this chart", size: "13pt", font: "Segoe UI Semibold", bold: true },
      { text: "1. X = share approved (best scores first); Y = bad rate among those approved.", size: "11pt" },
      { text: "2. Lower curve = better rank-ordering at the same approval volume.", size: "11pt" },
      { text: "3. Operating cut = max approval under the budget line (teal marker).", size: "11pt" },
      { text: "4. Existing EXT_MEAN is the baseline bureau-style score on the book.", size: "11pt" },
    ]),

    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 4: Monitoring & Steering ---
{
  const p = PAGES.monitoring;
  pageChrome(p, "Monitoring & Steering");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Monitoring & Steering — Is the model still telling the truth?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "New-business PD vs realized after go-live, PSI on model inputs, and the ranked steering queue.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, T, "RiskBand", "Risk band", "CreditSync"),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, T, "Grade", "Grade", "CreditSync"),
    slicer(id(), { ...SL.c, z: z++, tabOrder: 4 }, T, "Stage", "Stage", "CreditSync"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),

    newBusinessLineChart(
      id(),
      { x: 32, y: 100, z: z++, height: 300, width: 1856, tabOrder: 6 },
      "New business — scorecard PD vs realized default by origination month (go-live = OOT cut)"
    ),

    kpiCard(id(), { x: 32, y: 420, z: z++, height: 96, width: 608, tabOrder: 7 }, "FactPsi", "Max PSI", "Max PSI", ACCENTS.maxPsi),
    kpiCard(id(), { x: 656, y: 420, z: z++, height: 96, width: 608, tabOrder: 8 }, "FactPsi", "PSI Breach Features", "PSI breach features", ACCENTS.breach),
    kpiCard(id(), { x: 1280, y: 420, z: z++, height: 96, width: 608, tabOrder: 9 }, "FactPsi", "PSI Watch Features", "PSI watch features", ACCENTS.highRisk),

    barChart(
      id(),
      { x: 32, y: 536, z: z++, height: 260, width: 1856, tabOrder: 10 },
      "FactPsi",
      "Feature",
      "Max PSI",
      "Feature stability — PSI on model inputs only",
      "#B42318",
      "#F3D9D4"
    ),

    steeringQueueTable(id(), { x: 32, y: 816, z: z++, height: 200, width: 1856, tabOrder: 11 }, "Steering queue — recommended actions"),

    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 12 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 5: Context (facts and caveats only, filter pane collapsed) ---
{
  const p = PAGES.context;
  pageChrome(p, "Context", {}, 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Context — Reference", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1200, tabOrder: 1 }, [
      { text: "Facts and caveats only. Landing is the open; this page is documentation.", size: "11pt", color: "#5A6B75" },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    kpiCard(id(), { x: 32, y: 112, z: z++, height: 120, width: 448, tabOrder: 3 }, "ModelMetrics", "OOT Gini", "Champion OOT Gini", ACCENTS.gini),
    kpiCard(id(), { x: 504, y: 112, z: z++, height: 120, width: 448, tabOrder: 4 }, "ModelMetrics", "OOT AUC", "Champion OOT AUC", ACCENTS.auc),
    kpiCard(id(), { x: 976, y: 112, z: z++, height: 120, width: 448, tabOrder: 5 }, "ModelMetrics", "OOT KS", "Champion OOT KS", ACCENTS.ks),
    textbox(id(), { x: 32, y: 264, z: z++, height: 100, width: 1856, tabOrder: 6 }, [
      { text: "Audience", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "CRO / credit risk lead / model monitoring — grade migration, validation, and steering in one book.", size: "12pt" },
    ]),
    textbox(id(), { x: 32, y: 384, z: z++, height: 300, width: 908, tabOrder: 7 }, [
      { text: "How to read the metrics", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Gini — rank-ordering power of the score; higher is better separation of good vs bad accounts. Train = fit sample; Test = 20% random holdout in the development window; OOT = later-time holdout (hardest read).", size: "12pt" },
      { text: "KS (Kolmogorov–Smirnov) — max gap between cumulative good and bad distributions; higher is stronger discrimination.", size: "12pt" },
      { text: "PSI (Population Stability Index) — shift in a model-input feature's distribution over time; below 0.1 is stable, above 0.25 flags drift. Monitors independent variables only (not PD / Score / Grade). The recent window (2020) is an adverse-mix monitoring scenario, not an observed production drift event.", size: "12pt" },
      { text: "Cut-off — primary rule is risk–reward: maximise approval while bad rate among approved stays ≤ budgeted risk appetite. Youden / max KS is a supporting statistical reference only.", size: "12pt" },
      { text: "Grades (G1–G8) — PD bands ordered by GradeSort; G1 is the highest risk (worst), G8 is the safest.", size: "12pt" },
    ]),
    textbox(id(), { x: 976, y: 384, z: z++, height: 300, width: 912, tabOrder: 8 }, [
      { text: "Cut-off setting process", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "1. Risk-reward (primary) — simulate approval vs bad rate by PD cut on OOT; pick the cut that maximises approval while bad rate among approved stays within budgeted risk appetite.", size: "11pt" },
      { text: "2. Statistical reference — Youden / max KS on train ROC supports the decision but does not override appetite.", size: "11pt" },
      { text: "3. Implement — operating cut drives Approve/Reject on the book; monitor approval, bad rate, and PSI on model inputs; reset cut when annual appetite changes.", size: "11pt" },
      { text: "See Cut-off Strategy for the approval vs expected-default trade-off, operating KPIs, and Operating vs Youden comparison.", size: "11pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 32, y: 704, z: z++, height: 240, width: 1856, tabOrder: 9 }, [
      { text: "Data & model caveats", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "• Source: Home Credit Default Risk (Kaggle) application + bureau tables — sampled and dated for a synthetic 2018–2020 vintage.", size: "12pt" },
      { text: "• PD / Score / Grade / RiskBand: LightGBM + Platt calibration sample scorecard — portfolio analytics, not a production IRB model.", size: "12pt" },
      { text: "• EAD / LGD / EL are illustrative — LGD is a fixed policy assumption.", size: "12pt" },
      { text: "• Budgeted bad rate (4%) is an illustrative risk-appetite assumption for this demo book.", size: "12pt" },
      { text: "• Not production IRB. Not for capital, provisioning, or credit-decision use.", size: "12pt", color: "#B42318" },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 5: Application Profile (hidden drillthrough target) ---
{
  const p = PAGES.profile;
  pageChrome(p, "Application Profile", drillthroughExtras());
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Application Profile", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1200, tabOrder: 1 }, [
      { text: "Drillthrough target — full detail for one application. Right-click a steering-queue row and drill through.", size: "11pt", color: "#5A6B75" },
    ]),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 120, width: 448, tabOrder: 2 }, T, "Applications", "Applications in context", ACCENTS.applications),
    kpiCard(id(), { x: 504, y: 100, z: z++, height: 120, width: 448, tabOrder: 3 }, T, "Avg PD", "PD", ACCENTS.avgPD),
    kpiCard(id(), { x: 976, y: 100, z: z++, height: 120, width: 448, tabOrder: 4 }, T, "Sum EL", "Expected loss", ACCENTS.defaultRate),
    kpiCard(id(), { x: 1448, y: 100, z: z++, height: 120, width: 440, tabOrder: 5 }, T, "Avg Score", "Score", ACCENTS.ks),
    profileDetailTable(id(), { x: 32, y: 248, z: z++, height: 756, width: 1856, tabOrder: 6 }, "Application detail"),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 7 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pages: PAGES,
      syncGroup: "CreditSync_<column>",
      report: REPORT,
    },
    null,
    2
  )
);

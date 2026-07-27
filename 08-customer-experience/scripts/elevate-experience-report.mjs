/**
 * Elevate Experience Pulse report — Nordic Boardroom polish across 5 pages.
 * Reads page IDs dynamically from pages.json (do not hardcode ReportSection IDs).
 * Sync groups: ExperienceSync_${col} (one field per group).
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
const REPORT = path.join(root, "ExperiencePulse.Report");

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const SYNC_PREFIX = "ExperienceSync";
const FOOTER =
  "Source: Olist reviews × Logistics FactOrders · DetractorProbability = sample logistic (ROC-AUC ~0.82) · Local PBIP · Nordic Boardroom · not production CX scoring";
/** Five visible pages (Landing + Experience Pulse + Drivers + Recovery Queue + Context) — slicers end before NAV. */
const NAV = { x: 1448, y: 12, z: 0, height: 80, width: 440 };
const SL = {
  a: { x: 860, y: 12, height: 80, width: 176 },
  b: { x: 1048, y: 12, height: 80, width: 176 },
  c: { x: 1236, y: 12, height: 80, width: 192 },
};

const ACCENTS = {
  score: "#2F5F73",
  csat: "#1B7A4E",
  proxyNps: "#C17B3A",
  detractor: "#B42318",
  reviews: "#2F5F73",
  onTime: "#1B7A4E",
  late: "#A67C52",
  veryLate: "#B42318",
  neutral: "#5A6B75",
};

const LANDING_ATMOSPHERE = "linen-mist";

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

/** Scope-identity dataPoint color override for one categorical value (string columns). */
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
/** Scope-identity dataPoint color override keyed by an integer literal (e.g. ReviewScore = 2). */
function scopeColorInt(entity, colName, value, hex) {
  return {
    properties: { fill: solid(hex) },
    selector: {
      data: [
        {
          scopeId: {
            Comparison: {
              ComparisonKind: 0,
              Left: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: colName } },
              Right: { Literal: { Value: `${value}L` } },
            },
          },
        },
      ],
    },
  };
}

function pageDisplayMap(meta) {
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
    if (!fs.existsSync(pagePath)) continue;
    const pj = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    byDisplay[pj.displayName] = pageKey;
  }
  return byDisplay;
}

function createBlankPage(displayName) {
  const pageKey = "ReportSection" + crypto.randomBytes(12).toString("hex");
  const pageDir = path.join(REPORT, "definition/pages", pageKey);
  fs.mkdirSync(path.join(pageDir, "visuals"), { recursive: true });
  fs.writeFileSync(
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
  return pageKey;
}

function writePagesMeta(meta) {
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
}

function ensureLandingPage(meta) {
  const byDisplay = pageDisplayMap(meta);
  let landingKey = byDisplay["Landing"];
  const withoutLanding = meta.pageOrder.filter((k) => k !== landingKey);
  if (!landingKey) {
    landingKey = createBlankPage("Landing");
  }
  meta.pageOrder = [landingKey, ...withoutLanding];
  meta.activePageName = landingKey;
  writePagesMeta(meta);
  return meta;
}

function ensureContextPage(meta) {
  const byDisplay = pageDisplayMap(meta);
  if (byDisplay["Context"]) return meta;
  const pageKey = createBlankPage("Context");
  meta.pageOrder = [...meta.pageOrder, pageKey];
  writePagesMeta(meta);
  return meta;
}

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  if (!fs.existsSync(pagesPath)) {
    throw new Error(`Missing ${pagesPath} — run scaffold-experience-pbip.mjs first`);
  }
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  meta = ensureLandingPage(meta);
  meta = ensureContextPage(meta);
  const byDisplay = pageDisplayMap(meta);
  const order = [
    byDisplay["Landing"],
    byDisplay["Experience Pulse"],
    byDisplay["Drivers"],
    byDisplay["Recovery Queue"],
    byDisplay["Context"],
  ].filter(Boolean);
  meta.pageOrder = order;
  meta.activePageName = byDisplay["Landing"];
  writePagesMeta(meta);
  const required = ["Landing", "Experience Pulse", "Drivers", "Recovery Queue", "Context"];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  return {
    landing: byDisplay["Landing"],
    pulse: byDisplay["Experience Pulse"],
    drivers: byDisplay["Drivers"],
    queue: byDisplay["Recovery Queue"],
    context: byDisplay["Context"],
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
    v.visual.syncGroup = { groupName: `${SYNC_PREFIX}_${col}`, fieldChanges: false, filterChanges: true };
  }
  return v;
}

function kpiCard(name, pos, entity, measureName, title, accent, fontSize = 28) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measure(entity, measureName)] } } },
      objects: {
        labels: [{ properties: { fontSize: litD(fontSize), bold: lit(true), color: solid(accent) } }],
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

/** Monthly trend — single measure line. */
function lineChart(name, pos, catEntity, catCol, measureEntity, measureName, title, accent) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [{ properties: { defaultColor: solid(accent || ACCENTS.score) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Vertical column chart with optional per-category semantic color overrides. */
function columnChart(name, pos, catEntity, catCol, measureEntity, measureName, title, opts = {}) {
  const { sort, dataPointRules = [], defaultColor = ACCENTS.score, showValueAxis = true } = opts;
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "columnChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: { sort: [sort || sortByMeasureField(measureEntity, measureName, "Descending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(true), labelDisplayUnits: lit("0"), fontSize: litD(9), color: solid("#0F1C24") } }],
        valueAxis: [{ properties: { show: lit(showValueAxis), gridlineShow: lit(showValueAxis), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [{ properties: { defaultColor: solid(defaultColor) } }, ...dataPointRules],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Horizontal bar (barChart) — Category on Y-axis, single measure on X, gradient fill. */
function barChart(name, pos, entity, catCol, measureEntity, measureName, title, hue, tint, sort) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, catCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: { sort: [sort || sortByMeasureField(measureEntity, measureName, "Descending")] },
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
                        Input: { Measure: { Expression: { SourceRef: { Entity: measureEntity } }, Property: measureName } },
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

function matrixVisual(name, pos, title, rowsEntity, rowsCol, colsEntity, colsCol, valuesEntity, valuesMeasure) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: { projections: [column(rowsEntity, rowsCol)] },
          Columns: { projections: [column(colsEntity, colsCol)] },
          Values: { projections: [measure(valuesEntity, valuesMeasure)] },
        },
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function reviewScoreLteFilter(entity, maxScore) {
  return {
    name: "Filter" + crypto.randomBytes(12).toString("hex"),
    field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: "ReviewScore" } },
    type: "Advanced",
    filter: {
      Version: 2,
      From: [{ Name: "f", Entity: entity, Type: 0 }],
      Where: [
        {
          Condition: {
            Comparison: {
              ComparisonKind: 4,
              Left: { Column: { Expression: { SourceRef: { Source: "f" } }, Property: "ReviewScore" } },
              Right: { Literal: { Value: `${maxScore}L` } },
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

function tableEx(name, pos, title, entity, columns, sorts, filters) {
  const v = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: { projections: columns.map(([e, c]) => column(e, c)) },
        },
        sortDefinition: { sort: Array.isArray(sorts) ? sorts : [sorts] },
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: {
        ...cardChrome(title),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
  };
  if (filters && filters.length) {
    v.filterConfig = { filters };
  }
  return v;
}

/** Category bubbles: ops delay (X) vs propensity (Y), sized by volume — Recovery prioritization map. */
function scatterPriority(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "scatterChart",
      query: {
        queryState: {
          Category: { projections: [column("FactReviews", "Category")] },
          X: { projections: [measure("FactReviews", "Avg Lead Time")] },
          Y: { projections: [measure("FactReviews", "Avg Detractor Probability")] },
          Size: { projections: [measure("FactReviews", "Reviews")] },
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
        categoryLabels: [{ properties: { show: lit(false) } }],
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
        valueAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              gridlineShow: lit(true),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

/** Risk triage funnel — High → Medium → Low (RiskBandSort). */
function riskFunnel(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "funnel",
      query: {
        queryState: {
          Category: { projections: [column("FactReviews", "RiskBand")] },
          Y: { projections: [measure("FactReviews", "Reviews")] },
        },
        sortDefinition: {
          sort: [sortByColumnField("FactReviews", "RiskBand", "Ascending")],
        },
      },
      objects: {
        labels: [{ properties: { show: lit(true), fontSize: litD(10) } }],
        dataPoint: [
          {
            properties: {
              fill: solid(ACCENTS.detractor),
            },
            selector: {
              data: [{ dataViewWildcard: { matchingOption: 1 } }],
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

// --- Build ---
const PAGES = resolvePages();

// --- Page 0: Landing (poster cover, active on open) ---
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
      { text: "Experience Pulse", size: "40pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 88, y: 268, z: z++, height: 56, width: 1080, tabOrder: 4 }, [
      {
        text: "Late delivery drives detractors — propensity scores and Key Influencers show who and why.",
        size: "16pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 88, y: 340, z: z++, height: 4, width: 280, tabOrder: 5 }, "#C17B3A"),
    editorialHero(
      id(),
      { x: 88, y: 380, z: z++, height: 240, width: 520, tabOrder: 6 },
      "FactReviews",
      "Avg Review Score",
      ACCENTS.score,
      "Average review score (1–5)"
    ),
    textbox(id(), { x: 640, y: 400, z: z++, height: 200, width: 520, tabOrder: 7 }, [
      { text: "What you’ll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  Experience Pulse — CSAT and score health", size: "13pt" },
      { text: "02  Drivers — Key Influencers + score erosion", size: "13pt" },
      { text: "03  Recovery Queue — ranked by propensity", size: "13pt" },
      { text: "04  Context — model facts and caveats", size: "13pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 88, y: 660, z: z++, height: 40, width: 1080, tabOrder: 8 }, [
      { text: "Audience · CX / VoC lead · category & seller ops · exec/board", size: "13pt", color: "#0F1C24" },
    ]),
    textbox(id(), { x: 88, y: 720, z: z++, height: 80, width: 1080, tabOrder: 9 }, [
      {
        text: "Signature · Detractor propensity (logistic) + Key Influencers · score erosion On-time → Late → Very late.",
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

// --- Page 1: Experience Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Experience Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      { text: "Experience Pulse — Is the customer experience healthy?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      { text: "Average score, CSAT, and a labeled proxy NPS across reviews joined to delivered orders.", size: "11pt", color: "#5A6B75" },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "DimDate", "Year", "Year", true),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "FactReviews", "CustomerState", "Customer state", true),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    kpiCard(id(), { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 5 }, "FactReviews", "Avg Review Score", "Avg review score", ACCENTS.score),
    kpiCard(id(), { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 }, "FactReviews", "CSAT %", "CSAT % (score ≥ 4)", ACCENTS.csat),
    kpiCard(id(), { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 }, "FactReviews", "Proxy NPS", "Proxy NPS (labeled proxy)", ACCENTS.proxyNps),
    kpiCard(id(), { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 8 }, "FactReviews", "Avg Detractor Probability", "Avg detractor probability", ACCENTS.detractor),
    lineChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 920, tabOrder: 9 },
      "DimDate",
      "YearMonth",
      "FactReviews",
      "Avg Review Score",
      "Monthly average review score",
      ACCENTS.score
    ),
    columnChart(
      id(),
      { x: 976, y: 276, z: z++, height: 736, width: 912, tabOrder: 10 },
      "FactReviews",
      "ReviewScore",
      "FactReviews",
      "Reviews",
      "Score distribution — 1 to 5 stars",
      {
        sort: sortByColumnField("FactReviews", "ReviewScore", "Ascending"),
        defaultColor: ACCENTS.neutral,
        dataPointRules: [
          scopeColorInt("FactReviews", "ReviewScore", 1, ACCENTS.veryLate),
          scopeColorInt("FactReviews", "ReviewScore", 2, ACCENTS.veryLate),
          scopeColorInt("FactReviews", "ReviewScore", 3, ACCENTS.late),
          scopeColorInt("FactReviews", "ReviewScore", 4, ACCENTS.csat),
          scopeColorInt("FactReviews", "ReviewScore", 5, ACCENTS.csat),
        ],
      }
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Drivers (balanced dual-hero + signature strip) ---
{
  const p = PAGES.drivers;
  pageChrome(p, "Drivers");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Drivers — What predicts and moves detractors", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1300, tabOrder: 1 }, [
      {
        text: "Key influencers (left) · decomposition + theme matrix (top right) · score erosion (bottom right). Sample model — see Context.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "DimDate", "Year", "Year", true),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "FactReviews", "RiskBand", "Risk band", true),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    // Asymmetric — tall KI left; decomp + matrix side-by-side top-right; score erosion full-width below
    {
      $schema: SCHEMA,
      name: id(),
      position: { x: 32, y: 112, z: z++, height: 896, width: 920, tabOrder: 5 },
      visual: {
        visualType: "keyDriversVisual",
        query: {
          queryState: {
            Target: { projections: [column("FactReviews", "IsDetractor")] },
            ExplainBy: {
              projections: [
                column("FactReviews", "LateFlag"),
                column("FactReviews", "LeadTimeBand"),
                column("FactReviews", "DeliveryOutcome"),
                column("FactReviews", "ThemePrimary"),
              ],
            },
          },
        },
        visualContainerObjects: cardChrome("Key influencers — what drives detractors?"),
      },
    },
    {
      $schema: SCHEMA,
      name: id(),
      position: { x: 976, y: 112, z: z++, height: 280, width: 457, tabOrder: 6 },
      visual: {
        visualType: "decompositionTreeVisual",
        query: {
          queryState: {
            Analyze: { projections: [measure("FactReviews", "Detractor %")] },
            ExplainBy: {
              projections: [
                column("FactReviews", "DeliveryOutcome"),
                column("FactReviews", "LeadTimeBand"),
                column("FactReviews", "ThemePrimary"),
                column("FactReviews", "RiskBand"),
              ],
            },
          },
        },
        visualContainerObjects: cardChrome("Decomposition — detractor % breakdown"),
      },
    },
    matrixVisual(
      id(),
      { x: 1447, y: 112, z: z++, height: 280, width: 440, tabOrder: 7 },
      "Theme × NPS class — review mentions",
      "DimTheme",
      "Theme",
      "FactReviews",
      "ProxyNPSClass",
      "FactReviewTheme",
      "Theme Reviews"
    ),
    columnChart(
      id(),
      { x: 976, y: 400, z: z++, height: 608, width: 912, tabOrder: 8 },
      "FactReviews",
      "DeliveryOutcome",
      "FactReviews",
      "Avg Review Score",
      "Signature — score erosion by delivery outcome",
      {
        sort: sortByColumnField("FactReviews", "DeliveryOutcome", "Ascending"),
        defaultColor: ACCENTS.score,
        dataPointRules: [
          scopeColor("FactReviews", "DeliveryOutcome", "On-time", ACCENTS.onTime),
          scopeColor("FactReviews", "DeliveryOutcome", "Late", ACCENTS.late),
          scopeColor("FactReviews", "DeliveryOutcome", "Very late", ACCENTS.veryLate),
        ],
      }
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 9 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: Recovery Queue ---
{
  const p = PAGES.queue;
  pageChrome(p, "Recovery Queue");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 1100, tabOrder: 0 }, [
      { text: "Recovery Queue — Prioritize, then act", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1300, tabOrder: 1 }, [
      {
        text: "Scatter = categories to chase (slow + high propensity) · funnel = risk triage · table = ranked intervention list.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "FactReviews", "RiskBand", "Risk band", false),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "FactReviews", "LateFlag", "Late flag", false),
    slicer(id(), { ...SL.c, z: z++, tabOrder: 4 }, "FactReviews", "SellerID", "Seller", false),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 120, width: 448, tabOrder: 6 }, "FactReviews", "High Risk Reviews", "High risk reviews", ACCENTS.detractor),
    kpiCard(id(), { x: 496, y: 100, z: z++, height: 120, width: 448, tabOrder: 7 }, "FactReviews", "Avg Detractor Probability", "Avg detractor probability", ACCENTS.late),
    kpiCard(id(), { x: 960, y: 100, z: z++, height: 120, width: 448, tabOrder: 8 }, "FactReviews", "Late Share of Detractors", "Late share of detractors", ACCENTS.late),
    kpiCard(id(), { x: 1424, y: 100, z: z++, height: 120, width: 464, tabOrder: 9 }, "FactReviews", "Top Detractor Theme", "Top detractor theme", "#0F1C24", 18),
    scatterPriority(
      id(),
      { x: 32, y: 236, z: z++, height: 340, width: 1200, tabOrder: 10 },
      "Prioritization map — lead time × detractor propensity (by category)"
    ),
    riskFunnel(
      id(),
      { x: 1256, y: 236, z: z++, height: 340, width: 632, tabOrder: 11 },
      "Risk triage funnel — High → Medium → Low"
    ),
    tableEx(
      id(),
      { x: 32, y: 592, z: z++, height: 424, width: 1856, tabOrder: 12 },
      "Recovery queue — DetractorProbability descending",
      "FactReviews",
      [
        ["FactReviews", "RiskRank"],
        ["FactReviews", "DetractorProbability"],
        ["FactReviews", "RiskBand"],
        ["FactReviews", "ReviewScore"],
        ["FactReviews", "LateFlag"],
        ["FactReviews", "LeadTimeDays"],
        ["FactReviews", "DeliveryOutcome"],
        ["FactReviews", "Category"],
        ["FactReviews", "ThemePrimary"],
        ["FactReviews", "SellerID"],
        ["FactReviews", "OrderID"],
        ["FactReviews", "CommentEN"],
      ],
      [sortByColumnField("FactReviews", "DetractorProbability", "Descending")],
      []
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 13 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 4: Context (last visible, facts only) ---
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
    textbox(id(), { x: 32, y: 120, z: z++, height: 420, width: 908, tabOrder: 3 }, [
      { text: "Metric definitions", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Population — reviews inner-joined to delivered Logistics Pulse orders (unique ReviewID).", size: "12pt" },
      { text: "Avg Review Score — AVERAGE(ReviewScore), 1–5 scale.", size: "12pt" },
      { text: "CSAT % — share of reviews with ReviewScore ≥ 4.", size: "12pt" },
      { text: "Proxy NPS — %(score = 5) − %(score ≤ 3). Labeled proxy — not a 0–10 NPS survey.", size: "12pt" },
      { text: "IsDetractor — 1 when ProxyNPSClass = Detractor (scores 1–3).", size: "12pt" },
      { text: "DetractorProbability / RiskBand / RiskRank — sample logistic propensity (see model caveats).", size: "12pt" },
      { text: "DeliveryOutcome — On-time · Late (late ∧ lead ≤ 30d) · Very late (late ∧ lead > 30d).", size: "12pt" },
      { text: "Theme Reviews — COUNTROWS(FactReviewTheme) for DimTheme matrices (bridge-aware).", size: "12pt" },
    ]),
    textbox(id(), { x: 976, y: 120, z: z++, height: 420, width: 912, tabOrder: 4 }, [
      { text: "Advanced analytics & caveats", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "• Key Influencers target IsDetractor; explainers exclude ReviewScore / ProxyNPSClass (label leakage).", size: "12pt" },
      { text: "• Decomposition analyzes Detractor % by RiskBand, DeliveryOutcome, LeadTimeBand, Theme, Category.", size: "12pt" },
      { text: "• DetractorProbability: balanced logistic (holdout ROC-AUC ~0.82). RiskBand cutoffs: High ≥0.50 · Medium 0.30–0.50 · Low <0.30 (not equal tertiles).", size: "12pt" },
      { text: "• Sample-model scores for portfolio demonstration — not production CX scoring or survey science.", size: "12pt", color: "#B42318" },
      { text: "• Comments PT→EN via Argos; themes are keyword rules, not a trained classifier.", size: "12pt" },
      { text: "• Brazilian Olist marketplace sample 2016–2018.", size: "12pt" },
    ]),
    textbox(id(), { x: 32, y: 560, z: z++, height: 200, width: 1856, tabOrder: 5 }, [
      { text: "Source & attribution", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Source: Olist Brazilian E-Commerce (Kaggle, CC BY-NC-SA 4.0) reviews, 2016–2018 sample.", size: "12pt" },
      { text: "Ops grain joined from Logistics Pulse FactOrders. Pipeline: enrich-reviews.py → score-detractor.py.", size: "12pt" },
      { text: "Sample demo — not a production VoC survey program.", size: "12pt", color: "#B42318" },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 6 }, [
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
        landing: PAGES.landing,
        pulse: PAGES.pulse,
        drivers: PAGES.drivers,
        queue: PAGES.queue,
        context: PAGES.context,
      },
      syncGroup: `${SYNC_PREFIX}_<column>`,
      atmosphere: LANDING_ATMOSPHERE,
      report: REPORT,
    },
    null,
    2
  )
);

/**
 * Elevate Logistics Pulse report — Nordic Boardroom polish across 5 pages.
 * Reads page IDs dynamically from pages.json (do not hardcode ReportSection IDs).
 * Sync groups: LogisticsSync_${col} (one field per group).
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
const REPORT = path.join(root, "LogisticsPulse.Report");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const SYNC_PREFIX = "LogisticsSync";
const FOOTER =
  "Source: Olist Brazilian E-Commerce (sample) · Local PBIP · Nordic Boardroom · On-time demo + demand forecast band — not inventory policy";
/** Four visible pages (Landing + Delivery Pulse + Sellers & Routes + Demand Outlook + Context) — slicers end before NAV. */
const NAV = { x: 1448, y: 12, z: 0, height: 80, width: 440 };
const SL = {
  a: { x: 1048, y: 12, height: 80, width: 176 },
  b: { x: 1236, y: 12, height: 80, width: 192 },
};

const ACCENTS = {
  onTime: "#1B7A4E",
  late: "#B42318",
  orders: "#2F5F73",
  leadTime: "#C17B3A",
  forecast: "#2F5F73",
  band: "#5B8FA3",
  highRisk: "#B42318",
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
    throw new Error(`Missing ${pagesPath} — run scaffold-logistics-pbip.mjs first`);
  }
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  meta = ensureLandingPage(meta);
  meta = ensureContextPage(meta);
  // Re-order: Landing first, analysis pages, Context last
  const byDisplay = pageDisplayMap(meta);
  const order = [
    byDisplay["Landing"],
    byDisplay["Delivery Pulse"],
    byDisplay["Sellers & Routes"],
    byDisplay["Demand Outlook"],
    byDisplay["Context"],
  ].filter(Boolean);
  meta.pageOrder = order;
  meta.activePageName = byDisplay["Landing"];
  writePagesMeta(meta);
  const required = ["Landing", "Delivery Pulse", "Sellers & Routes", "Demand Outlook", "Context"];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  return {
    landing: byDisplay["Landing"],
    pulse: byDisplay["Delivery Pulse"],
    sellers: byDisplay["Sellers & Routes"],
    demand: byDisplay["Demand Outlook"],
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

const LANDING_ATMOSPHERE = "harbor-mist";

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

/** Monthly volume trend — single measure line (Orders). */
function lineChart(name, pos, catEntity, catCol, measureEntity, measureName, title) {
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
        dataPoint: [{ properties: { defaultColor: solid(ACCENTS.orders) } }],
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

/**
 * Stacked area ribbon under the forecast lines: Lo80 (invisible base) + Band Width (dark teal fill).
 * Paired with forecastBandChart (transparent card) at the same position / higher z.
 */
function forecastBandArea(name, pos) {
  const baseKeys = ["FactForecast.Sum Lo80", "Sum Lo80"];
  const bandKeys = ["FactForecast.Sum Band Width", "Sum Band Width"];
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "stackedAreaChart",
      query: {
        queryState: {
          Category: { projections: [column("FactForecast", "WeekStart")] },
          Y: {
            projections: [
              measure("FactForecast", "Sum Lo80"),
              measure("FactForecast", "Sum Band Width"),
            ],
          },
        },
        sortDefinition: { sort: [sortByColumnField("FactForecast", "WeekStart", "Ascending")] },
      },
      objects: {
        general: [{ properties: { responsive: lit(true) } }],
        labels: [{ properties: { show: lit(false) } }],
        legend: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              showAxisTitle: lit(true),
              titleText: lit("Orders"),
              start: litD(0),
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
          ...baseKeys.map((key) => ({
            properties: { fill: solid("#FFFFFF"), transparency: litD(100) },
            selector: { metadata: key },
          })),
          ...bandKeys.map((key) => ({
            properties: { fill: solid("#3D7A8F"), transparency: litD(10) },
            selector: { metadata: key },
          })),
        ],
        lineStyles: [
          ...baseKeys.map((key) => ({
            properties: {
              strokeShow: lit(false),
              strokeWidth: litD(0),
              showMarker: lit(false),
              areaShow: lit(true),
              areaColor: solid("#FFFFFF"),
            },
            selector: { metadata: key },
          })),
          ...bandKeys.map((key) => ({
            properties: {
              strokeShow: lit(false),
              strokeWidth: litD(0),
              showMarker: lit(false),
              areaShow: lit(true),
              areaColor: solid("#3D7A8F"),
            },
            selector: { metadata: key },
          })),
        ],
      },
      visualContainerObjects: {
        ...cardChrome("Weekly orders — solid actual · dashed forecast · dotted 80% PI (shaded band)"),
      },
    },
  };
}

/**
 * Signature forecast lines — Actual solid, Forecast dashed, Lo80/Hi80 dotted.
 * (Stacked-area ribbon removed: it required BandWidth before Desktop refresh and threw "Fix this".)
 */
function forecastBandChart(name, pos) {
  const specs = [
    ["Sum Actual", "#0F1C24", "solid", 3.25, null],
    ["Sum Forecast", "#C17B3A", "custom", 3.25, "14 7"],
    ["Sum Lo80", "#2F5F73", "custom", 2.75, "2 5"],
    ["Sum Hi80", "#2F5F73", "custom", 2.75, "2 5"],
  ];
  const metaKeys = (m) => [`FactForecast.${m}`, m];
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("FactForecast", "WeekStart")] },
          Y: { projections: specs.map(([m]) => measure("FactForecast", m)) },
        },
        sortDefinition: { sort: [sortByColumnField("FactForecast", "WeekStart", "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              showAxisTitle: lit(true),
              titleText: lit("Orders"),
              start: litD(0),
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
        dataPoint: specs.flatMap(([m, color]) =>
          metaKeys(m).map((key) => ({ properties: { fill: solid(color) }, selector: { metadata: key } }))
        ),
        lineStyles: specs.flatMap(([m, color, style, width, dashArray]) => {
          const props = {
            strokeWidth: litD(width),
            strokeColor: solid(color),
            lineStyle: lit(style),
            showMarker: lit(false),
            strokeDashCap: lit("round"),
            areaShow: lit(false),
          };
          if (dashArray) {
            props.strokeAutoScale = lit(false);
            props.strokeDashArray = lit(dashArray);
          }
          return metaKeys(m).map((key) => ({ properties: props, selector: { metadata: key } }));
        }),
      },
      visualContainerObjects: cardChrome(
        "Weekly orders — solid actual · dashed forecast · dotted 80% PI"
      ),
    },
  };
}

function tableEx(name, pos, title, entity, columns, sort) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: { projections: columns.map(([e, c]) => column(e, c)) },
        },
        sortDefinition: { sort: [sort] },
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
}

/** Freight vs late-rate trade-off — one point per seller (Category = SellerID identity). */
function sellerScatter(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "scatterChart",
      query: {
        queryState: {
          Category: { projections: [column("DimSeller", "SellerID", false)] },
          X: { projections: [measure("DimSeller", "Seller Avg Freight")] },
          Y: { projections: [measure("DimSeller", "Seller Late Rate")] },
          Size: { projections: [measure("DimSeller", "Seller Order N")] },
        },
      },
      objects: {
        general: [{ properties: { responsive: lit(true) } }],
        categoryLabels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(true),
              titleText: lit("Late rate"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(true),
              titleText: lit("Avg freight (R$)"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
            },
          },
        ],
        dataPoint: [{ properties: { fill: solid("#2F5F73") } }],
      },
      visualContainerObjects: cardChrome(title),
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
      pageOrder: [PAGES.landing, PAGES.pulse, PAGES.sellers, PAGES.demand, PAGES.context],
      activePageName: PAGES.landing,
    },
    null,
    2
  )
);

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
      { text: "Logistics Pulse", size: "40pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 88, y: 268, z: z++, height: 56, width: 1080, tabOrder: 4 }, [
      {
        text: "On-time delivery ops for the COO desk — where sellers and corridors bleed, and what demand to plan against.",
        size: "16pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 88, y: 340, z: z++, height: 4, width: 280, tabOrder: 5 }, "#C17B3A"),
    editorialHero(
      id(),
      { x: 88, y: 380, z: z++, height: 240, width: 520, tabOrder: 6 },
      "FactOrders",
      "On-time %",
      ACCENTS.onTime,
      "On-time delivery rate"
    ),
    textbox(id(), { x: 640, y: 400, z: z++, height: 200, width: 520, tabOrder: 7 }, [
      { text: "What you’ll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  Delivery Pulse — on-time KPIs and trend", size: "13pt" },
      { text: "02  Sellers & Routes — risk queue and corridors", size: "13pt" },
      { text: "03  Demand Outlook — weekly forecast band", size: "13pt" },
      { text: "04  Context — facts and forecast caveats", size: "13pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 88, y: 660, z: z++, height: 40, width: 1080, tabOrder: 8 }, [
      { text: "Audience · COO / logistics lead", size: "13pt", color: "#0F1C24" },
    ]),
    textbox(id(), { x: 88, y: 720, z: z++, height: 80, width: 1080, tabOrder: 9 }, [
      {
        text: "Signature · Weekly demand outlook with an 80%/95% prediction-interval band — not a point forecast.",
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

// --- Page 1: Delivery Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Delivery Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      { text: "Delivery Pulse — Is delivery performance on track?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      { text: "On-time rate, lead time, and category mix for delivered orders.", size: "11pt", color: "#5A6B75" },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "DimDate", "Year", "Year", true),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "FactOrders", "CustomerState", "Customer state", true),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    kpiCard(id(), { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 5 }, "FactOrders", "On-time %", "On-time %", ACCENTS.onTime),
    kpiCard(id(), { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 }, "FactOrders", "Avg Lead Time", "Avg lead time (days)", ACCENTS.leadTime),
    kpiCard(id(), { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 }, "FactOrders", "Late Orders", "Late orders", ACCENTS.late),
    kpiCard(id(), { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 8 }, "FactOrders", "Orders", "Orders", ACCENTS.orders),
    lineChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 920, tabOrder: 9 },
      "DimDate",
      "YearMonth",
      "FactOrders",
      "Orders",
      "Monthly order volume"
    ),
    barChart(
      id(),
      { x: 976, y: 276, z: z++, height: 736, width: 912, tabOrder: 10 },
      "FactOrders",
      "Category",
      "FactOrders",
      "On-time %",
      "On-time % by category — lowest first",
      "#B42318",
      "#F3D9D4",
      sortByMeasureField("FactOrders", "On-time %", "Ascending")
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Sellers & Routes ---
{
  const p = PAGES.sellers;
  pageChrome(p, "Sellers & Routes");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      { text: "Sellers & Routes — Which sellers and corridors bleed?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      { text: "Seller risk queue (≥30 orders), state corridors, and the freight vs late-rate trade-off.", size: "11pt", color: "#5A6B75" },
    ]),
    slicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "DimSeller", "State", "Seller state", true),
    slicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "DimSeller", "RiskBand", "Risk band", true),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    tableEx(
      id(),
      { x: 32, y: 112, z: z++, height: 900, width: 928, tabOrder: 5 },
      "Seller risk queue — sorted by late rate",
      "DimSeller",
      [
        ["DimSeller", "SellerID"],
        ["DimSeller", "State"],
        ["DimSeller", "OrderN"],
        ["DimSeller", "LateRate"],
        ["DimSeller", "RiskBand"],
        ["DimSeller", "RecommendedAction"],
      ],
      sortByColumnField("DimSeller", "LateRate", "Descending")
    ),
    tableEx(
      id(),
      { x: 976, y: 112, z: z++, height: 440, width: 912, tabOrder: 6 },
      "Corridor performance — state → state",
      "FactCorridor",
      [
        ["FactCorridor", "SellerState"],
        ["FactCorridor", "CustomerState"],
        ["FactCorridor", "Orders"],
        ["FactCorridor", "LateRate"],
        ["FactCorridor", "AvgLeadTime"],
        ["FactCorridor", "AvgFreight"],
      ],
      sortByColumnField("FactCorridor", "LateRate", "Descending")
    ),
    sellerScatter(
      id(),
      { x: 976, y: 572, z: z++, height: 440, width: 912, tabOrder: 7 },
      "Freight vs late rate — bubble size = order volume"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: Demand Outlook (signature) ---
{
  const p = PAGES.demand;
  pageChrome(p, "Demand Outlook");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 1100, tabOrder: 0 }, [
      { text: "Demand Outlook — What demand should we plan for, with uncertainty?", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1200, tabOrder: 1 }, [
      { text: "Weekly actuals, forecast, and 80% prediction-interval band — 8-week horizon.", size: "11pt", color: "#5A6B75" },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 608, tabOrder: 3 }, "ModelMetrics", "Holdout MAPE", "Holdout MAPE", ACCENTS.late),
    kpiCard(id(), { x: 656, y: 100, z: z++, height: 96, width: 608, tabOrder: 4 }, "ModelMetrics", "Coverage 80", "Coverage 80", ACCENTS.band),
    kpiCard(id(), { x: 1280, y: 100, z: z++, height: 96, width: 608, tabOrder: 5 }, "FactForecast", "Forecast Horizon Orders", "Forecast horizon orders (8wk)", ACCENTS.forecast),
    forecastBandChart(id(), { x: 32, y: 212, z: z++, height: 552, width: 1560, tabOrder: 6 }),
    barChart(
      id(),
      { x: 1608, y: 212, z: z++, height: 552, width: 280, tabOrder: 7 },
      "FactOrders",
      "Category",
      "FactOrders",
      "Orders",
      "Historical volume by category",
      "#2F5F73",
      "#D7E6EC"
    ),
    textbox(id(), { x: 32, y: 780, z: z++, height: 220, width: 1856, tabOrder: 8 }, [
      { text: "How to read the band", size: "13pt", font: "Segoe UI Semibold", bold: true },
      { text: "Solid near-black = actual weekly orders. Dashed copper = point forecast (backtest on history, forward 8 weeks).", size: "11pt" },
      { text: "Dotted teal = 80% prediction interval (Lo80 / Hi80). The gap between the dotted lines is the confidence zone.", size: "11pt" },
      { text: "Holdout MAPE and Coverage 80 are measured on the last 12 weeks held out from training — see Context for method.", size: "11pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 9 }, [
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
    textbox(id(), { x: 32, y: 120, z: z++, height: 100, width: 1856, tabOrder: 3 }, [
      { text: "Audience", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "COO / logistics lead — on-time delivery, seller risk, and demand planning in one book.", size: "12pt" },
    ]),
    textbox(id(), { x: 32, y: 240, z: z++, height: 260, width: 908, tabOrder: 4 }, [
      { text: "Metric definitions", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Population — delivered orders with a non-null delivered date only.", size: "12pt" },
      { text: "On-time — delivered calendar date ≤ estimated delivery calendar date.", size: "12pt" },
      { text: "Lead time — days from purchase to delivered.", size: "12pt" },
      { text: "Seller rank gate — ≥30 delivered orders to appear in the risk queue.", size: "12pt" },
      { text: "In-Full (true OTIF) is out of scope for v1 — this report reports On-time only.", size: "12pt", color: "#B42318" },
    ]),
    textbox(id(), { x: 976, y: 240, z: z++, height: 260, width: 912, tabOrder: 5 }, [
      { text: "Forecast method", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Weekly order counts by purchase week; SARIMAX (weekly seasonality) when available, else seasonal-naive fallback.", size: "11pt" },
      { text: "Backtest holds out the last 12 weeks; forward horizon is 8 weeks with 80%/95% prediction intervals.", size: "11pt" },
      { text: "Holdout MAPE and interval coverage are computed on the held-out weeks and shown on Demand Outlook.", size: "11pt" },
      { text: "This is a demand-volume forecast — not an inventory or safety-stock policy recommendation.", size: "11pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 32, y: 540, z: z++, height: 240, width: 1856, tabOrder: 6 }, [
      { text: "Data & source caveats", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "• Source: Olist Brazilian E-Commerce (Kaggle, CC BY-NC-SA 4.0) — 2016–2018 sample, 100k+ orders.", size: "12pt" },
      { text: "• Grain: delivered orders with a usable purchase / delivered / estimated date only.", size: "12pt" },
      { text: "• Corridors and category mixes are shown at ≥20 orders to avoid noisy single-order routes.", size: "12pt" },
      { text: "• Sample demo — not a production carrier SLA report, and not inventory or safety-stock policy advice.", size: "12pt", color: "#B42318" },
    ]),
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
      pages: {
        landing: PAGES.landing,
        pulse: PAGES.pulse,
        sellers: PAGES.sellers,
        demand: PAGES.demand,
        context: PAGES.context,
      },
      syncGroup: "LogisticsSync_<column>",
      atmosphere: LANDING_ATMOSPHERE,
      report: REPORT,
    },
    null,
    2
  )
);

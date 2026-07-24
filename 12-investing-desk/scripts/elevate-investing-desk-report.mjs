/**
 * Elevate Investment Portfolio report — 7 institutional pages (Nordic Boardroom).
 * Run after scaffold-investing-desk-pbip.mjs
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
const REPORT = path.join(root, "InvestingDesk.Report");
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const FOOTER =
  "Investment Portfolio · Research sims + Nordic tape · Local PBIP · Nordic Boardroom · Not regulated financial advice";
const HEATMAP_WEB_URL =
  process.env.HEATMAP_WEB_URL || "https://heatmap-web-five.vercel.app";
/** 7 visible pages — navigator wider */
const NAV = { x: 1200, y: 12, height: 80, width: 688 };
const LANDING_ATMOSPHERE = "alpine-mist";

const ACCENTS = {
  teal: "#2F5F73",
  copper: "#C17B3A",
  muted: "#5B8FA3",
  danger: "#B42318",
  ok: "#1B7A4E",
  ink: "#0F1C24",
  soft: "#5A6B75",
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
  const meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pj = JSON.parse(
      fs.readFileSync(path.join(REPORT, "definition/pages", pageKey, "page.json"), "utf8")
    );
    byDisplay[pj.displayName] = pageKey;
  }
  const required = [
    "Landing",
    "Asset Allocation",
    "Performance",
    "Holdings & Rebalance",
    "Risk & Mandate",
    "Regional Markets",
    "Notes",
  ];
  for (const name of required) {
    if (!byDisplay[name]) throw new Error(`Missing page ${name}`);
  }
  return {
    landing: byDisplay["Landing"],
    allocation: byDisplay["Asset Allocation"],
    performance: byDisplay["Performance"],
    holdings: byDisplay["Holdings & Rebalance"],
    risk: byDisplay["Risk & Mandate"],
    regional: byDisplay["Regional Markets"],
    notes: byDisplay["Notes"],
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

function pageChrome(pageKey, displayName, outspaceWidth = 0) {
  const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
  fs.writeFileSync(
    pagePath,
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
          outspacePane: [
            {
              properties: {
                width: { expr: { Literal: { Value: `${outspaceWidth}D` } } },
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

function landingChrome(pageKey) {
  ensureLandingAtmosphere(REPORT, LANDING_ATMOSPHERE);
  fs.writeFileSync(
    path.join(REPORT, "definition/pages", pageKey, "page.json"),
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
        labels: [{ properties: { fontSize: litD(56), bold: lit(true), color: solid(accent) } }],
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
              fontSize: litD(9),
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
              fontSize: litD(9),
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

function kpiCard(name, pos, entity, measureName, title, accent) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measure(entity, measureName)] } } },
      objects: {
        labels: [{ properties: { fontSize: litD(26), bold: lit(true), color: solid(accent) } }],
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

function slicer(name, pos, entity, col, title) {
  return {
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

function barChart(name, pos, entity, catCol, measureName, title, sortDir = "Descending", opts = {}) {
  const valueAxis = {
    show: lit(true),
    gridlineShow: lit(opts.hideValueAxis ? false : true),
    labelColor: solid("#5A6B75"),
    fontSize: litD(9),
    showAxisTitle: lit(false),
  };
  if (opts.start != null) valueAxis.start = litD(opts.start);
  if (opts.end != null) valueAxis.end = litD(opts.end);
  if (opts.hideValueAxis) valueAxis.show = lit(false);

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
        sortDefinition: { sort: [sortByMeasureField(entity, measureName, sortDir)] },
      },
      objects: {
        labels: [
          {
            properties: {
              show: lit(opts.showLabels !== false),
              labelDisplayUnits: lit("0"),
              fontSize: litD(10),
              color: solid("#0F1C24"),
              labelPrecision: lit(opts.labelPrecision ?? 2),
            },
          },
        ],
        valueAxis: [{ properties: valueAxis }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [{ properties: { fill: solid(opts.fill || ACCENTS.teal) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function clusteredColumn(name, pos, entity, catCol, measureName, title, opts = {}) {
  const valueAxis = {
    show: lit(true),
    gridlineShow: lit(true),
    labelColor: solid("#5A6B75"),
    fontSize: litD(9),
    showAxisTitle: lit(false),
  };
  if (opts.start != null) valueAxis.start = litD(opts.start);
  if (opts.end != null) valueAxis.end = litD(opts.end);

  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredColumnChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, catCol)] },
          Y: { projections: [measure(entity, measureName)] },
        },
        sortDefinition: { sort: [sortByMeasureField(entity, measureName, "Descending")] },
      },
      objects: {
        labels: [
          {
            properties: {
              show: lit(opts.showLabels !== false),
              labelDisplayUnits: lit("0"),
              fontSize: litD(10),
              color: solid("#0F1C24"),
              labelPrecision: lit(opts.labelPrecision ?? 2),
            },
          },
        ],
        valueAxis: [{ properties: valueAxis }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        dataPoint: [{ properties: { fill: solid(ACCENTS.teal) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function seriesLineChart(name, pos, entity, dateCol, seriesCol, measureName, title, seriesColors = {}) {
  const dataPoint = Object.entries(seriesColors).map(([val, hex]) =>
    scopeColor(entity, seriesCol, val, hex)
  );
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column(entity, dateCol)] },
          Series: { projections: [column(entity, seriesCol)] },
          Y: { projections: [measure(entity, measureName)] },
        },
        sortDefinition: { sort: [sortByColumnField(entity, dateCol, "Ascending")] },
      },
      objects: {
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), labelColor: solid("#5A6B75"), fontSize: litD(9), showAxisTitle: lit(false) } }],
        categoryAxis: [{ properties: { show: lit(true), showAxisTitle: lit(false), labelColor: solid("#5A6B75"), fontSize: litD(9) } }],
        legend: [{ properties: { show: lit(true), position: lit("Top"), fontSize: litD(9) } }],
        lineStyles: [{ properties: { strokeWidth: litD(2.5), showMarker: lit(false) } }],
        ...(dataPoint.length ? { dataPoint } : {}),
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function columnTable(name, pos, entity, cols, title, sort) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: { projections: cols.map((c) => column(entity, c)) },
        },
        ...(sort ? { sortDefinition: { sort: [sort] } } : {}),
      },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: lit("growToFit"), autoSizeColumnWidth: lit(true) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function webUrlButton(name, pos, label, url) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "actionButton",
      objects: {
        icon: [
          {
            properties: {
              show: lit(true),
              shapeType: lit("rightArrow"),
              lineColor: solid("#FFFFFF"),
              lineWeight: litD(2),
            },
            selector: { id: "default" },
          },
        ],
        text: [{ properties: { show: lit(false) }, selector: { id: "default" } }],
        outline: [{ properties: { show: lit(false) }, selector: { id: "default" } }],
        fill: [
          { properties: { show: lit(true), fillColor: solid("#2F5F73"), transparency: litD(0) }, selector: { id: "default" } },
          { properties: { show: lit(true), fillColor: solid("#1E4556"), transparency: litD(0) }, selector: { id: "hover" } },
        ],
      },
      visualContainerObjects: {
        visualLink: [
          {
            properties: {
              show: lit(true),
              type: lit("WebUrl"),
              webUrl: lit(url),
              showDefaultTooltip: lit(true),
              tooltip: lit(label),
            },
          },
        ],
        background: [{ properties: { show: lit(true), color: solid("#2F5F73"), transparency: litD(0) } }],
        border: [{ properties: { show: lit(false) } }],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(label),
              fontSize: litD(11),
              fontColor: solid("#FFFFFF"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [{ properties: { top: litD(8), bottom: litD(8), left: litD(12), right: litD(12) } }],
      },
    },
  };
}

function pageTitle(name, pos, title, subtitle) {
  return textbox(name, pos, [
    { text: title, size: "22pt", font: "Segoe UI Semibold", bold: true },
    ...(subtitle ? [{ text: subtitle, size: "12pt", color: "#5A6B75" }] : []),
  ]);
}

function footerBox(name, pos) {
  return textbox(name, pos, [{ text: FOOTER, size: "9pt", color: "#5A6B75" }]);
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
        PAGES.allocation,
        PAGES.performance,
        PAGES.holdings,
        PAGES.risk,
        PAGES.regional,
        PAGES.notes,
      ],
      activePageName: PAGES.landing,
    },
    null,
    2
  )
);

const PM = "PortfolioMetrics";
const SLV = "DimSleeve";
const CURVE = "FactEquityCurve";
const POL = "FactPolicyCompare";
const HOLD = "FactHolding";
const ACT = "FactRebalanceAction";
const MAN = "DimMandateRule";
const NCO = "DimNordicCompany";
const NPX = "FactNordicPrices";

// Landing
{
  const p = PAGES.landing;
  landingChrome(p);
  clearVisuals(p);
  let z = 0;
  [
    shapeRect(id(), { x: 0, y: 0, z: z++, height: 1080, width: 14, tabOrder: 0 }, ACCENTS.teal),
    shapeRect(id(), { x: 48, y: 140, z: z++, height: 820, width: 1180, tabOrder: 1 }, "#FFFFFF"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 88, y: 180, z: z++, height: 72, width: 1080, tabOrder: 3 }, [
      { text: "Investment Portfolio", size: "40pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 88, y: 260, z: z++, height: 64, width: 1080, tabOrder: 4 }, [
      {
        text: "Multi-sleeve capital policy, performance versus VWCE, holdings & rebalance, mandate compliance, and Nordic regional tape.",
        size: "16pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 88, y: 340, z: z++, height: 4, width: 280, tabOrder: 5 }, ACCENTS.copper),
    editorialHero(
      id(),
      { x: 88, y: 380, z: z++, height: 220, width: 480, tabOrder: 6 },
      PM,
      "Excess CAGR",
      ACCENTS.teal,
      "Excess CAGR vs Core (VWCE)"
    ),
    textbox(id(), { x: 600, y: 390, z: z++, height: 280, width: 560, tabOrder: 7 }, [
      { text: "What you’ll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  Asset Allocation — strategic sleeve map", size: "13pt" },
      { text: "02  Performance — excess return & policy peers", size: "13pt" },
      { text: "03  Holdings & Rebalance — book weights and actions", size: "13pt" },
      { text: "04  Risk & Mandate — vol, drawdown, IPS rules", size: "13pt" },
      { text: "05  Regional Markets — Nordic tape for book names", size: "13pt" },
    ]),
    textbox(id(), { x: 88, y: 640, z: z++, height: 80, width: 1080, tabOrder: 8 }, [
      {
        text: "Audience · CIO / portfolio committee · research simulation book (not client advice)",
        size: "13pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 88, y: 900, z: z++, height: 40, width: 1080, tabOrder: 9 }, [
      { text: FOOTER, size: "9pt", color: "#5A6B75" },
    ]),
  ].forEach((v) => writeVisual(p, v));
}

// Asset Allocation
{
  const p = PAGES.allocation;
  pageChrome(p, "Asset Allocation");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 72, width: 900, tabOrder: 1 }, "Asset Allocation", "Strategic sleeve policy — Core ETF, Mid equity, Short (blocked)"),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 100, width: 220, tabOrder: 2 }, SLV, "Core Sleeve %", "Core weight", ACCENTS.teal),
    kpiCard(id(), { x: 268, y: 100, z: z++, height: 100, width: 220, tabOrder: 3 }, SLV, "Mid Sleeve %", "Mid weight", ACCENTS.muted),
    kpiCard(id(), { x: 504, y: 100, z: z++, height: 100, width: 220, tabOrder: 4 }, SLV, "Active Sleeve %", "Active (Mid+Short)", ACCENTS.copper),
    kpiCard(id(), { x: 740, y: 100, z: z++, height: 100, width: 220, tabOrder: 5 }, PM, "Ring-Fence Weight", "Ring-fence weight", ACCENTS.soft),
    kpiCard(id(), { x: 976, y: 100, z: z++, height: 100, width: 200, tabOrder: 6 }, PM, "Cash Weight", "Cash weight", ACCENTS.ok),
    donutChart(id(), { x: 32, y: 220, z: z++, height: 420, width: 560, tabOrder: 7 }, SLV, "SleeveName", "Sleeve Weight", "Policy allocation by sleeve"),
    barChart(id(), { x: 608, y: 220, z: z++, height: 420, width: 560, tabOrder: 8 }, SLV, "SleeveName", "Sleeve Weight", "Policy weights", "Descending", { labelPrecision: 1 }),
    columnTable(
      id(),
      { x: 1184, y: 220, z: z++, height: 420, width: 704, tabOrder: 9 },
      SLV,
      ["SleeveName", "WeightPct", "Horizon", "AssetClass", "StatusNote"],
      "Sleeve policy detail",
      sortByColumnField(SLV, "SleeveSort", "Ascending")
    ),
    textbox(id(), { x: 32, y: 660, z: z++, height: 80, width: 1856, tabOrder: 10 }, [
      {
        text: "Weights only (no absolute €). Ring-fenced OP capital is context-only and excluded from the active Mid research loop. Short sleeve remains blocked until mandate gates clear.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 11 }),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// Performance
{
  const p = PAGES.performance;
  pageChrome(p, "Performance");
  clearVisuals(p);
  let z = 0;
  [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 72, width: 900, tabOrder: 1 }, "Performance", "Working Mid policy versus Core VWCE benchmark"),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 180, tabOrder: 2 }, PM, "Mid CAGR", "Mid CAGR", ACCENTS.teal),
    kpiCard(id(), { x: 228, y: 100, z: z++, height: 96, width: 180, tabOrder: 3 }, PM, "Core CAGR", "Core CAGR", ACCENTS.muted),
    kpiCard(id(), { x: 424, y: 100, z: z++, height: 96, width: 180, tabOrder: 4 }, PM, "Excess CAGR", "Excess CAGR", ACCENTS.copper),
    kpiCard(id(), { x: 620, y: 100, z: z++, height: 96, width: 180, tabOrder: 5 }, PM, "Mid Sharpe", "Mid Sharpe", ACCENTS.teal),
    kpiCard(id(), { x: 816, y: 100, z: z++, height: 96, width: 180, tabOrder: 6 }, PM, "Mid Max DD", "Mid max DD", ACCENTS.danger),
    kpiCard(id(), { x: 1012, y: 100, z: z++, height: 96, width: 180, tabOrder: 7 }, PM, "Mid Ann Vol", "Mid ann. vol", ACCENTS.soft),
    seriesLineChart(
      id(),
      { x: 32, y: 216, z: z++, height: 400, width: 1100, tabOrder: 8 },
      CURVE,
      "Date",
      "Series",
      "Equity Indexed",
      "Indexed equity (base = 1)",
      {
        "Benchmark (VWCE.DE)": "#5B8FA3",
        "Universe EW B&H": "#C17B3A",
        "Mid top-10 momentum": "#2F5F73",
      }
    ),
    seriesLineChart(
      id(),
      { x: 1152, y: 216, z: z++, height: 400, width: 736, tabOrder: 9 },
      CURVE,
      "Date",
      "Series",
      "Drawdown Pct",
      "Drawdown",
      {
        "Benchmark (VWCE.DE)": "#5B8FA3",
        "Universe EW B&H": "#C17B3A",
        "Mid top-10 momentum": "#2F5F73",
      }
    ),
    clusteredColumn(
      id(),
      { x: 32, y: 636, z: z++, height: 360, width: 1100, tabOrder: 10 },
      POL,
      "ShortLabel",
      "Policy Sharpe",
      "Policy peer set — Sharpe (axis zoomed)",
      { start: 0.95, end: 1.4, showLabels: true, labelPrecision: 2 }
    ),
    barChart(
      id(),
      { x: 1152, y: 636, z: z++, height: 360, width: 736, tabOrder: 11 },
      POL,
      "ShortLabel",
      "Policy Sharpe vs BM",
      "Sharpe vs VWCE (gap)",
      "Descending",
      { showLabels: true, labelPrecision: 2, fill: ACCENTS.copper }
    ),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 12 }),
  ].forEach((v) => writeVisual(p, v));
}

// Holdings & Rebalance
{
  const p = PAGES.holdings;
  pageChrome(p, "Holdings & Rebalance");
  clearVisuals(p);
  let z = 0;
  [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 64, width: 720, tabOrder: 1 }, "Holdings & Rebalance", "Active Mid book — weights, targets, and review actions"),
    slicer(id(), { x: 780, y: 16, z: z++, height: 80, width: 180, tabOrder: 2 }, ACT, "Action", "Action"),
    slicer(id(), { x: 976, y: 16, z: z++, height: 80, width: 180, tabOrder: 3 }, HOLD, "Region", "Region"),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 92, width: 200, tabOrder: 4 }, PM, "Equity Weight", "Equity weight", ACCENTS.teal),
    kpiCard(id(), { x: 248, y: 100, z: z++, height: 92, width: 200, tabOrder: 5 }, PM, "Cash Weight", "Cash weight", ACCENTS.ok),
    kpiCard(id(), { x: 464, y: 100, z: z++, height: 92, width: 200, tabOrder: 6 }, HOLD, "Holding Count", "Names held", ACCENTS.muted),
    kpiCard(id(), { x: 680, y: 100, z: z++, height: 92, width: 200, tabOrder: 7 }, PM, "Top N", "Target top-N", ACCENTS.copper),
    kpiCard(id(), { x: 896, y: 100, z: z++, height: 92, width: 200, tabOrder: 8 }, HOLD, "Nordic Holding Weight", "Nordic weight", ACCENTS.soft),
    columnTable(
      id(),
      { x: 32, y: 208, z: z++, height: 400, width: 1100, tabOrder: 9 },
      HOLD,
      ["Name", "YahooSymbol", "WeightPct", "TargetWeightPct", "DeltaWeightPct", "Mom12m", "Action", "Region"],
      "Holdings book (weights)",
      sortByColumnField(HOLD, "WeightPct", "Descending")
    ),
    barChart(
      id(),
      { x: 1152, y: 208, z: z++, height: 400, width: 736, tabOrder: 10 },
      ACT,
      "Action",
      "Abs Delta Weight",
      "Rebalance |Δ weight| by action",
      "Descending",
      { labelPrecision: 1 }
    ),
    columnTable(
      id(),
      { x: 32, y: 628, z: z++, height: 370, width: 1856, tabOrder: 11 },
      ACT,
      ["Action", "Name", "YahooSymbol", "DeltaWeightPct", "Mom12m", "Rank", "Explanation"],
      "Review actions (weight deltas)",
      sortByColumnField(ACT, "AbsDeltaWeightPct", "Descending")
    ),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 12 }),
  ].forEach((v) => writeVisual(p, v));
}

// Risk & Mandate
{
  const p = PAGES.risk;
  pageChrome(p, "Risk & Mandate");
  clearVisuals(p);
  let z = 0;
  [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 72, width: 1100, tabOrder: 1 }, "Risk & Mandate", "Portfolio risk metrics and investment-policy compliance"),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 220, tabOrder: 2 }, PM, "Mid Ann Vol", "Ann. volatility", ACCENTS.soft),
    kpiCard(id(), { x: 268, y: 100, z: z++, height: 96, width: 220, tabOrder: 3 }, PM, "Mid Max DD", "Max drawdown", ACCENTS.danger),
    kpiCard(id(), { x: 504, y: 100, z: z++, height: 96, width: 220, tabOrder: 4 }, PM, "Mid Sharpe", "Sharpe", ACCENTS.teal),
    kpiCard(id(), { x: 740, y: 100, z: z++, height: 96, width: 220, tabOrder: 5 }, POL, "Policy Turnover", "Ann. one-way turnover", ACCENTS.copper),
    kpiCard(id(), { x: 976, y: 100, z: z++, height: 96, width: 220, tabOrder: 6 }, MAN, "Rules Total", "Mandate rules", ACCENTS.muted),
    clusteredColumn(
      id(),
      { x: 32, y: 216, z: z++, height: 360, width: 900, tabOrder: 7 },
      POL,
      "Label",
      "Policy Vol",
      "Policy set — annualized volatility"
    ),
    clusteredColumn(
      id(),
      { x: 952, y: 216, z: z++, height: 360, width: 936, tabOrder: 8 },
      POL,
      "Label",
      "Policy Max DD",
      "Policy set — max drawdown"
    ),
    columnTable(
      id(),
      { x: 32, y: 596, z: z++, height: 300, width: 1200, tabOrder: 9 },
      MAN,
      ["Category", "RuleId", "Status"],
      "Mandate rules (IPS)",
      sortByColumnField(MAN, "CategorySort", "Ascending")
    ),
    textbox(id(), { x: 1256, y: 596, z: z++, height: 300, width: 632, tabOrder: 10 }, [
      { text: "Review calendar", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "Cadence · semiannual (Apr / Oct)", size: "12pt" },
      { text: "Working policy · mom_semi_max3 (max 3 name changes)", size: "12pt" },
      { text: "Short sleeve · blocked until mid gates + costs modeled", size: "12pt", color: "#B42318" },
      { text: "Live trading requires explicit authorization — never auto-routed.", size: "12pt", color: "#5A6B75" },
    ]),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 11 }),
  ].forEach((v) => writeVisual(p, v));
}

// Regional Markets
{
  const p = PAGES.regional;
  pageChrome(p, "Regional Markets");
  clearVisuals(p);
  let z = 0;
  [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 64, width: 900, tabOrder: 1 }, "Regional Markets", "Nordic Equity tape for mid-universe and book overlap"),
    webUrlButton(id(), { x: 1000, y: 24, z: z++, height: 64, width: 176, tabOrder: 2 }, "Open live board", HEATMAP_WEB_URL),
    kpiCard(id(), { x: 32, y: 100, z: z++, height: 96, width: 240, tabOrder: 3 }, NCO, "Overlap Names", "Mid ∩ Nordic", ACCENTS.teal),
    kpiCard(id(), { x: 288, y: 100, z: z++, height: 96, width: 240, tabOrder: 4 }, NCO, "Book Nordic Names", "Nordic in book", ACCENTS.copper),
    kpiCard(id(), { x: 544, y: 100, z: z++, height: 96, width: 240, tabOrder: 5 }, NPX, "Overlap Day Change", "Overlap day change", ACCENTS.muted),
    kpiCard(id(), { x: 800, y: 100, z: z++, height: 96, width: 240, tabOrder: 6 }, NPX, "RSI Signal Count", "RSI signals (latest)", ACCENTS.danger),
    columnTable(
      id(),
      { x: 32, y: 216, z: z++, height: 480, width: 1100, tabOrder: 7 },
      NCO,
      ["Ticker", "CompanyName", "Country", "Sector", "InMidUniverse", "InBook"],
      "Nordic universe · overlap flags",
      sortByColumnField(NCO, "CompanyName", "Ascending")
    ),
    barChart(
      id(),
      { x: 1152, y: 216, z: z++, height: 480, width: 736, tabOrder: 8 },
      HOLD,
      "Name",
      "Holding Weight",
      "Book weights (incl. Nordic)",
      "Descending",
      { labelPrecision: 1 }
    ),
    textbox(id(), { x: 32, y: 720, z: z++, height: 80, width: 1856, tabOrder: 9 }, [
      {
        text: `Live board · ${HEATMAP_WEB_URL}  ·  Yahoo delayed quotes via Nordic Equity gold  ·  Portfolio weights only (no absolute €).`,
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 10 }),
  ].forEach((v) => writeVisual(p, v));
}

// Notes
{
  const p = PAGES.notes;
  pageChrome(p, "Notes");
  clearVisuals(p);
  let z = 0;
  [
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 0 }),
    pageTitle(id(), { x: 32, y: 16, z: z++, height: 72, width: 1100, tabOrder: 1 }, "Notes", "Methodology, sources, and caveats"),
    kpiCard(id(), { x: 32, y: 110, z: z++, height: 100, width: 280, tabOrder: 2 }, PM, "Fee Bps", "Research fee (bps)", ACCENTS.teal),
    kpiCard(id(), { x: 328, y: 110, z: z++, height: 100, width: 280, tabOrder: 3 }, PM, "Universe N", "Mid universe N", ACCENTS.muted),
    kpiCard(id(), { x: 624, y: 110, z: z++, height: 100, width: 280, tabOrder: 4 }, PM, "Mandate Rule Count", "Mandate rules", ACCENTS.copper),
    textbox(id(), { x: 32, y: 240, z: z++, height: 640, width: 900, tabOrder: 5 }, [
      { text: "Disclaimers", size: "16pt", font: "Segoe UI Semibold", bold: true },
      { text: "Research / engineering portfolio demonstration — not regulated financial advice.", size: "13pt" },
      { text: "Simulated returns ≠ live broker performance. Past is not future.", size: "13pt" },
      { text: "Nordic prices are Yahoo Finance delayed quotes.", size: "13pt" },
      { text: "No automated order routing to Saxo or Nordnet.", size: "13pt" },
      { text: "", size: "10pt" },
      { text: "Sources", size: "16pt", font: "Segoe UI Semibold", bold: true },
      { text: "A · investing research repo — capital.yaml, sim_latest, review, compare_policies", size: "12pt" },
      { text: "B · 01-finance Nordic Equity gold — DimCompany, FactPrices", size: "12pt" },
      { text: "Benchmark · VWCE.DE  ·  Working policy · semiannual momentum max-3", size: "12pt" },
      { text: "Citation · Jegadeesh & Titman momentum literature (research framing)", size: "12pt" },
    ]),
    textbox(id(), { x: 960, y: 240, z: z++, height: 640, width: 920, tabOrder: 6 }, [
      { text: "How to refresh", size: "16pt", font: "Segoe UI Semibold", bold: true },
      { text: "1. Re-run sims / review in the investing repo", size: "13pt" },
      { text: "2. Optional: refresh Nordic Equity gold (01-finance)", size: "13pt" },
      { text: "3. node scripts/export-from-sources.mjs", size: "13pt" },
      { text: "4. Open InvestingDesk.pbip → Refresh in Desktop", size: "13pt" },
      { text: "", size: "10pt" },
      { text: "Out of scope (v1)", size: "16pt", font: "Segoe UI Semibold", bold: true },
      { text: "Live holdings API sync · day-trading blotter · Fabric publish", size: "12pt", color: "#5A6B75" },
      { text: "Composite live model linking NordicEquity.SemanticModel", size: "12pt", color: "#5A6B75" },
    ]),
    footerBox(id(), { x: 32, y: 1020, z: z++, height: 36, width: 1856, tabOrder: 7 }),
  ].forEach((v) => writeVisual(p, v));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      report: REPORT,
      pages: Object.fromEntries(
        Object.entries(PAGES).filter(([k]) => k !== "meta")
      ),
      atmosphere: LANDING_ATMOSPHERE,
      liveBoard: HEATMAP_WEB_URL,
    },
    null,
    2
  )
);

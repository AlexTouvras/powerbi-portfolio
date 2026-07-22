/**
 * Elevate Nordic Equity report to board-ready Nordic Boardroom quality.
 * Landing poster, sector heatmap treemap, ticker explorer with classic indicators, Context facts.
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
const REPORT = path.join(root, "NordicEquity.Report");
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";
const FACT = "FactPrices";
const DIM_CO = "DimCompany";
const DIM_DT = "DimDate";
const FOOTER =
  "Source: Yahoo Finance delayed quotes · Local PBIP · Nordic Boardroom · Classic indicators (SMA/MACD/RSI/BB) · Not investment advice";
/** TradingView-style board (logos + % + sectors). Override with HEATMAP_WEB_URL env if needed. */
const HEATMAP_WEB_URL =
  process.env.HEATMAP_WEB_URL || "https://heatmap-web-five.vercel.app";

function latestSessionDate() {
  const metaPath = path.join(root, "data/gold/build-meta.json");
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.latestDate) return String(meta.latestDate);
  } catch {
    /* fall through */
  }
  return null;
}

/** Four visible pages (Landing + 3 analysis). */
const NAV = { x: 1392, y: 12, height: 80, width: 496 };
const SL = {
  country: { x: 900, y: 12, height: 80, width: 176 },
  sector: { x: 1088, y: 12, height: 80, width: 176 },
  ticker: { x: 900, y: 12, height: 80, width: 280 },
};

const ACCENTS = {
  advancers: "#2F5F73",
  decliners: "#B42318",
  change: "#C17B3A",
  marketCap: "#3D5A6C",
  universe: "#5B8FA3",
  close: "#2F5F73",
  rsi: "#7A6A8A",
  volume: "#4A6B5C",
};

const LANDING_ATMOSPHERE = "harbor-mist";

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

function pageDisplayMap(meta) {
  const byDisplay = {};
  const pagesDir = path.join(REPORT, "definition/pages");
  for (const ent of fs.readdirSync(pagesDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ent.name.startsWith("ReportSection")) continue;
    const pagePath = path.join(pagesDir, ent.name, "page.json");
    if (!fs.existsSync(pagePath)) continue;
    const pj = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    byDisplay[pj.displayName] = ent.name;
  }
  // Prefer pageOrder keys when present
  for (const pageKey of meta.pageOrder || []) {
    const pagePath = path.join(pagesDir, pageKey, "page.json");
    if (!fs.existsSync(pagePath)) continue;
    const pj = JSON.parse(fs.readFileSync(pagePath, "utf8"));
    byDisplay[pj.displayName] = pageKey;
  }
  return byDisplay;
}

function ensureNamedPage(meta, displayName) {
  const byDisplay = pageDisplayMap(meta);
  if (byDisplay[displayName]) return byDisplay[displayName];
  const key = "ReportSection" + crypto.randomBytes(12).toString("hex");
  const dir = path.join(REPORT, "definition/pages", key);
  fs.mkdirSync(path.join(dir, "visuals"), { recursive: true });
  pageChrome(key, displayName);
  if (!meta.pageOrder.includes(key)) meta.pageOrder.push(key);
  return key;
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

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  if (!fs.existsSync(pagesPath)) {
    throw new Error(`Missing ${pagesPath}`);
  }
  const meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  ensureNamedPage(meta, "Signal Desk");
  const byDisplay = pageDisplayMap(meta);
  const required = [
    "Landing",
    "Nordic Heatmap",
    "Ticker Explorer",
    "Signal Desk",
    "Context",
  ];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  meta.pageOrder = [
    byDisplay["Landing"],
    byDisplay["Nordic Heatmap"],
    byDisplay["Ticker Explorer"],
    byDisplay["Signal Desk"],
    byDisplay["Context"],
  ];
  meta.activePageName = byDisplay["Landing"];
  writePagesMeta(meta);
  return {
    landing: byDisplay["Landing"],
    heatmap: byDisplay["Nordic Heatmap"],
    explorer: byDisplay["Ticker Explorer"],
    signals: byDisplay["Signal Desk"],
    context: byDisplay["Context"],
    meta,
  };
}

const PAGES = resolvePages();

function clearVisuals(pageName) {
  const dir = path.join(REPORT, "definition/pages", pageName, "visuals");
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
function writeVisual(pageName, visual) {
  const dir = path.join(
    REPORT,
    "definition/pages",
    pageName,
    "visuals",
    visual.name
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
}

function pageChrome(pageKey, displayName) {
  fs.writeFileSync(
    path.join(REPORT, "definition/pages", pageKey, "page.json"),
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

function shapeRect(name, pos, fillHex) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "shape",
      objects: {
        shape: [{ properties: { tileShape: lit("rectangle") } }],
        fill: [
          {
            properties: {
              fillColor: solid(fillHex),
              transparency: litD(0),
            },
            selector: { id: "default" },
          },
        ],
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
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

function editorialHero(name, pos, measureName, accent, caption, opts = {}) {
  const fontSize = opts.fontSize ?? 64;
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measure(FACT, measureName)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(fontSize),
              bold: lit(true),
              color: solid(accent),
            },
          },
        ],
        categoryLabels: [{ properties: { show: lit(false) } }],
      },
      visualContainerObjects: {
        background: [
          {
            properties: {
              show: lit(true),
              color: solid("#FFFFFF"),
              transparency: litD(18),
            },
          },
        ],
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
        padding: [
          {
            properties: {
              top: litD(16),
              bottom: litD(16),
              left: litD(20),
              right: litD(20),
            },
          },
        ],
      },
    },
  };
}

/** Opens the Vercel TradingView-style board. Text labels blank on this Desktop
 *  build for actionButton — use icon + container title instead. */
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
        text: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        outline: [
          {
            properties: {
              show: lit(false),
              weight: litD(0),
              lineColor: solid("#2F5F73"),
            },
            selector: { id: "default" },
          },
        ],
        fill: [
          {
            properties: {
              show: lit(true),
              fillColor: solid("#2F5F73"),
              transparency: litD(0),
            },
            selector: { id: "default" },
          },
          {
            properties: {
              show: lit(true),
              fillColor: solid("#1E4556"),
              transparency: litD(0),
            },
            selector: { id: "hover" },
          },
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
        background: [
          {
            properties: {
              show: lit(true),
              color: solid("#2F5F73"),
              transparency: litD(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#2F5F73"),
              radius: litD(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(label),
              fontSize: litD(12),
              fontColor: solid("#FFFFFF"),
              fontFamily: lit("Segoe UI Semibold"),
              alignment: lit("center"),
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
}

function simpleCard(name, pos, measureName, accent, label, opts = {}) {
  // Use legacy `card` (Values role) — cardVisual callouts render blank on this
  // Desktop build for Nordic Equity; Landing hero already uses `card` successfully.
  const fontSize = opts.fontSize ?? 28;
  const showCategory = opts.hideCategory ? false : true;
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measure(FACT, measureName)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(fontSize),
              bold: lit(true),
              color: solid(accent),
            },
          },
        ],
        categoryLabels: [
          {
            properties: {
              show: lit(showCategory),
              color: solid("#5A6B75"),
              fontSize: litD(10),
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
              text: lit(label),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
              fontFamily: lit("Segoe UI Semibold"),
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

function slicerDropdown(name, pos, entity, col, title, syncGroup, opts = {}) {
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
        selection: [
          {
            properties: {
              strictSingleSelect: lit(!!opts.strictSingleSelect),
              selectAllCheckboxEnabled: lit(false),
              singleSelect: lit(true),
            },
          },
        ],
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
  if (opts.defaultValue != null) {
    const alias = "s";
    v.visual.objects.general = [
      {
        properties: {
          filter: {
            filter: {
              Version: 2,
              From: [{ Name: alias, Entity: entity, Type: 0 }],
              Where: [
                {
                  Condition: {
                    In: {
                      Expressions: [
                        {
                          Column: {
                            Expression: { SourceRef: { Source: alias } },
                            Property: col,
                          },
                        },
                      ],
                      Values: [
                        [{ Literal: { Value: `'${String(opts.defaultValue).replace(/'/g, "''")}'` } }],
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    ];
  }
  if (syncGroup) {
    v.visual.syncGroup = {
      groupName: syncGroup,
      fieldChanges: true,
      filterChanges: true,
    };
  }
  return v;
}

function categoricalFilter(entity, colName, values, { numeric = false } = {}) {
  const alias = "f";
  return {
    name: "Filter" + crypto.randomBytes(12).toString("hex"),
    field: {
      Column: {
        Expression: { SourceRef: { Entity: entity } },
        Property: colName,
      },
    },
    type: "Categorical",
    filter: {
      Version: 2,
      From: [{ Name: alias, Entity: entity, Type: 0 }],
      Where: [
        {
          Condition: {
            In: {
              Expressions: [
                {
                  Column: {
                    Expression: { SourceRef: { Source: alias } },
                    Property: colName,
                  },
                },
              ],
              Values: values.map((v) => [
                {
                  Literal: {
                    Value: numeric ? `${v}L` : `'${String(v).replace(/'/g, "''")}'`,
                  },
                },
              ]),
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

function cardContainer(title) {
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
    title: [
      {
        properties: {
          show: lit(true),
          text: lit(title),
          fontSize: litD(12),
          fontColor: solid("#0F1C24"),
          fontFamily: lit("Segoe UI Semibold"),
        },
      },
    ],
    visualHeader: [{ properties: { show: lit(false) } }],
    padding: [
      {
        properties: {
          top: litD(8),
          bottom: litD(8),
          left: litD(8),
          right: litD(8),
        },
      },
    ],
  };
}

function lineChart(name, pos, catEntity, catCol, measureSpecs, title) {
  const colors = ["#2F5F73", "#C17B3A", "#5B8FA3", "#7A6A8A", "#4A6B5C"];
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: {
            projections: measureSpecs.map(([entity, mName]) => measure(entity, mName)),
          },
        },
      },
      objects: {
        dataPoint: measureSpecs.map((_, i) => ({
          properties: {
            fill: solid(colors[i % colors.length]),
          },
          selector: { metadata: measureSpecs[i][1] },
        })),
        labels: [{ properties: { show: lit(false) } }],
        lineStyles: [
          {
            properties: {
              strokeWidth: litD(2.5),
              showMarker: lit(false),
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
        valueAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              gridlineShow: lit(true),
              gridlineColor: solid("#E8EEF2"),
              gridlineStyle: lit("solid"),
            },
          },
        ],
        legend: [
          {
            properties: {
              show: lit(measureSpecs.length > 1),
              fontSize: litD(9),
              labelColor: solid("#5A6B75"),
            },
          },
        ],
      },
      visualContainerObjects: cardContainer(title),
    },
  };
}

function columnChart(name, pos, catEntity, catCol, measureEntity, measureName, title) {
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
      },
      objects: {
        dataPoint: [
          {
            properties: {
              fill: solid("#4A6B5C"),
            },
          },
        ],
        labels: [{ properties: { show: lit(false) } }],
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
              gridlineColor: solid("#E8EEF2"),
            },
          },
        ],
      },
      visualContainerObjects: cardContainer(title),
    },
  };
}

/**
 * Movers list: dim + measure must use pivotTable (not tableEx).
 * Mixing Column + Measure in tableEx Values crashes Desktop PivotTableVisuals
 * (getColumnIndexFromQueryName / queryName undefined).
 */
function topNFilter(entity, colName, orderCol, top, direction) {
  // Direction: 2 = Top, 1 = Bottom. OrderBy must Aggregation(column), not Measure.
  const alias = "t";
  return {
    name: "Filter" + crypto.randomBytes(12).toString("hex"),
    field: {
      Column: {
        Expression: { SourceRef: { Entity: entity } },
        Property: colName,
      },
    },
    type: "TopN",
    filter: {
      Version: 2,
      From: [
        {
          Name: "subquery",
          Expression: {
            Subquery: {
              Query: {
                Version: 2,
                From: [{ Name: alias, Entity: entity, Type: 0 }],
                Select: [
                  {
                    Column: {
                      Expression: { SourceRef: { Source: alias } },
                      Property: colName,
                    },
                    Name: "field",
                  },
                ],
                OrderBy: [
                  {
                    Direction: direction,
                    Expression: {
                      Aggregation: {
                        Expression: {
                          Column: {
                            Expression: { SourceRef: { Source: alias } },
                            Property: orderCol,
                          },
                        },
                        Function: 1,
                      },
                    },
                  },
                ],
                Top: top,
              },
            },
          },
          Type: 2,
        },
        { Name: alias, Entity: entity, Type: 0 },
      ],
      Where: [
        {
          Condition: {
            In: {
              Expressions: [
                {
                  Column: {
                    Expression: { SourceRef: { Source: alias } },
                    Property: colName,
                  },
                },
              ],
              Table: { SourceRef: { Source: "subquery" } },
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

function moversMatrix(name, pos, rowCols, valueMeasures, title, sortMeasure, opts = {}) {
  const measuresList = Array.isArray(valueMeasures[0])
    ? valueMeasures
    : [valueMeasures];
  const sortDir = opts.sortDirection === "Ascending" ? "Ascending" : "Descending";
  const sortDef = sortMeasure
    ? {
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: sortMeasure[0] } },
                  Property: sortMeasure[1],
                },
              },
              direction: sortDir,
            },
          ],
        },
      }
    : {};
  const vco = cardContainer(title);
  vco.stylePreset = [
    { properties: { name: lit("None") } },
  ];
  const visual = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: {
            projections: rowCols.map(([entity, colName]) =>
              column(entity, colName)
            ),
          },
          Values: {
            projections: measuresList.map(([entity, mName]) =>
              measure(entity, mName)
            ),
          },
        },
        ...sortDef,
      },
      objects: {
        columnHeaders: [
          {
            properties: {
              fontColor: solid("#0F1C24"),
              fontSize: litD(9),
              bold: lit(true),
              autoSizeColumnWidth: lit(true),
              columnAdjustment: lit("growToFit"),
            },
          },
        ],
        rowHeaders: [
          {
            properties: {
              fontColor: solid("#0F1C24"),
              fontSize: litD(9),
            },
          },
        ],
        values: [
          {
            properties: {
              fontSize: litD(9),
              fontColorPrimary: solid("#0F1C24"),
              fontColorSecondary: solid("#0F1C24"),
            },
          },
        ],
        subTotals: [
          {
            properties: {
              rowSubtotals: lit(false),
              columnSubtotals: lit(false),
            },
          },
        ],
      },
      visualContainerObjects: vco,
    },
  };
  if (opts.filterConfig) {
    visual.filterConfig = opts.filterConfig;
  }
  return visual;
}

function hierarchyRoot(entity, hierarchyName) {
  return {
    field: {
      Hierarchy: {
        Expression: { SourceRef: { Entity: entity } },
        Hierarchy: hierarchyName,
      },
    },
    queryRef: `${entity}.${hierarchyName}`,
    nativeQueryRef: hierarchyName,
    active: true,
  };
}

function hierarchyLevelField(entity, hierarchyName, levelName) {
  return {
    HierarchyLevel: {
      Expression: {
        Hierarchy: {
          Expression: { SourceRef: { Entity: entity } },
          Hierarchy: hierarchyName,
        },
      },
      Level: levelName,
    },
  };
}

function treemap(name, pos, title) {
  // Flat Ticker group + color scale. Hierarchy Sector→Ticker often blanks on this
  // Desktop build after model calc refreshes; Ticker alone stays reliable.
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "treemap",
      query: {
        queryState: {
          Group: { projections: [column(DIM_CO, "Ticker")] },
          Values: { projections: [measure(FACT, "Market Cap Latest EURm")] },
          Tooltips: {
            projections: [
              measure(FACT, "Day Change % Latest"),
              // Sector as tooltip needs Aggregation — use measure path only
            ],
          },
        },
      },
      objects: {
        layout: [
          {
            properties: {
              tilingMethod: lit("stableSquarified"),
              innerPadding: litD(2),
              outerPadding: litD(4),
            },
          },
        ],
        dataPoint: [
          {
            properties: {
              fill: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: {
                          Measure: {
                            Expression: { SourceRef: { Entity: FACT } },
                            Property: "Day Change % Latest",
                          },
                        },
                        FillRule: {
                          linearGradient3: {
                            min: {
                              color: { Literal: { Value: "'#B71C1C'" } },
                              value: { Literal: { Value: "-4D" } },
                            },
                            mid: {
                              color: { Literal: { Value: "'#607D8B'" } },
                              value: { Literal: { Value: "0D" } },
                            },
                            max: {
                              color: { Literal: { Value: "'#1B5E20'" } },
                              value: { Literal: { Value: "4D" } },
                            },
                            nullColoringStrategy: {
                              strategy: { Literal: { Value: "'asZero'" } },
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
              data: [{ dataViewWildcard: { matchingOption: 0 } }],
            },
          },
        ],
        labels: [{ properties: { show: lit(false) } }],
        categoryLabels: [
          {
            properties: {
              show: lit(true),
              fontSize: litD(11),
              bold: lit(true),
              fontFamily: lit("Segoe UI Semibold"),
              color: solid("#FFFFFF"),
            },
          },
        ],
        legend: [{ properties: { show: lit(false) } }],
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
              fontSize: litD(12),
              fontColor: solid("#5A6B75"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(8),
              bottom: litD(8),
              left: litD(8),
              right: litD(8),
            },
          },
        ],
      },
    },
  };
}

function buildLanding() {
  const p = PAGES.landing;
  landingChrome(p);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    shapeRect(id(), { x: 0, y: 0, z: z++, height: 1080, width: 14, tabOrder: 0 }, "#2F5F73"),
    shapeRect(id(), { x: 56, y: 112, z: z++, height: 900, width: 1808, tabOrder: 1 }, "#FFFFFF"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 96, y: 160, z: z++, height: 88, width: 1100, tabOrder: 3 }, [
      {
        text: "Nordic Equity",
        font: "Segoe UI Semibold",
        size: "40pt",
        bold: true,
      },
    ]),
    textbox(id(), { x: 96, y: 256, z: z++, height: 72, width: 1100, tabOrder: 4 }, [
      {
        text: "Live Nordic board with classic day-trading indicators — sector heatmap, ticker drill-down, and session mood at a glance.",
        font: "Segoe UI",
        size: "18pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 96, y: 348, z: z++, height: 4, width: 280, tabOrder: 5 }, "#B87333"),
    editorialHero(
      id(),
      { x: 1280, y: 180, z: z++, height: 220, width: 520, tabOrder: 6 },
      "Strategy Cumulative Card",
      ACCENTS.volume,
      "EW cumulative return %",
      { fontSize: 36 }
    ),
    textbox(id(), { x: 96, y: 400, z: z++, height: 36, width: 1100, tabOrder: 7 }, [
      {
        text: "Audience · investors / analysts",
        font: "Segoe UI",
        size: "14pt",
        color: "#0F1C24",
      },
    ]),
    textbox(id(), { x: 96, y: 480, z: z++, height: 240, width: 1100, tabOrder: 8 }, [
      {
        text: "What you'll see",
        font: "Segoe UI Semibold",
        size: "16pt",
        bold: true,
      },
      { text: "01  Nordic Heatmap — sector treemap sized by market cap", size: "15pt" },
      { text: "02  Ticker Explorer — single-ticker price, volume, and technicals", size: "15pt" },
      { text: "03  Signal Desk — RSI long/short queue + next-day hit rate", size: "15pt" },
      { text: "04  Context — data delay, indicators, and caveats", size: "15pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 96, y: 760, z: z++, height: 100, width: 1100, tabOrder: 9 }, [
      {
        text: "Signature",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      {
        text: "TradingView-style heatmap, single-ticker explorer, and an RSI mean-reversion signal desk (rules-based — not ML).",
        font: "Segoe UI",
        size: "14pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 96, y: 960, z: z++, height: 28, width: 1700, tabOrder: 10 }, [
      { text: FOOTER, font: "Segoe UI", size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

function buildHeatmap() {
  const p = PAGES.heatmap;
  pageChrome(p, "Nordic Heatmap");
  clearVisuals(p);
  let z = 0;
  const gap = 16;
  const w = 352;
  const x0 = 32;
  const yKpi = 104;
  const hKpi = 112;
  const kpis = [
    ["Advancers", ACCENTS.advancers, "Advancers"],
    ["Decliners", ACCENTS.decliners, "Decliners"],
    ["Avg Day Change %", ACCENTS.change, "Avg day change %"],
    ["Market Cap Latest EURm", ACCENTS.marketCap, "Market cap (EURm)"],
    ["Universe Count", ACCENTS.universe, "Universe count"],
  ];

  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Nordic Heatmap — Sector performance at a glance",
        font: "Segoe UI Semibold",
        size: "18pt",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 860, tabOrder: 1 }, [
      {
        text: "Fallback treemap below · Full logos / % / sector zoom → live board button",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicerDropdown(
      id(),
      { x: 720, y: 12, height: 80, width: 160, z: z++, tabOrder: 2 },
      DIM_CO,
      "Country",
      "Country",
      "NordicSync"
    ),
    slicerDropdown(
      id(),
      { x: 892, y: 12, height: 80, width: 160, z: z++, tabOrder: 3 },
      DIM_CO,
      "Sector",
      "Sector",
      "NordicSync"
    ),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    ...kpis.map(([m, accent, label], i) =>
      simpleCard(
        id(),
        {
          x: x0 + i * (w + gap),
          y: yKpi,
          z: z++,
          height: hKpi,
          width: w,
          tabOrder: 5 + i,
        },
        m,
        accent,
        label
      )
    ),
    webUrlButton(
      id(),
      { x: 32, y: 228, z: z++, height: 48, width: 420, tabOrder: 11 },
      "Open live board →",
      HEATMAP_WEB_URL
    ),
    textbox(id(), { x: 468, y: 236, z: z++, height: 32, width: 1040, tabOrder: 12 }, [
      {
        text: `${HEATMAP_WEB_URL}  ·  logos · % · click sector to zoom · All to reset`,
        font: "Segoe UI Semibold",
        size: "11pt",
        color: "#2F5F73",
      },
    ]),
    treemap(
      id(),
      { x: 32, y: 288, z: z++, height: 716, width: 1488, tabOrder: 13 },
      "Fallback board — size = market cap · color = day change % · ticker tiles"
    ),
    moversMatrix(
      id(),
      { x: 1536, y: 288, z: z++, height: 348, width: 352, tabOrder: 14 },
      [[DIM_CO, "Ticker"]],
      [FACT, "Day Change % Latest"],
      "Top 10 movers",
      [FACT, "Day Change % Latest"],
      {
        sortDirection: "Descending",
        filterConfig: {
          filters: [topNFilter(DIM_CO, "Ticker", "Latest Change %", 10, 2)],
        },
      }
    ),
    moversMatrix(
      id(),
      { x: 1536, y: 652, z: z++, height: 352, width: 352, tabOrder: 15 },
      [[DIM_CO, "Ticker"]],
      [FACT, "Day Change % Latest"],
      "Worst 10 movers",
      [FACT, "Day Change % Latest"],
      {
        sortDirection: "Ascending",
        filterConfig: {
          filters: [topNFilter(DIM_CO, "Ticker", "Latest Change %", 10, 1)],
        },
      }
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 16 }, [
      {
        text: `${FOOTER} · Live board: ${HEATMAP_WEB_URL}`,
        font: "Segoe UI",
        size: "9pt",
        color: "#6B7C86",
      },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

function buildExplorer() {
  const p = PAGES.explorer;
  pageChrome(p, "Ticker Explorer");
  clearVisuals(p);
  let z = 0;
  const gap = 16;
  const w = 448;
  const x0 = 32;
  const cards = [
    ["Last Close", ACCENTS.close, "Last close"],
    ["Last Change %", ACCENTS.change, "Last change %"],
    ["Last RSI", ACCENTS.rsi, "Last RSI (14)"],
    ["Last Volume", ACCENTS.volume, "Last volume"],
  ];

  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Ticker Explorer",
        font: "Segoe UI Semibold",
        size: "18pt",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Pick one ticker — charts require a single selection (not All).",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicerDropdown(
      id(),
      { ...SL.ticker, z: z++, tabOrder: 2 },
      DIM_CO,
      "Ticker",
      "Ticker (single)",
      "NordicTicker",
      { strictSingleSelect: true, defaultValue: "NOKIA" }
    ),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 3 }),
    ...cards.map(([m, accent, label], i) =>
      simpleCard(
        id(),
        {
          x: x0 + i * (w + gap),
          y: 104,
          z: z++,
          height: 112,
          width: w,
          tabOrder: 4 + i,
        },
        m,
        accent,
        label
      )
    ),
    lineChart(
      id(),
      { x: 32, y: 224, z: z++, height: 400, width: 1184, tabOrder: 8 },
      DIM_DT,
      "Date",
      [
        [FACT, "Close Price"],
        [FACT, "SMA 20"],
        [FACT, "SMA 50"],
      ],
      "Price — close with SMA 20 / SMA 50"
    ),
    columnChart(
      id(),
      { x: 32, y: 640, z: z++, height: 200, width: 1184, tabOrder: 9 },
      DIM_DT,
      "Date",
      FACT,
      "Volume Sum",
      "Volume by date"
    ),
    lineChart(
      id(),
      { x: 1232, y: 224, z: z++, height: 616, width: 656, tabOrder: 10 },
      DIM_DT,
      "Date",
      [
        [FACT, "RSI 14"],
        [FACT, "MACD Line"],
        [FACT, "MACD Signal"],
      ],
      "RSI 14 and MACD line / signal"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, font: "Segoe UI", size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

function buildSignalDesk() {
  const p = PAGES.signals;
  pageChrome(p, "Signal Desk");
  clearVisuals(p);
  let z = 0;
  const gap = 16;
  const w = 296;
  const x0 = 32;
  const asOf = latestSessionDate() || "latest session";
  const kpis = [
    ["Long Signals Card", ACCENTS.advancers, `Long signals · ${asOf}`, { fontSize: 18, hideCategory: true }],
    ["Short Signals Card", ACCENTS.decliners, `Short signals · ${asOf}`, { fontSize: 18, hideCategory: true }],
    ["Long Hit Rate %", ACCENTS.close, "Long hit rate %"],
    ["Short Hit Rate %", ACCENTS.change, "Short hit rate %"],
    ["Strategy EW Avg Return %", ACCENTS.marketCap, "EW avg return % / bet"],
    ["Strategy Cumulative Card", ACCENTS.volume, "EW cumulative return %", { fontSize: 15, hideCategory: true }],
  ];

  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Signal Desk — RSI mean-reversion long / short",
        font: "Segoe UI Semibold",
        size: "18pt",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1400, tabOrder: 1 }, [
      {
        text: `Session ${asOf} · Long RSI≤30 · Short RSI≥70 · Equal-weight backtest (short P&L = −next-day %).`,
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    ...kpis.map(([m, accent, label, opts], i) =>
      simpleCard(
        id(),
        {
          x: x0 + i * (w + gap),
          y: 104,
          z: z++,
          height: 112,
          width: w,
          tabOrder: 3 + i,
        },
        m,
        accent,
        label,
        opts
      )
    ),
    moversMatrix(
      id(),
      { x: 32, y: 240, z: z++, height: 380, width: 912, tabOrder: 10 },
      [
        [DIM_CO, "Ticker"],
        [DIM_CO, "CompanyName"],
      ],
      [
        [FACT, "Last RSI"],
        [FACT, "Last Close"],
        [FACT, "Last Change %"],
      ],
      `${asOf} — Long candidates (RSI ≤ 30)`,
      [FACT, "Last RSI"],
      {
        sortDirection: "Ascending",
        filterConfig: {
          filters: [
            categoricalFilter(FACT, "IsLatest", [1], { numeric: true }),
            categoricalFilter(FACT, "StrategySide", ["Long"]),
          ],
        },
      }
    ),
    moversMatrix(
      id(),
      { x: 960, y: 240, z: z++, height: 380, width: 928, tabOrder: 11 },
      [
        [DIM_CO, "Ticker"],
        [DIM_CO, "CompanyName"],
      ],
      [
        [FACT, "Last RSI"],
        [FACT, "Last Close"],
        [FACT, "Last Change %"],
      ],
      `${asOf} — Short candidates (RSI ≥ 70)`,
      [FACT, "Last RSI"],
      {
        sortDirection: "Descending",
        filterConfig: {
          filters: [
            categoricalFilter(FACT, "IsLatest", [1], { numeric: true }),
            categoricalFilter(FACT, "StrategySide", ["Short"]),
          ],
        },
      }
    ),
    lineChart(
      id(),
      { x: 32, y: 636, z: z++, height: 260, width: 920, tabOrder: 12 },
      DIM_DT,
      "Date",
      [[FACT, "Strategy Day Return %"]],
      "Equal-weight day return % (avg across that day’s bets)"
    ),
    lineChart(
      id(),
      { x: 968, y: 636, z: z++, height: 260, width: 920, tabOrder: 13 },
      DIM_DT,
      "Date",
      [[FACT, "Strategy Cumulative Return %"]],
      "Equal-weight cumulative return % (compounded)"
    ),
    textbox(id(), { x: 32, y: 912, z: z++, height: 28, width: 1856, tabOrder: 14 }, [
      {
        text:
          "Candidates are for the latest session date above · Backtest = equal weight on every Long/Short · Cumulative card shows span in days · Not investment advice",
        font: "Segoe UI",
        size: "9pt",
        color: "#6B7C86",
      },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

function buildContext() {
  const p = PAGES.context;
  pageChrome(p, "Context");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Context — Reference",
        font: "Segoe UI Semibold",
        size: "18pt",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Facts and caveats only. Landing is the open; this page is documentation.",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 32, y: 120, z: z++, height: 120, width: 1856, tabOrder: 3 }, [
      {
        text: "Data delay & source",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      {
        text: "Prices are delayed Yahoo Finance quotes — end-of-day / near-live, not tick-by-tick streaming.",
        size: "12pt",
      },
      {
        text: "Universe: curated large caps from FI / SE / DK / NO (OMXH, OMXS, OMXC, OBX).",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 280, z: z++, height: 320, width: 900, tabOrder: 4 }, [
      {
        text: "Indicators (computed in gold / DAX)",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      { text: "SMA 20 / SMA 50 — simple moving averages on close.", size: "12pt" },
      { text: "EMA 12 / EMA 26 — exponential MAs; inputs to MACD.", size: "12pt" },
      { text: "MACD (12, 26, 9) — line, signal, and histogram.", size: "12pt" },
      { text: "RSI 14 — relative strength index with 30 / 70 guides.", size: "12pt" },
      { text: "Bollinger Bands (20, 2σ) — mid, upper, and lower bands.", size: "12pt" },
    ]),
    textbox(id(), { x: 976, y: 280, z: z++, height: 320, width: 912, tabOrder: 5 }, [
      {
        text: "Scope & refresh",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      {
        text: "RSI Signal Desk is rules-based (RSI ≤30 Long / ≥70 Short) with next-day hit rates — not an ML forecast.",
        size: "12pt",
      },
      {
        text: "Not investment advice — portfolio demonstration only.",
        size: "12pt",
      },
      {
        text: "Refresh gold data: node scripts/build-gold.mjs — then refresh the semantic model in Desktop.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 640, z: z++, height: 160, width: 1856, tabOrder: 6 }, [
      {
        text: "How to read the pages",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      {
        text: "Heatmap — tiles sized by market cap; color = day change % (red loss → green gain).",
        size: "12pt",
      },
      {
        text: "Explorer — single ticker only; price / SMA / volume / RSI / MACD.",
        size: "12pt",
      },
      {
        text: "Signal Desk — today's long/short candidates from RSI extremes; hit rate vs next session close.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 7 }, [
      { text: FOOTER, font: "Segoe UI", size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

const reportPath = path.join(REPORT, "definition/report.json");
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.settings = {
    useStylableVisualContainerHeader: true,
    exportDataMode: "AllowSummarized",
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

buildLanding();
buildHeatmap();
buildExplorer();
buildSignalDesk();
buildContext();

console.log(JSON.stringify({ ok: true, pages: PAGES }, null, 2));

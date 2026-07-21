/**
 * Elevate Churn Retention report to match Sales Executive Nordic Boardroom format.
 * Reads page IDs from pages.json; Landing first, Context last when missing.
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
const REPORT = path.join(root, "ChurnRetention.Report");
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";
const T = "DimCustomer";
const FOOTER =
  "Source: Judithokon e-commerce churn sample · Local PBIP · Nordic Boardroom · Propensity = logistic sample model";
/** Five visible pages (Landing + 3 analysis + Context) — slicers end before NAV. */
const NAV = { x: 1448, y: 12, height: 80, width: 440 };
const SL = {
  a: { x: 860, y: 12, height: 80, width: 176 },
  b: { x: 1048, y: 12, height: 80, width: 176 },
  c: { x: 1236, y: 12, height: 80, width: 192 },
};

const ACCENTS = {
  churn: "#B42318",
  customers: "#2F5F73",
  propensity: "#C17B3A",
  highRisk: "#A67C52",
  retained: "#1B7A4E",
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
function measure(name) {
  return {
    field: {
      Measure: {
        Expression: { SourceRef: { Entity: T } },
        Property: name,
      },
    },
    queryRef: `${T}.${name}`,
    nativeQueryRef: name,
  };
}
function column(name, active = true) {
  const p = {
    field: {
      Column: {
        Expression: { SourceRef: { Entity: T } },
        Property: name,
      },
    },
    queryRef: `${T}.${name}`,
    nativeQueryRef: name,
  };
  if (active) p.active = true;
  return p;
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
  if (!landingKey) {
    landingKey = createBlankPage("Landing");
    meta.pageOrder = [landingKey, ...meta.pageOrder];
  } else {
    meta.pageOrder = [landingKey, ...meta.pageOrder.filter((k) => k !== landingKey)];
  }
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
    throw new Error(`Missing ${pagesPath}`);
  }
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  meta = ensureLandingPage(meta);
  meta = ensureContextPage(meta);
  const byDisplay = pageDisplayMap(meta);
  const required = [
    "Landing",
    "Retention Pulse",
    "Churn Drivers",
    "At-Risk Queue",
    "Context",
  ];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  meta.activePageName = byDisplay["Landing"];
  writePagesMeta(meta);
  return {
    landing: byDisplay["Landing"],
    pulse: byDisplay["Retention Pulse"],
    drivers: byDisplay["Churn Drivers"],
    queue: byDisplay["At-Risk Queue"],
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
  const dir = path.join(REPORT, "definition/pages", pageName, "visuals", visual.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
}

function pageChrome(pageKey, displayName) {
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

const LANDING_ATMOSPHERE = "alpine-mist";

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
          outspacePane: [
            {
              properties: {
                width: { expr: { Literal: { Value: "0D" } } },
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

function editorialHero(name, pos, measureName, accent, caption) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measure(measureName)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(64),
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

function dropdownSlicer(name, pos, col, title, syncGroup) {
  const v = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: {
        queryState: {
          Values: { projections: [column(col)] },
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
    v.visual.syncGroup = {
      groupName: syncGroup,
      fieldChanges: true,
      filterChanges: true,
    };
  }
  return v;
}

function classicCard(name, pos, measureName, title, accent) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measure(measureName)] },
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

function barChart(name, pos, catCol, measureName, title, hue, tint) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(catCol)] },
          Y: { projections: [measure(measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: T } },
                  Property: measureName,
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      objects: {
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
                            Expression: { SourceRef: { Entity: T } },
                            Property: measureName,
                          },
                        },
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
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
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
      },
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
          Target: { projections: [column("Churn")] },
          ExplainBy: { projections: explainCols.map((c) => column(c)) },
        },
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
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
              text: lit("Key influencers — what drives churn?"),
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
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
          Analyze: { projections: [measure("Churn Rate")] },
          ExplainBy: {
            projections: [
              column("RiskBand"),
              column("TenureBand"),
              column("PreferredPaymentMode"),
              column("CityTier"),
              column("SatisfactionScore"),
            ],
          },
        },
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
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
              text: lit("Decomposition — churn rate breakdown"),
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
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
          Rows: { projections: [column("PreferredPaymentMode")] },
          Columns: { projections: [column("CityTier")] },
          Values: { projections: [measure("Churn Rate"), measure("Customers")] },
        },
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
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
              text: lit("Churn rate by payment mode × city tier"),
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
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
              column("CustomerID"),
              column("ChurnProbability"),
              column("RiskBand"),
              column("Tenure"),
              column("DaySinceLastOrder"),
              column("SatisfactionScore"),
              column("Complain"),
              column("CustomerStatus"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: T } },
                  Property: "ChurnProbability",
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
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
              text: lit("At-risk queue — ranked by churn propensity"),
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

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
      {
        text: "Churn Retention",
        size: "40pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 88, y: 268, z: z++, height: 56, width: 1080, tabOrder: 4 }, [
      {
        text: "Propensity-ranked retention for outreach — see who stays at risk before they leave.",
        size: "16pt",
        color: "#5A6B75",
      },
    ]),
    shapeRect(id(), { x: 88, y: 340, z: z++, height: 4, width: 280, tabOrder: 5 }, "#C17B3A"),
    editorialHero(
      id(),
      { x: 88, y: 380, z: z++, height: 240, width: 520, tabOrder: 6 },
      "Churn Rate",
      ACCENTS.churn,
      "Portfolio churn rate"
    ),
    textbox(id(), { x: 640, y: 400, z: z++, height: 200, width: 520, tabOrder: 7 }, [
      {
        text: "What you’ll see",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      { text: "01  Retention Pulse — health and tenure risk", size: "13pt" },
      { text: "02  Churn Drivers — influencers and lift", size: "13pt" },
      { text: "03  At-Risk Queue — outreach by propensity", size: "13pt" },
      { text: "04  Context — facts and model caveats", size: "13pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 88, y: 660, z: z++, height: 40, width: 1080, tabOrder: 8 }, [
      {
        text: "Audience · CRO / retention lead / lifecycle marketing",
        size: "13pt",
        color: "#0F1C24",
      },
    ]),
    textbox(id(), { x: 88, y: 720, z: z++, height: 80, width: 1080, tabOrder: 9 }, [
      {
        text: "Signature · Sample-model propensity with Key Influencers — story on the pulse, caveats on Context.",
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

// --- Page 1: Retention Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Retention Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Retention Pulse — Portfolio health and risk concentration",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Churn rate, propensity, and tenure mix. ML scores are sample-model output for demonstration.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "RiskBand", "Risk band", "ChurnSync"),
    dropdownSlicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "CityTier", "City tier", "ChurnSync"),
    dropdownSlicer(id(), { ...SL.c, z: z++, tabOrder: 4 }, "TenureBand", "Tenure", "ChurnSync"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    classicCard(id(), { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 }, "Churn Rate", "Churn rate", ACCENTS.churn),
    classicCard(id(), { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 }, "Customers", "Customers", ACCENTS.customers),
    classicCard(id(), { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 8 }, "Avg Churn Probability", "Avg propensity", ACCENTS.propensity),
    classicCard(id(), { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 9 }, "Retained High Risk", "Retained high risk", ACCENTS.retained),
    barChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 1856, tabOrder: 10 },
      "TenureBand",
      "Churn Rate",
      "Churn rate by tenure band — early tenure concentrates risk",
      "#2F5F73",
      "#D7E6EC"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Churn Drivers ---
{
  const p = PAGES.drivers;
  pageChrome(p, "Churn Drivers");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Churn Drivers — What moves retention",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Key Influencers and decomposition explain the pulse; matrix compares payment mode × city tier.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(id(), { ...SL.b, z: z++, tabOrder: 2 }, "TenureBand", "Tenure", "ChurnSync"),
    dropdownSlicer(id(), { ...SL.c, z: z++, tabOrder: 3 }, "PreferredPaymentMode", "Payment mode", "ChurnSync"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    keyDrivers(id(), { x: 32, y: 112, z: z++, height: 460, width: 920, tabOrder: 5 }),
    decompTree(id(), { x: 976, y: 112, z: z++, height: 460, width: 912, tabOrder: 6 }),
    matrixSegment(id(), { x: 32, y: 596, z: z++, height: 416, width: 1856, tabOrder: 7 }),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      {
        text: "Drivers page · Key Influencers on Churn · Decomposition on Churn Rate · Segment lift via matrix",
        size: "9pt",
        color: "#6B7C86",
      },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: At-Risk Queue ---
{
  const p = PAGES.queue;
  pageChrome(p, "At-Risk Queue");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "At-Risk Queue — Intervention list",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Ranked by churn propensity. Filter to High risk and Stayed customers for outreach prioritization.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(id(), { ...SL.a, z: z++, tabOrder: 2 }, "RiskBand", "Risk band", "ChurnSync"),
    dropdownSlicer(id(), { ...SL.b, z: z++, tabOrder: 3 }, "CityTier", "City tier", "ChurnSync"),
    dropdownSlicer(id(), { ...SL.c, z: z++, tabOrder: 4 }, "SatisfactionScore", "Satisfaction", "ChurnSync"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 5 }),
    classicCard(id(), { x: 32, y: 112, z: z++, height: 120, width: 448, tabOrder: 6 }, "High Risk Customers", "High risk", ACCENTS.highRisk),
    classicCard(id(), { x: 504, y: 112, z: z++, height: 120, width: 448, tabOrder: 7 }, "Retained High Risk", "Retained high risk", ACCENTS.retained),
    classicCard(id(), { x: 976, y: 112, z: z++, height: 120, width: 448, tabOrder: 8 }, "Avg Churn Probability", "Avg propensity", ACCENTS.propensity),
    classicCard(id(), { x: 1448, y: 112, z: z++, height: 120, width: 440, tabOrder: 9 }, "Customers", "Customers in view", ACCENTS.customers),
    riskTable(id(), { x: 32, y: 256, z: z++, height: 756, width: 1856, tabOrder: 10 }),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      {
        text: "At-Risk Queue · Sort by ChurnProbability · Sample-model scores for portfolio demonstration",
        size: "9pt",
        color: "#6B7C86",
      },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 4: Context (last visible, facts only) ---
{
  const p = PAGES.context;
  pageChrome(p, "Context");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Context — Reference",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Facts and caveats only. Landing is the open; this page is documentation.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 32, y: 120, z: z++, height: 100, width: 1856, tabOrder: 3 }, [
      {
        text: "Audience",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "CRO / retention lead / lifecycle marketing.",
        size: "12pt",
        color: "#0F1C24",
      },
    ]),
    textbox(id(), { x: 32, y: 240, z: z++, height: 200, width: 900, tabOrder: 4 }, [
      {
        text: "How to read Drivers visuals",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "Key Influencers ranks features by impact on the Churn label.",
        size: "12pt",
      },
      {
        text: "Decomposition tree walks churn rate through segments you expand.",
        size: "12pt",
      },
      {
        text: "Matrix compares payment mode × city tier — lift vs baseline, not causality.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 976, y: 240, z: z++, height: 200, width: 912, tabOrder: 5 }, [
      {
        text: "Queue usage",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "Sorted by ChurnProbability descending.",
        size: "12pt",
      },
      {
        text: "Filter High risk + Stayed for outreach prioritization.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 480, z: z++, height: 280, width: 1856, tabOrder: 6 }, [
      {
        text: "Data & model caveats",
        size: "14pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
      {
        text: "• Source: Judithokon e-commerce churn sample (KDNuggets #1) — 5,630 customers, ~17% churn.",
        size: "12pt",
      },
      {
        text: "• ChurnProbability / RiskBand: local logistic sample model — portfolio analytics, not production CRM scoring.",
        size: "12pt",
      },
      {
        text: "• Hold-out ROC-AUC ~0.89 — see scripts/score-churn.py for metrics.",
        size: "12pt",
      },
    ]),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 7 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

console.log(JSON.stringify({ ok: true, pages: PAGES }, null, 2));

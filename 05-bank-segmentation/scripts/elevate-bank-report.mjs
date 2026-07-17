/**
 * Elevate BankValue report — Nordic Boardroom polish across 4 pages.
 * Reads page IDs dynamically from pages.json (do not hardcode ReportSection IDs).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REPORT = path.join(root, "BankValue.Report");

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const SYNC_PREFIX = "BankSync";
const FOOTER =
  "Source: franklinanalytics Bank Segmentation sample (scaled) · Local PBIP · Nordic Boardroom · RFM + k-means segments";

const ACCENTS = {
  credit: "#1B7A4E",
  debit: "#B42318",
  net: "#2F5F73",
  active: "#C17B3A",
  dormant: "#B42318",
  single: "#C17B3A",
  pct: "#2F5F73",
  balance: "#2F5F73",
  volume: "#1B7A4E",
  txns: "#5B8FA3",
  base: "#2F5F73",
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

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  if (!fs.existsSync(pagesPath)) {
    throw new Error(`Missing ${pagesPath} — run scaffold-bank-pbip.mjs first`);
  }
  const meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  const byDisplay = {};
  for (const pageKey of meta.pageOrder) {
    const pj = JSON.parse(
      fs.readFileSync(path.join(REPORT, "definition/pages", pageKey, "page.json"), "utf8")
    );
    byDisplay[pj.displayName] = pageKey;
  }
  const required = [
    "Franchise Pulse",
    "Segments & Markets",
    "Relationship Book",
    "Customer Profile",
  ];
  for (const name of required) {
    if (!byDisplay[name]) {
      throw new Error(`Page "${name}" not found in pages.json / page.json`);
    }
  }
  return {
    pulse: byDisplay["Franchise Pulse"],
    segments: byDisplay["Segments & Markets"],
    book: byDisplay["Relationship Book"],
    profile: byDisplay["Customer Profile"],
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
    // One sync group per column — never mix fields in the same group
    // (PBIR rule: same group ⇒ same bound column).
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

function waterfallChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "waterfallChart",
      query: {
        queryState: {
          Category: { projections: [column("FactFlowBridge", "FlowStage")] },
          Y: { projections: [measure("FactFlowBridge", "Flow Amount")] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "FactFlowBridge" } },
                  Property: "FlowStage",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        labels: [
          {
            properties: {
              show: lit(true),
              fontSize: litD(9),
              color: solid("#0F1C24"),
            },
          },
        ],
        sentimentColors: [
          {
            properties: {
              increaseFill: solid("#1B7A4E"),
              decreaseFill: solid("#B42318"),
              totalFill: solid("#2F5F73"),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
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
          Y: { projections: [measure("FactTransactions", "Transaction Volume")] },
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

function clusteredBar(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredBarChart",
      query: {
        queryState: {
          Category: { projections: [column("DimCustomer", "ValueSegment")] },
          Y: { projections: [measure("DimCustomer", "Customer Base")] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "DimCustomer" } },
                  Property: "Customer Base",
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
                            Expression: { SourceRef: { Entity: "DimCustomer" } },
                            Property: "Customer Base",
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
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function scatterChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "scatterChart",
      query: {
        queryState: {
          Category: { projections: [column("DimCustomer", "ValueSegment")] },
          X: { projections: [measure("DimCustomer", "Avg Frequency")] },
          Y: { projections: [measure("DimCustomer", "Avg Monetary")] },
          Size: { projections: [measure("DimCustomer", "Customer Base")] },
        },
      },
      objects: {
        general: [{ properties: { responsive: lit(true) } }],
        categoryLabels: [{ properties: { show: lit(true), fontSize: litD(9) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(true),
              titleText: lit("Avg Monetary"),
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
              titleText: lit("Avg Frequency"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function avgCol(entity, col) {
  return {
    field: {
      Aggregation: {
        Expression: {
          Column: {
            Expression: { SourceRef: { Entity: entity } },
            Property: col,
          },
        },
        Function: 1,
      },
    },
    queryRef: `Avg(${entity}.${col})`,
    nativeQueryRef: `Average of ${col}`,
  };
}

/** Icon Map (Leaflet) — real basemap tiles, no Azure Maps sign-in */
const ICON_MAP_GUID = "iconMapV34089C0EB522B416294AA926F71B4FDBB";

function iconMapVisual(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: ICON_MAP_GUID,
      query: {
        queryState: {
          category: { projections: [column("DimCustomer", "City")] },
          Longitude: { projections: [avgCol("DimCustomer", "Longitude")] },
          Latitude: { projections: [avgCol("DimCustomer", "Latitude")] },
          Size: { projections: [measure("DimCustomer", "Customer Base")] },
        },
      },
      objects: {
        mapLayers: [
          {
            properties: {
              backgroundMapLayer: lit("OpenTopoMap"),
            },
          },
        ],
        zoom: [
          {
            properties: {
              defaultLatitude: lit(9.0),
              defaultLongitude: lit(8.0),
              defaultZoom: lit(5.5),
              zoomOnSingleItem: lit(true),
              includeInZoom: lit("Yes"),
            },
          },
        ],
        circles: [
          {
            properties: {
              minSize: lit(8),
              maxSize: lit(28),
            },
          },
        ],
        controls: [
          {
            properties: {
              zoom: lit(true),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function funnelChart(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "funnel",
      query: {
        queryState: {
          Category: { projections: [column("DimCustomer", "EngagementStage")] },
          Y: { projections: [measure("DimCustomer", "Customer Base")] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "DimCustomer" } },
                  Property: "Customer Base",
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
              fontSize: litD(9),
              color: solid("#0F1C24"),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function customerQueue(name, pos, title) {
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
              column("DimCustomer", "CustomerName"),
              column("DimCustomer", "City"),
              column("DimCustomer", "ValueSegment"),
              column("DimCustomer", "ProductCount"),
              column("DimCustomer", "RecencyDays"),
              column("DimCustomer", "TotalBalance"),
              column("DimCustomer", "IsDormant"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "DimCustomer" } },
                  Property: "RecencyDays",
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function accountsTable(name, pos, title) {
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
              column("DimAccount", "AccountNumber"),
              column("DimAccount", "AccountType"),
              column("DimAccount", "Balance"),
              column("DimAccount", "OpenDate"),
            ],
          },
        },
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function txnsTable(name, pos, title) {
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
              column("FactTransactions", "TransactionDate"),
              column("FactTransactions", "Amount"),
              column("FactTransactions", "TransactionType"),
              column("FactTransactions", "Description"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "FactTransactions" } },
                  Property: "TransactionDate",
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function drillthroughExtras() {
  const filterId = "Filter" + crypto.randomBytes(12).toString("hex");
  const filterIdName = "Filter" + crypto.randomBytes(12).toString("hex");
  return {
    visibility: "HiddenInViewMode",
    filterConfig: {
      filters: [
        {
          name: filterId,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "DimCustomer" } },
              Property: "CustomerID",
            },
          },
          type: "Categorical",
          howCreated: "Drillthrough",
        },
        {
          name: filterIdName,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "DimCustomer" } },
              Property: "CustomerName",
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
          name: "Param_" + filterId,
          boundFilter: filterId,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "DimCustomer" } },
              Property: "CustomerID",
            },
          },
        },
        {
          name: "Param_" + filterIdName,
          boundFilter: filterIdName,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "DimCustomer" } },
              Property: "CustomerName",
            },
          },
        },
      ],
    },
  };
}

// --- Build ---
const PAGES = resolvePages();

// Keep profile last in pageOrder; active = Franchise Pulse
fs.writeFileSync(
  path.join(REPORT, "definition/pages/pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [PAGES.pulse, PAGES.segments, PAGES.book, PAGES.profile],
      activePageName: PAGES.pulse,
    },
    null,
    2
  )
);

// --- Page 1: Franchise Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Franchise Pulse");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Franchise Pulse — Credit, debit, and active book",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Dual-flow KPIs, waterfall bridge, and monthly transaction volume.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { x: 980, y: 12, z: z++, height: 80, width: 180, tabOrder: 2 },
      "DimCustomer",
      "ValueSegment",
      "Value segment",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { x: 1174, y: 12, z: z++, height: 80, width: 180, tabOrder: 3 },
      "DimCustomer",
      "City",
      "City",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { x: 1368, y: 12, z: z++, height: 80, width: 200, tabOrder: 4 },
      "DimCustomer",
      "Gender",
      "Gender",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 5 }),
    classicCard(
      id(),
      { x: 32, y: 112, z: z++, height: 140, width: 448, tabOrder: 6 },
      "FactTransactions",
      "Credit Volume",
      "Credit volume",
      ACCENTS.credit
    ),
    classicCard(
      id(),
      { x: 504, y: 112, z: z++, height: 140, width: 448, tabOrder: 7 },
      "FactTransactions",
      "Debit Volume",
      "Debit volume",
      ACCENTS.debit
    ),
    classicCard(
      id(),
      { x: 976, y: 112, z: z++, height: 140, width: 448, tabOrder: 8 },
      "FactTransactions",
      "Net Flow",
      "Net flow",
      ACCENTS.net
    ),
    classicCard(
      id(),
      { x: 1448, y: 112, z: z++, height: 140, width: 440, tabOrder: 9 },
      "FactTransactions",
      "Active Customers",
      "Active customers (90d)",
      ACCENTS.active
    ),
    waterfallChart(
      id(),
      { x: 32, y: 276, z: z++, height: 736, width: 920, tabOrder: 10 },
      "Credit vs debit flow"
    ),
    lineChart(
      id(),
      { x: 976, y: 276, z: z++, height: 736, width: 912, tabOrder: 11 },
      "Monthly transaction volume"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 12 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 2: Segments & Markets ---
{
  const p = PAGES.segments;
  pageChrome(p, "Segments & Markets");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Segments & Markets — RFM clusters and city footprint",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Value segment mix, frequency × monetary scatter, and Icon Map city footprint (OpenTopoMap — no Azure login).",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { x: 1174, y: 12, z: z++, height: 80, width: 180, tabOrder: 2 },
      "DimCustomer",
      "ValueSegment",
      "Value segment",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { x: 1368, y: 12, z: z++, height: 80, width: 200, tabOrder: 3 },
      "DimCustomer",
      "City",
      "City",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 4 }),
    clusteredBar(
      id(),
      { x: 32, y: 112, z: z++, height: 896, width: 600, tabOrder: 5 },
      "Value segment mix"
    ),
    scatterChart(
      id(),
      { x: 656, y: 112, z: z++, height: 896, width: 620, tabOrder: 6 },
      "Frequency × monetary by segment"
    ),
    iconMapVisual(
      id(),
      { x: 1300, y: 112, z: z++, height: 896, width: 588, tabOrder: 7 },
      "City footprint — Icon Map"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 8 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 3: Relationship Book ---
{
  const p = PAGES.book;
  pageChrome(p, "Relationship Book");
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Relationship Book — Dormancy and cross-sell queue",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Dormant and single-product customers. Drill through a row to Customer Profile.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    dropdownSlicer(
      id(),
      { x: 980, y: 12, z: z++, height: 80, width: 180, tabOrder: 2 },
      "DimCustomer",
      "IsDormant",
      "Dormant",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { x: 1174, y: 12, z: z++, height: 80, width: 180, tabOrder: 3 },
      "DimCustomer",
      "ProductCount",
      "Products",
      SYNC_PREFIX
    ),
    dropdownSlicer(
      id(),
      { x: 1368, y: 12, z: z++, height: 80, width: 200, tabOrder: 4 },
      "DimCustomer",
      "ValueSegment",
      "Value segment",
      SYNC_PREFIX
    ),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 5 }),
    classicCard(
      id(),
      { x: 32, y: 112, z: z++, height: 120, width: 448, tabOrder: 6 },
      "DimCustomer",
      "Dormant Customers",
      "Dormant customers",
      ACCENTS.dormant
    ),
    classicCard(
      id(),
      { x: 504, y: 112, z: z++, height: 120, width: 448, tabOrder: 7 },
      "DimCustomer",
      "Single Product Customers",
      "Single product",
      ACCENTS.single
    ),
    classicCard(
      id(),
      { x: 976, y: 112, z: z++, height: 120, width: 448, tabOrder: 8 },
      "DimCustomer",
      "Dormant %",
      "Dormant %",
      ACCENTS.pct
    ),
    funnelChart(
      id(),
      { x: 1448, y: 112, z: z++, height: 900, width: 440, tabOrder: 9 },
      "Engagement funnel"
    ),
    customerQueue(
      id(),
      { x: 32, y: 256, z: z++, height: 756, width: 1392, tabOrder: 10 },
      "Relationship queue — sort by recency"
    ),
    textbox(id(), { x: 32, y: 1032, z: z++, height: 28, width: 1856, tabOrder: 11 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Page 4: Customer Profile (hidden drillthrough) ---
{
  const p = PAGES.profile;
  pageChrome(p, "Customer Profile", drillthroughExtras());
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Customer Profile",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 28, width: 1100, tabOrder: 1 }, [
      {
        text: "Drillthrough target — accounts and recent activity for one customer.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    classicCard(
      id(),
      { x: 32, y: 100, z: z++, height: 120, width: 448, tabOrder: 2 },
      "DimCustomer",
      "Customer Base",
      "Customers in context",
      ACCENTS.base
    ),
    classicCard(
      id(),
      { x: 504, y: 100, z: z++, height: 120, width: 448, tabOrder: 3 },
      "DimCustomer",
      "Avg Balance",
      "Avg balance",
      ACCENTS.balance
    ),
    classicCard(
      id(),
      { x: 976, y: 100, z: z++, height: 120, width: 448, tabOrder: 4 },
      "FactTransactions",
      "Transaction Volume",
      "Transaction volume",
      ACCENTS.volume
    ),
    classicCard(
      id(),
      { x: 1448, y: 100, z: z++, height: 120, width: 440, tabOrder: 5 },
      "FactTransactions",
      "Transactions",
      "Transactions",
      ACCENTS.txns
    ),
    accountsTable(
      id(),
      { x: 32, y: 248, z: z++, height: 360, width: 920, tabOrder: 6 },
      "Accounts"
    ),
    txnsTable(
      id(),
      { x: 976, y: 248, z: z++, height: 760, width: 912, tabOrder: 7 },
      "Recent transactions"
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
        segments: PAGES.segments,
        book: PAGES.book,
        profile: PAGES.profile,
      },
      syncGroup: "BankSync_<column>",
      report: REPORT,
    },
    null,
    2
  )
);

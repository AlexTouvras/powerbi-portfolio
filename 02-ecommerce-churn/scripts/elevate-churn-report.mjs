/**
 * Elevate Churn Retention report to match Sales Executive Nordic Boardroom format.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const REPORT =
  "C:/Users/kater/.cursor/projects/PowerBI/02-ecommerce-churn/ChurnRetention.Report";
const PAGES = {
  pulse: "ReportSectiona4b9204cc682fd2806841583",
  drivers: "ReportSectionab668a40dbdf749534697aee",
  queue: "ReportSection73f606f5ede5c74d58f5819d",
};
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";
const T = "DimCustomer";

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
    dropdownSlicer(id(), { x: 980, y: 12, z: z++, height: 80, width: 180, tabOrder: 2 }, "RiskBand", "Risk band", "ChurnSync"),
    dropdownSlicer(id(), { x: 1174, y: 12, z: z++, height: 80, width: 180, tabOrder: 3 }, "CityTier", "City tier", "ChurnSync"),
    dropdownSlicer(id(), { x: 1368, y: 12, z: z++, height: 80, width: 200, tabOrder: 4 }, "TenureBand", "Tenure", "ChurnSync"),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 5 }),
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
      {
        text: "Source: Judithokon e-commerce churn sample · Local PBIP · Nordic Boardroom · Propensity = logistic sample model",
        size: "9pt",
        color: "#6B7C86",
      },
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
    dropdownSlicer(id(), { x: 980, y: 12, z: z++, height: 80, width: 200, tabOrder: 2 }, "TenureBand", "Tenure", "ChurnSync"),
    dropdownSlicer(id(), { x: 1194, y: 12, z: z++, height: 80, width: 240, tabOrder: 3 }, "PreferredPaymentMode", "Payment mode", "ChurnSync"),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 4 }),
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
    dropdownSlicer(id(), { x: 980, y: 12, z: z++, height: 80, width: 180, tabOrder: 2 }, "RiskBand", "Risk band", "ChurnSync"),
    dropdownSlicer(id(), { x: 1174, y: 12, z: z++, height: 80, width: 180, tabOrder: 3 }, "CityTier", "City tier", "ChurnSync"),
    dropdownSlicer(id(), { x: 1368, y: 12, z: z++, height: 80, width: 200, tabOrder: 4 }, "SatisfactionScore", "Satisfaction", "ChurnSync"),
    pageNavigator(id(), { x: 1592, y: 12, z: z++, height: 80, width: 296, tabOrder: 5 }),
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

console.log(JSON.stringify({ ok: true, pages: PAGES }, null, 2));

/**
 * Elevate Controllership — Landing · P&L Pulse · Variance Drivers · Scenarios · Context.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  ensureLandingAtmosphere,
  pageBackgroundWithAtmosphere,
} from "../../_shared/scripts/ensure-landing-atmosphere.mjs";
import {
  buildStatementLayout,
  divergenceDataPoint,
} from "../../_shared/scripts/plot-patterns.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REPORT = path.join(root, "Controllership.Report");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const FOOTER =
  "Source: Seeded Nordic multi-entity P&L - Local PBIP - Nordic Boardroom - Not audited financials";
const NAV = { x: 1448, y: 12, z: 0, height: 80, width: 440 };

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
function measure(entity, name, active = false) {
  const p = {
    field: {
      Measure: { Expression: { SourceRef: { Entity: entity } }, Property: name },
    },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
  if (active) p.active = true;
  return p;
}
function column(entity, name, active = true) {
  const p = {
    field: {
      Column: { Expression: { SourceRef: { Entity: entity } }, Property: name },
    },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
  if (active) p.active = true;
  return p;
}
function cardChrome(title, subtitle) {
  const chrome = {
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
  };
  if (title) {
    chrome.title = [
      {
        properties: {
          show: lit(true),
          text: lit(title),
          fontSize: litD(12),
          fontColor: solid("#0F1C24"),
        },
      },
    ];
  }
  if (subtitle) {
    chrome.subTitle = [
      {
        properties: {
          show: lit(true),
          text: lit(subtitle),
          fontSize: litD(9),
          fontColor: solid("#5A6B75"),
        },
      },
    ];
  }
  return chrome;
}

function textbox(name, pos, runs) {
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
              paragraphs: runs.map((r) => ({
                textRuns: [
                  {
                    value: r.text,
                    textStyle: {
                      fontFamily: r.font || "Segoe UI",
                      fontSize: r.size || "12pt",
                      color: r.color || "#0F1C24",
                      ...(r.bold ? { fontWeight: "bold" } : {}),
                    },
                  },
                ],
                horizontalTextAlignment: "left",
              })),
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
        labels: [
          {
            properties: {
              fontSize: litD(28),
              bold: lit(true),
              color: solid(accent),
              fontFamily: lit("Consolas"),
            },
          },
        ],
        categoryLabels: [{ properties: { show: lit(false) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
        title: [{ properties: { show: lit(true), text: lit(title), fontSize: litD(10), fontColor: solid("#5A6B75") } }],
        visualHeader: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

/** Long-form DAX text on a card (Landing thesis / subthesis). */
function narrativeCard(name, pos, entity, measureName, fontSize, color, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: { queryState: { Values: { projections: [measure(entity, measureName)] } } },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(fontSize),
              bold: lit(fontSize >= 16),
              color: solid(color),
              fontFamily: lit(fontSize >= 16 ? "Segoe UI Semibold" : "Segoe UI"),
            },
          },
        ],
        categoryLabels: [{ properties: { show: lit(false) } }],
        wordWrap: [{ properties: { show: lit(true) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(false) } }],
        border: [{ properties: { show: lit(false) } }],
        title: title
          ? [
              {
                properties: {
                  show: lit(true),
                  text: lit(title),
                  fontSize: litD(10),
                  fontColor: solid("#5A6B75"),
                },
              },
            ]
          : [{ properties: { show: lit(false) } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(0),
              bottom: litD(0),
              left: litD(0),
              right: litD(8),
            },
          },
        ],
      },
    },
  };
}

/** Dual (or multi) measure line — Actual vs Budget trajectory, variance slopes. */
function multiMeasureLine(name, pos, catEntity, catCol, sortCol, series, title, subtitle) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: series.map((s) => measure(s.entity, s.measure)) },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: catEntity } },
                  Property: sortCol,
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        legend: [
          {
            properties: {
              show: lit(true),
              position: lit("TopCenter"),
              fontSize: litD(9),
              labelColor: solid("#5A6B75"),
            },
          },
        ],
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
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
        dataPoint: series.map((s) => ({
          properties: { fill: solid(s.color) },
          selector: { metadata: `${s.entity}.${s.measure}` },
        })),
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
  };
}

/** Category series line — e.g. OP variance by month, series = entity. */
function seriesLine(name, pos, catEntity, catCol, sortCol, seriesEntity, seriesCol, measureEntity, measureName, title, subtitle) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Series: { projections: [column(seriesEntity, seriesCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: catEntity } },
                  Property: sortCol,
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        legend: [
          {
            properties: {
              show: lit(true),
              position: lit("TopCenter"),
              fontSize: litD(9),
              labelColor: solid("#5A6B75"),
            },
          },
        ],
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
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
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
  };
}

/** Actual vs Budget clustered bars by category. */
function compareBars(name, pos, catEntity, catCol, title, subtitle) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "clusteredBarChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: {
            projections: [
              measure("FactPnL", "Operating Profit Actual"),
              measure("FactPnL", "Operating Profit Budget"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactPnL" } },
                  Property: "Operating Profit Actual",
                },
              },
              direction: "Descending",
            },
          ],
        },
      },
      objects: {
        legend: [
          {
            properties: {
              show: lit(true),
              position: lit("TopCenter"),
              fontSize: litD(9),
              labelColor: solid("#5A6B75"),
            },
          },
        ],
        labels: [
          {
            properties: {
              show: lit(true),
              labelDisplayUnits: lit("0"),
              fontSize: litD(8),
              color: solid("#0F1C24"),
            },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
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
            properties: { fill: solid("#2F5F73") },
            selector: { metadata: "FactPnL.Operating Profit Actual" },
          },
          {
            properties: { fill: solid("#A8B5BC") },
            selector: { metadata: "FactPnL.Operating Profit Budget" },
          },
        ],
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
  };
}

/** Worst leaf×entity movers — exception queue (AccountName enables Line Profile drillthrough). */
function exceptionQueue(name, pos, title) {
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
              column("DimEntity", "EntityName"),
              column("DimAccount", "AccountName"),
              column("DimAccount", "StatementLabel"),
              measure("FactPnL", "Leaf Signed Variance", true),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactPnL" } },
                  Property: "Leaf Signed Variance",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        columnHeaders: [{ properties: { autoSizeColumnWidth: lit(true), fontSize: litD(10) } }],
        values: [
          { properties: { fontSize: litD(10), fontFamily: lit("Consolas") } },
          {
            properties: {
              backColor: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: {
                          SelectRef: { ExpressionName: "FactPnL.Leaf Signed Variance" },
                        },
                        FillRule: {
                          linearGradient3: {
                            min: {
                              color: { Literal: { Value: "'#F9DEDC'" } },
                              value: { Literal: { Value: "-1D" } },
                            },
                            mid: {
                              color: { Literal: { Value: "'#F7FAFC'" } },
                              value: { Literal: { Value: "0D" } },
                            },
                            max: {
                              color: { Literal: { Value: "'#D1E7DD'" } },
                              value: { Literal: { Value: "1D" } },
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
              data: [{ dataViewWildcard: { matchingOption: 1 } }],
              metadata: "FactPnL.Leaf Signed Variance",
            },
          },
        ],
      },
      visualContainerObjects: {
        ...cardChrome(title, "Right-click a row → Drill through → Line Profile"),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
    filterConfig: { filters: [levelOneFilter()] },
  };
}

function slicer(name, pos, entity, colName, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: { queryState: { Values: { projections: [column(entity, colName)] } } },
      objects: { data: [{ properties: { mode: lit("Dropdown") } }] },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF") } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(6) } }],
        title: [{ properties: { show: lit(true), text: lit(title), fontSize: litD(10), fontColor: solid("#5A6B75") } }],
        visualHeader: [{ properties: { show: lit(false) } }],
      },
    },
  };
}

function levelOneFilter() {
  return {
    name: "Filter" + crypto.randomBytes(8).toString("hex"),
    field: {
      Column: {
        Expression: { SourceRef: { Entity: "DimAccount" } },
        Property: "Level",
      },
    },
    type: "Advanced",
    filter: {
      Version: 2,
      From: [{ Name: "a", Entity: "DimAccount", Type: 0 }],
      Where: [
        {
          Condition: {
            Comparison: {
              ComparisonKind: 0,
              Left: {
                Column: {
                  Expression: { SourceRef: { Source: "a" } },
                  Property: "Level",
                },
              },
              Right: { Literal: { Value: "1L" } },
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

/** Exclude Actual OP bookend — native waterfall Show total draws the ending Actual. */
function bridgeExcludeActualFilter() {
  return {
    name: "Filter" + crypto.randomBytes(8).toString("hex"),
    field: {
      Column: {
        Expression: { SourceRef: { Entity: "DimBridgeStep" } },
        Property: "BridgeOrder",
      },
    },
    type: "Advanced",
    filter: {
      Version: 2,
      From: [{ Name: "b", Entity: "DimBridgeStep", Type: 0 }],
      Where: [
        {
          Condition: {
            Comparison: {
              ComparisonKind: 3,
              Left: {
                Column: {
                  Expression: { SourceRef: { Source: "b" } },
                  Property: "BridgeOrder",
                },
              },
              Right: { Literal: { Value: "900L" } },
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

/** Compact monthly sparkline under a KPI (no axes chrome). */
function sparkline(name, pos, measureEntity, measureName, color, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("DimDate", "YearMonth")] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "DimDate" } },
                  Property: "MonthYearSort",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(false),
              gridlineShow: lit(false),
              showAxisTitle: lit(false),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(false),
              showAxisTitle: lit(false),
            },
          },
        ],
        dataPoint: [
          {
            properties: { fill: solid(color) },
            selector: { metadata: `${measureEntity}.${measureName}` },
          },
        ],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(9),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: litD(0),
              bottom: litD(0),
              left: litD(4),
              right: litD(4),
            },
          },
        ],
      },
    },
  };
}

/** Budget OP → leaf signed bridges → Show total (= Actual OP). */
function opBridgeWaterfall(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "waterfallChart",
      query: {
        queryState: {
          Category: { projections: [column("DimBridgeStep", "BridgeStep")] },
          Y: { projections: [measure("FactPnL", "Bridge Amount")] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "DimBridgeStep" } },
                  Property: "BridgeOrder",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
        labels: [
          {
            properties: {
              show: lit(true),
              labelDisplayUnits: lit("0"),
              fontSize: litD(8),
              color: solid("#0F1C24"),
            },
          },
        ],
        sentimentColors: [
          {
            properties: {
              increaseFill: solid("#1B7A4E"),
              decreaseFill: solid("#B42318"),
              totalFill: solid("#0F1C24"),
            },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              totalsEnabled: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(
        title,
        "Start = Budget OP (IsTotal) · bridges = leaf signed · end total = Actual OP"
      ),
    },
    filterConfig: { filters: [bridgeExcludeActualFilter()] },
  };
}

function barChart(name, pos, catEntity, catCol, measureEntity, measureName, title, _color, sortDir = "Descending", leafOnly = false) {
  const visual = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: measureEntity } },
                  Property: measureName,
                },
              },
              direction: sortDir,
            },
          ],
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
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
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
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
        dataPoint: [divergenceDataPoint(measureEntity, measureName)],
      },
      visualContainerObjects: cardChrome(title, "Green helps OP - red hurts OP vs budget"),
    },
  };
  if (leafOnly) visual.filterConfig = { filters: [levelOneFilter()] };
  return visual;
}

function waterfallChart(name, pos, catEntity, catCol, measureEntity, measureName, title, subtitle, sortCol, leafOnly = false) {
  const sortField = sortCol
    ? {
        Column: {
          Expression: { SourceRef: { Entity: catEntity } },
          Property: sortCol,
        },
      }
    : {
        Measure: {
          Expression: { SourceRef: { Entity: measureEntity } },
          Property: measureName,
        },
      };
  const visual = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "waterfallChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: [measure(measureEntity, measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: sortField,
              direction: sortCol ? "Ascending" : "Descending",
            },
          ],
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
        labels: [
          {
            properties: {
              show: lit(true),
              labelDisplayUnits: lit("0"),
              fontSize: litD(8),
              color: solid("#0F1C24"),
            },
          },
        ],
        sentimentColors: [
          {
            properties: {
              increaseFill: solid("#1B7A4E"),
              decreaseFill: solid("#B42318"),
              totalFill: solid("#0F1C24"),
            },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(8),
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
  };
  if (leafOnly) visual.filterConfig = { filters: [levelOneFilter()] };
  return visual;
}

function waterfallLeaf(name, pos, title) {
  return waterfallChart(
    name,
    pos,
    "DimAccount",
    "StatementLabel",
    "FactPnL",
    "Signed Variance Eur",
    title,
    "Leaf OP bridge - cost overruns flip red via Sign",
    "SortOrder",
    true
  );
}

function matrixVisual(name, pos, rowEntity, rowCol, colEntity, colCol, measureEntity, measureName, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: { projections: [column(rowEntity, rowCol)] },
          Columns: { projections: [column(colEntity, colCol)] },
          Values: { projections: [measure(measureEntity, measureName)] },
        },
      },
      objects: {
        grid: [{ properties: { outlineColor: solid("#E8EEF2"), outlineWeight: litD(1) } }],
        columnHeaders: [{ properties: { fontSize: litD(9), autoSizeColumnWidth: lit(true) } }],
        rowHeaders: [{ properties: { fontSize: litD(9) } }],
        values: [
          { properties: { fontSize: litD(9) } },
          {
            properties: {
              backColor: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: {
                          SelectRef: { ExpressionName: `${measureEntity}.${measureName}` },
                        },
                        FillRule: {
                          linearGradient3: {
                            min: {
                              color: { Literal: { Value: "'#F9DEDC'" } },
                              value: { Literal: { Value: "-1D" } },
                            },
                            mid: {
                              color: { Literal: { Value: "'#F7FAFC'" } },
                              value: { Literal: { Value: "0D" } },
                            },
                            max: {
                              color: { Literal: { Value: "'#D1E7DD'" } },
                              value: { Literal: { Value: "1D" } },
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
              data: [{ dataViewWildcard: { matchingOption: 1 } }],
              metadata: `${measureEntity}.${measureName}`,
            },
          },
        ],
      },
      visualContainerObjects: {
        ...cardChrome(title, "Entity x account - leaf OP contribution - red/green heat"),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
    filterConfig: {
      filters: [levelOneFilter()],
    },
  };
}

function scenarioLine(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [column("DimDate", "YearMonth")] },
          Series: { projections: [column("FactScenario", "Scenario")] },
          Y: { projections: [measure("FactScenario", "Sum Scenario OP")] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: "DimDate" } },
                  Property: "MonthYearSort",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        legend: [
          {
            properties: {
              show: lit(true),
              position: lit("TopCenter"),
              fontSize: litD(9),
              labelColor: solid("#5A6B75"),
            },
          },
        ],
        labels: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              start: litD(0),
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
            properties: { fill: solid("#0F1C24") },
            selector: {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: {
                        Column: {
                          Expression: { SourceRef: { Entity: "FactScenario" } },
                          Property: "Scenario",
                        },
                      },
                      Right: { Literal: { Value: "'Base (actual)'" } },
                    },
                  },
                },
              ],
            },
          },
          {
            properties: { fill: solid("#1B7A4E") },
            selector: {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: {
                        Column: {
                          Expression: { SourceRef: { Entity: "FactScenario" } },
                          Property: "Scenario",
                        },
                      },
                      Right: { Literal: { Value: "'Revenue +5%'" } },
                    },
                  },
                },
              ],
            },
          },
          {
            properties: { fill: solid("#B42318") },
            selector: {
              data: [
                {
                  scopeId: {
                    Comparison: {
                      ComparisonKind: 0,
                      Left: {
                        Column: {
                          Expression: { SourceRef: { Entity: "FactScenario" } },
                          Property: "Scenario",
                        },
                      },
                      Right: { Literal: { Value: "'FX -3% hit'" } },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(
        title,
        "Illustrative multipliers on monthly OP — not a live what-if engine"
      ),
    },
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

function pageDisplayMap(meta) {
  const pagesDir = path.join(REPORT, "definition/pages");
  const map = {};
  for (const key of meta.pageOrder) {
    const pj = JSON.parse(fs.readFileSync(path.join(pagesDir, key, "page.json"), "utf8"));
    map[pj.displayName] = key;
  }
  return map;
}

function pageChrome(pageKey, displayName, extrasOrWidth = 0) {
  let outspaceWidth = 0;
  let extras = {};
  if (typeof extrasOrWidth === "number") outspaceWidth = extrasOrWidth;
  else if (extrasOrWidth && typeof extrasOrWidth === "object") extras = extrasOrWidth;
  const pagePath = path.join(REPORT, "definition/pages", pageKey, "page.json");
  const page = {
    $schema: PAGE_SCHEMA,
    name: pageKey,
    displayName,
    displayOption: "FitToPage",
    height: 1080,
    width: 1920,
    ...extras,
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
  };
  fs.writeFileSync(pagePath, JSON.stringify(page, null, 2));
}

function ensurePage(byDisplay, displayName) {
  if (byDisplay[displayName]) return byDisplay[displayName];
  const key = "ReportSection" + crypto.randomBytes(12).toString("hex");
  const pageDir = path.join(REPORT, "definition/pages", key);
  fs.mkdirSync(path.join(pageDir, "visuals"), { recursive: true });
  fs.writeFileSync(
    path.join(pageDir, "page.json"),
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: key,
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
          outspacePane: [{ properties: { width: { expr: { Literal: { Value: "0D" } } } } }],
        },
      },
      null,
      2
    )
  );
  byDisplay[displayName] = key;
  return key;
}

function drillthroughExtras() {
  const filterEntity = "Filter" + crypto.randomBytes(12).toString("hex");
  const filterAccount = "Filter" + crypto.randomBytes(12).toString("hex");
  return {
    visibility: "HiddenInViewMode",
    filterConfig: {
      filters: [
        {
          name: filterEntity,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "DimEntity" } },
              Property: "EntityName",
            },
          },
          type: "Categorical",
          howCreated: "Drillthrough",
        },
        {
          name: filterAccount,
          field: {
            Column: {
              Expression: { SourceRef: { Entity: "DimAccount" } },
              Property: "AccountName",
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
          name: "Param_" + filterEntity,
          boundFilter: filterEntity,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "DimEntity" } },
              Property: "EntityName",
            },
          },
        },
        {
          name: "Param_" + filterAccount,
          boundFilter: filterAccount,
          fieldExpr: {
            Column: {
              Expression: { SourceRef: { Entity: "DimAccount" } },
              Property: "AccountName",
            },
          },
        },
      ],
    },
  };
}

const pagesPath = path.join(REPORT, "definition/pages/pages.json");
const meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
const byDisplay = pageDisplayMap(meta);
const PAGES = {
  landing: byDisplay["Landing"],
  pulse: byDisplay["P&L Pulse"],
  drivers: byDisplay["Variance Drivers"],
  scenarios: byDisplay["Scenarios"],
  context: byDisplay["Context"],
  profile: ensurePage(byDisplay, "Line Profile"),
};
if (!PAGES.landing || !PAGES.pulse || !PAGES.drivers || !PAGES.scenarios || !PAGES.context) {
  throw new Error("Missing pages — run scaffold-fpa-pbip.mjs first");
}

fs.writeFileSync(
  pagesPath,
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [
        PAGES.landing,
        PAGES.pulse,
        PAGES.drivers,
        PAGES.scenarios,
        PAGES.context,
        PAGES.profile,
      ],
      activePageName: PAGES.landing,
    },
    null,
    2
  )
);

const LANDING_ATMOSPHERE = "alpine-mist";
ensureLandingAtmosphere(REPORT, LANDING_ATMOSPHERE);

// --- Landing ---
{
  const p = PAGES.landing;
  const pagePath = path.join(REPORT, "definition/pages", p, "page.json");
  fs.writeFileSync(
    pagePath,
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: p,
        displayName: "Landing",
        displayOption: "FitToPage",
        height: 1080,
        width: 1920,
        objects: {
          background: pageBackgroundWithAtmosphere("#F7FAFC", 28, LANDING_ATMOSPHERE),
          outspacePane: [
            { properties: { width: { expr: { Literal: { Value: "0D" } } } } },
          ],
        },
      },
      null,
      2
    )
  );
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 80, y: 72, z: z++, height: 80, width: 720, tabOrder: 0 }, [
      { text: "Controllership", size: "36pt", font: "Segoe UI Semibold", bold: true },
    ]),
    slicer(id(), { x: 1048, y: 12, z: z++, height: 80, width: 176, tabOrder: 1 }, "DimDate", "YearMonth", "Period"),
    slicer(id(), { x: 1236, y: 12, z: z++, height: 80, width: 192, tabOrder: 2 }, "DimEntity", "EntityName", "Entity"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 3 }),
    textbox(id(), { x: 80, y: 160, z: z++, height: 48, width: 160, tabOrder: 4 }, [
      { text: "____", size: "18pt", color: "#C17B3A", bold: true },
    ]),
    narrativeCard(
      id(),
      { x: 80, y: 220, z: z++, height: 120, width: 900, tabOrder: 5 },
      "FactPnL",
      "Landing Thesis",
      18,
      "#0F1C24",
      "Conclusion (live)"
    ),
    narrativeCard(
      id(),
      { x: 80, y: 348, z: z++, height: 72, width: 900, tabOrder: 6 },
      "FactPnL",
      "Landing Subthesis",
      13,
      "#5A6B75"
    ),
    kpiCard(
      id(),
      { x: 80, y: 440, z: z++, height: 128, width: 360, tabOrder: 7 },
      "FactPnL",
      "Operating Profit Variance",
      "OP gap vs budget (EUR)",
      "#B42318"
    ),
    kpiCard(
      id(),
      { x: 460, y: 440, z: z++, height: 128, width: 360, tabOrder: 8 },
      "FactPnL",
      "OP Gap %",
      "OP gap %",
      "#C17B3A"
    ),
    textbox(id(), { x: 80, y: 600, z: z++, height: 280, width: 780, tabOrder: 9 }, [
      { text: "What you'll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  P&L Pulse - thesis, Actual vs Budget track, CoA, exception queue", size: "13pt" },
      { text: "02  Variance Drivers - entity Actual/Budget, monthly slope, heat", size: "13pt" },
      { text: "03  Scenarios - Base / Revenue +5% / FX -3% bands", size: "13pt" },
      { text: "04  Context - signed-variance grammar and seed notes", size: "13pt" },
      {
        text: "Tip: change Period or Entity above - the conclusion recalculates.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 80, y: 1000, z: z++, height: 36, width: 1600, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- P&L Pulse (bridge + sparklines + track + statement + queue) ---
{
  const p = PAGES.pulse;
  pageChrome(p, "P&L Pulse", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    narrativeCard(
      id(),
      { x: 32, y: 12, z: z++, height: 56, width: 1000, tabOrder: 0 },
      "FactPnL",
      "Landing Thesis",
      15,
      "#0F1C24"
    ),
    textbox(id(), { x: 32, y: 68, z: z++, height: 36, width: 1000, tabOrder: 1 }, [
      {
        text: "Budget→Actual OP bridge · KPI sparklines · CoA statement · drill the exception queue",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicer(id(), { x: 1048, y: 12, z: z++, height: 80, width: 176, tabOrder: 2 }, "DimDate", "YearMonth", "Period"),
    slicer(id(), { x: 1236, y: 12, z: z++, height: 80, width: 192, tabOrder: 3 }, "DimEntity", "EntityName", "Entity"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    kpiCard(
      id(),
      { x: 32, y: 104, z: z++, height: 88, width: 448, tabOrder: 5 },
      "FactPnL",
      "Operating Profit Actual",
      "OP actual (EUR)",
      "#2F5F73"
    ),
    kpiCard(
      id(),
      { x: 496, y: 104, z: z++, height: 88, width: 448, tabOrder: 6 },
      "FactPnL",
      "Operating Profit Budget",
      "OP budget (EUR)",
      "#5A6B75"
    ),
    kpiCard(
      id(),
      { x: 960, y: 104, z: z++, height: 88, width: 448, tabOrder: 7 },
      "FactPnL",
      "Operating Profit Variance",
      "OP gap (EUR)",
      "#B42318"
    ),
    kpiCard(
      id(),
      { x: 1424, y: 104, z: z++, height: 88, width: 464, tabOrder: 8 },
      "FactPnL",
      "OP Gap %",
      "OP gap %",
      "#C17B3A"
    ),
    sparkline(
      id(),
      { x: 32, y: 200, z: z++, height: 64, width: 912, tabOrder: 9 },
      "FactPnL",
      "Operating Profit Actual",
      "#2F5F73",
      "OP actual sparkline"
    ),
    sparkline(
      id(),
      { x: 960, y: 200, z: z++, height: 64, width: 928, tabOrder: 10 },
      "FactPnL",
      "Operating Profit Variance",
      "#B42318",
      "OP gap sparkline"
    ),
    opBridgeWaterfall(
      id(),
      { x: 32, y: 276, z: z++, height: 400, width: 960, tabOrder: 11 },
      "Budget → Actual OP bridge"
    ),
    multiMeasureLine(
      id(),
      { x: 1008, y: 276, z: z++, height: 400, width: 880, tabOrder: 12 },
      "DimDate",
      "YearMonth",
      "MonthYearSort",
      [
        { entity: "FactPnL", measure: "Operating Profit Actual", color: "#2F5F73" },
        { entity: "FactPnL", measure: "Operating Profit Budget", color: "#A8B5BC" },
      ],
      "Operating profit track",
      "Actual vs Budget by month"
    ),
    ...(() => {
      const [statementTable] = buildStatementLayout({
        id,
        tablePosition: { x: 32, y: 692, z: z, height: 284, width: 1000, tabOrder: 13 },
        barsPosition: { x: 0, y: 0, z: 0, height: 1, width: 1, tabOrder: 99 },
        $schema: SCHEMA,
      });
      return [statementTable];
    })(),
    exceptionQueue(
      id(),
      { x: 1056, y: 692, z: z + 1, height: 284, width: 832, tabOrder: 14 },
      "Exception queue - worst leaf OP hits"
    ),
    textbox(id(), { x: 32, y: 992, z: z + 2, height: 36, width: 1856, tabOrder: 15 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Variance Drivers (comparative: Actual/Budget + slope + heat) ---
{
  const p = PAGES.drivers;
  pageChrome(p, "Variance Drivers", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 12, z: z++, height: 48, width: 1000, tabOrder: 0 }, [
      {
        text: "Sweden is the book-breaker - Finland is the only cover that shows on the slope.",
        size: "17pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 56, z: z++, height: 36, width: 1000, tabOrder: 1 }, [
      {
        text: "Compare Actual vs Budget by entity, then watch monthly OP gap by entity. Heat is leaf OP contribution.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    slicer(id(), { x: 1048, y: 12, z: z++, height: 80, width: 176, tabOrder: 2 }, "DimDate", "YearMonth", "Period"),
    slicer(id(), { x: 1236, y: 12, z: z++, height: 80, width: 192, tabOrder: 3 }, "DimEntity", "EntityName", "Entity"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 4 }),
    kpiCard(
      id(),
      { x: 32, y: 104, z: z++, height: 96, width: 608, tabOrder: 5 },
      "FactPnL",
      "Operating Profit Variance",
      "OP gap (EUR)",
      "#B42318"
    ),
    kpiCard(
      id(),
      { x: 656, y: 104, z: z++, height: 96, width: 608, tabOrder: 6 },
      "FactPnL",
      "Leaf Signed Variance",
      "Leaf OP contribution (signed)",
      "#C17B3A"
    ),
    compareBars(
      id(),
      { x: 32, y: 216, z: z++, height: 376, width: 912, tabOrder: 7 },
      "DimEntity",
      "EntityName",
      "OP Actual vs Budget by entity",
      "Ink = actual - grey = budget - gap is the story"
    ),
    seriesLine(
      id(),
      { x: 976, y: 216, z: z++, height: 376, width: 912, tabOrder: 8 },
      "DimDate",
      "YearMonth",
      "MonthYearSort",
      "DimEntity",
      "EntityName",
      "FactPnL",
      "Operating Profit Variance",
      "Monthly OP gap by entity",
      "Slope: which entity pulls the book under plan"
    ),
    matrixVisual(
      id(),
      { x: 32, y: 608, z: z++, height: 368, width: 1856, tabOrder: 9 },
      "DimEntity",
      "EntityName",
      "DimAccount",
      "AccountName",
      "FactPnL",
      "Leaf Signed Variance",
      "Entity x account leaf contribution heat"
    ),
    textbox(id(), { x: 32, y: 992, z: z++, height: 36, width: 1856, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Scenarios ---
{
  const p = PAGES.scenarios;
  pageChrome(p, "Scenarios", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 48, width: 1200, tabOrder: 0 }, [
      {
        text: "Scenarios - What if revenue grows or FX bites?",
        size: "18pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 52, z: z++, height: 36, width: 1400, tabOrder: 1 }, [
      {
        text: "Precomputed OP bands - illustrative multipliers, not a live what-if engine.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    kpiCard(
      id(),
      { x: 32, y: 112, z: z++, height: 108, width: 360, tabOrder: 3 },
      "FactScenario",
      "Scenario OP Base",
      "Base OP (actual)",
      "#0F1C24"
    ),
    kpiCard(
      id(),
      { x: 408, y: 112, z: z++, height: 108, width: 360, tabOrder: 4 },
      "FactScenario",
      "Scenario OP Revenue Up",
      "Revenue +5% OP",
      "#1B7A4E"
    ),
    kpiCard(
      id(),
      { x: 784, y: 112, z: z++, height: 108, width: 360, tabOrder: 5 },
      "FactScenario",
      "Scenario Delta Revenue Up",
      "Delta vs base (+5%)",
      "#1B7A4E"
    ),
    kpiCard(
      id(),
      { x: 1160, y: 112, z: z++, height: 108, width: 360, tabOrder: 6 },
      "FactScenario",
      "Scenario OP FX Hit",
      "FX -3% OP",
      "#B42318"
    ),
    kpiCard(
      id(),
      { x: 1536, y: 112, z: z++, height: 108, width: 352, tabOrder: 7 },
      "FactScenario",
      "Scenario Delta FX Hit",
      "Delta vs base (FX)",
      "#B42318"
    ),
    scenarioLine(
      id(),
      { x: 32, y: 240, z: z++, height: 740, width: 1856, tabOrder: 8 },
      "Operating profit by month - Base / Revenue +5% / FX -3%"
    ),
    textbox(id(), { x: 32, y: 1000, z: z++, height: 36, width: 1856, tabOrder: 9 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Line Profile (hidden drillthrough from exception queue) ---
{
  const p = PAGES.profile;
  pageChrome(p, "Line Profile", drillthroughExtras());
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 56, width: 1200, tabOrder: 0 }, [
      {
        text: "Line Profile",
        size: "22pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 72, z: z++, height: 36, width: 1400, tabOrder: 1 }, [
      {
        text: "Drillthrough from the exception queue — one entity × account leaf in context.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    kpiCard(
      id(),
      { x: 32, y: 128, z: z++, height: 120, width: 448, tabOrder: 2 },
      "FactPnL",
      "Leaf Signed Variance",
      "Leaf OP contribution (signed)",
      "#B42318"
    ),
    kpiCard(
      id(),
      { x: 504, y: 128, z: z++, height: 120, width: 448, tabOrder: 3 },
      "FactPnL",
      "Sum Actual Eur",
      "Actual (EUR)",
      "#2F5F73"
    ),
    kpiCard(
      id(),
      { x: 976, y: 128, z: z++, height: 120, width: 448, tabOrder: 4 },
      "FactPnL",
      "Sum Budget Eur",
      "Budget (EUR)",
      "#5A6B75"
    ),
    kpiCard(
      id(),
      { x: 1448, y: 128, z: z++, height: 120, width: 440, tabOrder: 5 },
      "FactPnL",
      "Sum Variance Eur",
      "Variance (EUR)",
      "#C17B3A"
    ),
    multiMeasureLine(
      id(),
      { x: 32, y: 276, z: z++, height: 400, width: 1856, tabOrder: 6 },
      "DimDate",
      "YearMonth",
      "MonthYearSort",
      [
        { entity: "FactPnL", measure: "Sum Actual Eur", color: "#2F5F73" },
        { entity: "FactPnL", measure: "Sum Budget Eur", color: "#A8B5BC" },
      ],
      "Monthly Actual vs Budget for this line",
      "Filtered by drillthrough entity + account"
    ),
    sparkline(
      id(),
      { x: 32, y: 700, z: z++, height: 120, width: 1856, tabOrder: 7 },
      "FactPnL",
      "Leaf Signed Variance",
      "#B42318",
      "Monthly leaf signed contribution"
    ),
    textbox(id(), { x: 32, y: 848, z: z++, height: 80, width: 1856, tabOrder: 8 }, [
      {
        text: "Use Back to report in the drillthrough header to return to P&L Pulse.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 32, y: 992, z: z++, height: 36, width: 1856, tabOrder: 9 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Context ---
{
  const p = PAGES.context;
  pageChrome(p, "Context", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 16, z: z++, height: 48, width: 900, tabOrder: 0 }, [
      { text: "Context — Reference", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 1 }),
    textbox(id(), { x: 32, y: 120, z: z++, height: 560, width: 1856, tabOrder: 2 }, [
      { text: "Seed conventions", size: "14pt", font: "Segoe UI Semibold", bold: true },
      {
        text: "Multi-entity Nordic P&L (FI/SE/DK/NO) · Actual and Budget in local currency and EUR.",
        size: "12pt",
      },
      {
        text: "StatementLabel carries + / - / = operators so the table reads as a chart of accounts, not a flat measure list.",
        size: "12pt",
      },
      {
        text: "Variance = Actual - Budget (EUR). Totals (Level 0) are computed in the seed, not DAX roll-ups.",
        size: "12pt",
      },
      {
        text: "Signed Variance = VarianceEur x Account Sign so cost overruns read negative (hurt OP). Bars and heat use that sign.",
        size: "12pt",
      },
      {
        text: "OP bridge: DimBridgeStep marks Budget OP and Actual OP with IsTotal. Category uses Budget + leaf steps; waterfall Show total draws Actual OP.",
        size: "12pt",
      },
      {
        text: "Variance Drivers use Leaf Signed Variance (Level = 1) so statement totals are excluded from contribution bars.",
        size: "12pt",
      },
      {
        text: "Exception queue drills to Line Profile (hidden) on EntityName + AccountName.",
        size: "12pt",
      },
      {
        text: "Scenarios are illustrative OP multipliers written to FactScenario - not interactive planning parameters.",
        size: "12pt",
      },
      {
        text: "Not audited financials · not investment advice · portfolio demo seed.",
        size: "12pt",
        color: "#B42318",
      },
    ]),
    textbox(id(), { x: 32, y: 1000, z: z++, height: 36, width: 1856, tabOrder: 3 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// Register theme on report if needed
const reportJsonPath = path.join(REPORT, "definition/report.json");
const reportJson = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
if (!reportJson.themeCollection?.customTheme) {
  reportJson.themeCollection = reportJson.themeCollection || {};
  reportJson.themeCollection.customTheme = {
    name: themeFileName,
    reportVersionAtImport: { visual: "1.8.92", report: "2.0.84", page: "1.3.40" },
    type: "RegisteredResources",
  };
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportJson, null, 2));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pages: PAGES,
      atmosphere: LANDING_ATMOSPHERE,
      profile: "HiddenInViewMode + drillthrough EntityName + AccountName",
      bridge: "DimBridgeStep + Bridge Amount; waterfall totalsEnabled = Actual OP",
      report: REPORT,
    },
    null,
    2
  )
);

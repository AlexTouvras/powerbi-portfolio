/**
 * Elevate Sales Executive report to board-ready Nordic Boardroom quality.
 * Composite KPIs (value + YoY tag), accent bars, insight titles, page nav, polish.
 * Landing is visible page 1 (active on open).
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
const REPORT = path.join(root, "SalesExecutive.Report");
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";
const FOOTER =
  "Source: AdventureWorks-style CRM/ERP sample · Local PBIP · Nordic Boardroom · YoY uses SAMEPERIODLASTYEAR";
/** Four visible pages (Landing + 3 analysis). */
const NAV = { x: 1496, y: 12, height: 80, width: 392 };

const ACCENTS = {
  Revenue: "#2F5F73",
  Orders: "#5B8FA3",
  AOV: "#3D5A6C",
  Customers: "#4A6B5C",
  Units: "#7A6A8A",
  Margin: "#C17B3A",
  Share: "#2F5F73",
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

function resolvePages() {
  const pagesPath = path.join(REPORT, "definition/pages/pages.json");
  let meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
  meta = ensureLandingPage(meta);
  const byDisplay = pageDisplayMap(meta);
  const required = ["Landing", "Portfolio Pulse", "Performance Drivers", "Customer & Market"];
  for (const name of required) {
    if (!byDisplay[name]) throw new Error(`Page "${name}" not found`);
  }
  meta.pageOrder = [
    byDisplay["Landing"],
    byDisplay["Portfolio Pulse"],
    byDisplay["Performance Drivers"],
    byDisplay["Customer & Market"],
  ];
  meta.activePageName = byDisplay["Landing"];
  writePagesMeta(meta);
  return {
    landing: byDisplay["Landing"],
    pulse: byDisplay["Portfolio Pulse"],
    drivers: byDisplay["Performance Drivers"],
    market: byDisplay["Customer & Market"],
    meta,
  };
}

const PAGES = resolvePages();

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
function clearVisuals(pageName) {
  const dir = path.join(REPORT, "definition/pages", pageName, "visuals");
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
    v.visual.syncGroup = {
      groupName: syncGroup,
      fieldChanges: true,
      filterChanges: true,
    };
  }
  return v;
}

function compositeKpiPair(nameValue, nameYoy, pos, measureName, yoyName, accent, label) {
  const gap = 4;
  const hYoy = 44;
  const hVal = pos.height - hYoy - gap;
  const valueCard = {
    $schema: SCHEMA,
    name: nameValue,
    position: {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      height: hVal,
      width: pos.width,
      tabOrder: pos.tabOrder,
    },
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: { projections: [measure("FactSales", measureName)] },
        },
      },
      objects: {
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        accentBar: [
          {
            properties: {
              show: lit(true),
              position: lit("Left"),
              width: litD(4),
              color: solid(accent),
            },
            selector: { id: "default" },
          },
        ],
        layout: [
          {
            properties: {
              topOuterMargin: lit(0),
              bottomOuterMargin: lit(0),
              leftOuterMargin: lit(0),
              rightOuterMargin: lit(0),
              paddingUniform: lit(0),
            },
            selector: { id: "default" },
          },
        ],
        padding: [
          {
            properties: {
              paddingIndividual: lit(true),
              topMargin: lit(0),
              bottomMargin: lit(0),
              leftMargin: lit(12),
              rightMargin: lit(8),
            },
            selector: { id: "default" },
          },
        ],
        spacing: [
          {
            properties: { verticalSpacing: litD(-6) },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: {
              fontSize: litD(24),
              bold: lit(true),
              fontColor: solid(accent),
            },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit(true),
              text: lit(label),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
            },
            selector: { id: "default" },
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
        title: [{ properties: { show: lit(false) } }],
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
  const yoyCard = {
    $schema: SCHEMA,
    name: nameYoy,
    position: {
      x: pos.x,
      y: pos.y + hVal + gap,
      z: pos.z + 1,
      height: hYoy,
      width: pos.width,
      tabOrder: pos.tabOrder + 1,
    },
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: { projections: [measure("FactSales", yoyName)] },
        },
      },
      objects: {
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        layout: [
          {
            properties: {
              topOuterMargin: lit(0),
              bottomOuterMargin: lit(0),
              leftOuterMargin: lit(0),
              rightOuterMargin: lit(0),
              paddingUniform: lit(0),
            },
            selector: { id: "default" },
          },
        ],
        padding: [
          {
            properties: {
              paddingIndividual: lit(true),
              topMargin: lit(0),
              bottomMargin: lit(0),
              leftMargin: lit(12),
              rightMargin: lit(8),
            },
            selector: { id: "default" },
          },
        ],
        spacing: [
          {
            properties: { verticalSpacing: litD(-8) },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: {
              fontSize: litD(12),
              bold: lit(true),
              fontColor: solid("#0F1C24"),
            },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit(true),
              text: lit("YoY"),
              fontSize: litD(8),
              fontColor: solid("#5A6B75"),
            },
            selector: { id: "default" },
          },
        ],
      },
      visualContainerObjects: {
        background: [
          {
            properties: {
              show: lit(true),
              color: solid("#F7FAFC"),
              transparency: litD(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: litD(6),
            },
          },
        ],
        title: [{ properties: { show: lit(false) } }],
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
  return [valueCard, yoyCard];
}

function barChart(name, pos, catEntity, catCol, measureName, title, hue, tint) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(catEntity, catCol)] },
          Y: { projections: [measure("FactSales", measureName)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "FactSales" } },
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
        valueAxis: [
          {
            properties: {
              show: lit(false),
              gridlineShow: lit(false),
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
              fill: {
                solid: {
                  color: {
                    expr: {
                      FillRule: {
                        Input: {
                          Measure: {
                            Expression: {
                              SourceRef: { Entity: "FactSales" },
                            },
                            Property: measureName,
                          },
                        },
                        FillRule: {
                          linearGradient2: {
                            min: {
                              color: {
                                Literal: { Value: `'${tint}'` },
                              },
                            },
                            max: {
                              color: {
                                Literal: { Value: `'${hue}'` },
                              },
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
            },
          },
        ],
        general: [
          {
            properties: {
              responsive: lit(true),
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
              fontSize: litD(12),
              fontColor: solid("#0F1C24"),
              bold: lit(true),
            },
          },
        ],
        subTitle: [{ properties: { show: lit(false) } }],
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
          Y: { projections: [measure("FactSales", "Revenue")] },
        },
      },
      objects: {
        dataPoint: [
          {
            properties: {
              defaultColor: solid("#2F5F73"),
            },
          },
        ],
        labels: [
          {
            properties: {
              show: lit(false),
            },
          },
        ],
        lineStyles: [
          {
            properties: {
              strokeWidth: litD(2.5),
              showMarker: lit(true),
              markerSize: litD(4),
              markerShape: lit("circle"),
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
              fontColor: solid("#0F1C24"),
              bold: lit(true),
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

function simpleCard(name, pos, measureName, accent, label) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: { projections: [measure("FactSales", measureName)] },
        },
      },
      objects: {
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        accentBar: [
          {
            properties: {
              show: lit(true),
              position: lit("Left"),
              width: litD(4),
              color: solid(accent),
            },
            selector: { id: "default" },
          },
        ],
        layout: [
          {
            properties: {
              topOuterMargin: lit(0),
              bottomOuterMargin: lit(0),
              leftOuterMargin: lit(0),
              rightOuterMargin: lit(0),
              paddingUniform: lit(0),
            },
            selector: { id: "default" },
          },
        ],
        padding: [
          {
            properties: {
              paddingIndividual: lit(true),
              topMargin: lit(0),
              bottomMargin: lit(0),
              leftMargin: lit(12),
              rightMargin: lit(8),
            },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: {
              fontSize: litD(22),
              bold: lit(true),
              fontColor: solid(accent),
            },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit(true),
              text: lit(label),
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
            },
            selector: { id: "default" },
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
        title: [{ properties: { show: lit(false) } }],
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

function writePageMeta(pageName, displayName) {
  const page = {
    $schema: PAGE_SCHEMA,
    name: pageName,
    displayName,
    displayOption: "FitToPage",
    height: 1080,
    width: 1920,
    objects: {
      background: [
        {
          properties: {
            color: solid("#F7FAFC"),
            transparency: litD(0),
          },
        },
      ],
      outspacePane: [
        {
          properties: {
            width: litD(200),
            backgroundColor: solid("#FFFFFF"),
            foregroundColor: solid("#0F1C24"),
            border: lit(true),
            borderColor: solid("#E8EEF2"),
            checkboxAndApplyColor: solid("#2F5F73"),
            inputBoxColor: solid("#FFFFFF"),
            fontFamily: lit("Segoe UI"),
            titleSize: litD(11),
            headerSize: litD(10),
          },
        },
      ],
    },
  };
  fs.writeFileSync(
    path.join(REPORT, "definition/pages", pageName, "page.json"),
    JSON.stringify(page, null, 2)
  );
}

function landingChrome(pageKey) {
  ensureLandingAtmosphere(REPORT);
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
          background: pageBackgroundWithAtmosphere("#F7FAFC", 22),
          outspacePane: [{ properties: { width: litD(0) } }],
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
          Values: { projections: [measure("FactSales", measureName)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: litD(56),
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

// --- Pulse ---
function buildPulse() {
  clearVisuals(PAGES.pulse);
  writePageMeta(PAGES.pulse, "Portfolio Pulse");
  const kpis = [
    ["Revenue", "YoY Revenue %", ACCENTS.Revenue, "Revenue"],
    ["Orders", "YoY Orders %", ACCENTS.Orders, "Orders"],
    ["AOV", "YoY AOV %", ACCENTS.AOV, "Avg order value"],
    ["Customers", "YoY Customers %", ACCENTS.Customers, "Customers"],
    ["Units", "YoY Units %", ACCENTS.Units, "Units"],
  ];
  const gap = 16;
  const w = 352;
  const x0 = 32;
  const yKpi = 104;
  const hKpi = 156;

  writeVisual(
    PAGES.pulse,
    textbox(id(), { x: 32, y: 16, z: 0, height: 36, width: 780, tabOrder: 0 }, [
      {
        text: "Portfolio Pulse  -  Revenue and Growth at a Glance",
        font: "Segoe UI Semibold",
        size: "18pt",
        color: "#0F1C24",
        bold: true,
      },
    ])
  );
  writeVisual(
    PAGES.pulse,
    textbox(id(), { x: 32, y: 52, z: 1, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Status in five metrics. Use Year / Country / Category to stress-test the story, then drill to Drivers or Market.",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ])
  );
  writeVisual(
    PAGES.pulse,
      dropdownSlicer(
      id(),
      { x: 900, y: 12, z: 2, height: 80, width: 176, tabOrder: 2 },
      "DimDate",
      "Year",
      "Year",
      "SyncYear"
    )
  );
  writeVisual(
    PAGES.pulse,
    dropdownSlicer(
      id(),
      { x: 1088, y: 12, z: 3, height: 80, width: 176, tabOrder: 3 },
      "DimCustomer",
      "Country",
      "Country",
      "SyncCountry"
    )
  );
  writeVisual(
    PAGES.pulse,
    dropdownSlicer(
      id(),
      { x: 1276, y: 12, z: 4, height: 80, width: 200, tabOrder: 4 },
      "DimProduct",
      "Category",
      "Category",
      "SyncCategory"
    )
  );
  writeVisual(
    PAGES.pulse,
    pageNavigator(id(), { ...NAV, z: 5, tabOrder: 5 })
  );

  kpis.forEach(([m, tag, accent, label], i) => {
    const pair = compositeKpiPair(
      id(),
      id(),
      {
        x: x0 + i * (w + gap),
        y: yKpi,
        z: 10 + i * 2,
        height: hKpi,
        width: w,
        tabOrder: 10 + i * 2,
      },
      m,
      tag,
      accent,
      label
    );
    pair.forEach((v) => writeVisual(PAGES.pulse, v));
  });

  writeVisual(
    PAGES.pulse,
    lineChart(
      id(),
      { x: 32, y: 280, z: 20, height: 732, width: 1120, tabOrder: 20 },
      "Revenue trend by month  -  is growth steady or lumpy?"
    )
  );
  writeVisual(
    PAGES.pulse,
    barChart(
      id(),
      { x: 1176, y: 280, z: 21, height: 732, width: 712, tabOrder: 21 },
      "DimProduct",
      "Category",
      "Revenue",
      "Category mix  -  where revenue concentrates",
      "#2F5F73",
      "#D7E6EC"
    )
  );
  writeVisual(
    PAGES.pulse,
    textbox(
      id(),
      { x: 32, y: 1032, z: 30, height: 28, width: 1856, tabOrder: 30 },
      [
        {
          text: "Source: AdventureWorks-style CRM/ERP sample  ·  Local PBIP  ·  Nordic Boardroom  ·  YoY uses SAMEPERIODLASTYEAR",
          font: "Segoe UI",
          size: "9pt",
          color: "#6B7C86",
        },
      ]
    )
  );
}

function buildDrivers() {
  clearVisuals(PAGES.drivers);
  writePageMeta(PAGES.drivers, "Performance Drivers");

  writeVisual(
    PAGES.drivers,
    textbox(id(), { x: 32, y: 16, z: 0, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Performance Drivers  -  What moves the pulse",
        font: "Segoe UI Semibold",
        size: "18pt",
        color: "#0F1C24",
        bold: true,
      },
    ])
  );
  writeVisual(
    PAGES.drivers,
    textbox(id(), { x: 32, y: 52, z: 1, height: 28, width: 900, tabOrder: 1 }, [
      {
        text: "Filter rail on the left. Rank categories, lines, and top products that explain revenue.",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ])
  );
  writeVisual(
    PAGES.drivers,
    pageNavigator(id(), { ...NAV, z: 2, tabOrder: 2 })
  );

  const rail = [
    ["DimDate", "Year", "Year", "SyncYear"],
    ["DimCustomer", "Country", "Country", "SyncCountry"],
    ["DimProduct", "Category", "Category", "SyncCategory"],
    ["DimProduct", "ProductLine", "Product line", null],
  ];
  rail.forEach(([e, c, t, sync], i) => {
    writeVisual(
      PAGES.drivers,
      dropdownSlicer(
        id(),
        { x: 32, y: 96 + i * 88, z: 3 + i, height: 80, width: 248, tabOrder: 3 + i },
        e,
        c,
        t,
        sync
      )
    );
  });

  writeVisual(
    PAGES.drivers,
    simpleCard(
      id(),
      { x: 32, y: 456, z: 8, height: 100, width: 248, tabOrder: 8 },
      "Margin %",
      ACCENTS.Margin,
      "Gross margin %"
    )
  );
  writeVisual(
    PAGES.drivers,
    simpleCard(
      id(),
      { x: 32, y: 572, z: 9, height: 100, width: 248, tabOrder: 9 },
      "YoY Revenue %",
      ACCENTS.Share,
      "Revenue YoY %"
    )
  );

  writeVisual(
    PAGES.drivers,
    barChart(
      id(),
      { x: 304, y: 96, z: 10, height: 380, width: 780, tabOrder: 10 },
      "DimProduct",
      "Category",
      "Revenue",
      "Revenue by category",
      "#2F5F73",
      "#D7E6EC"
    )
  );
  writeVisual(
    PAGES.drivers,
    barChart(
      id(),
      { x: 1104, y: 96, z: 11, height: 380, width: 784, tabOrder: 11 },
      "DimProduct",
      "ProductLine",
      "Revenue",
      "Revenue by product line",
      "#C17B3A",
      "#F3E4D4"
    )
  );
  writeVisual(
    PAGES.drivers,
    barChart(
      id(),
      { x: 304, y: 500, z: 12, height: 512, width: 1584, tabOrder: 12 },
      "DimProduct",
      "ProductName",
      "Revenue Top15 Products",
      "Top 15 products by revenue  -  intervene or lean in here",
      "#5B8FA3",
      "#E2EEF3"
    )
  );
  writeVisual(
    PAGES.drivers,
    textbox(
      id(),
      { x: 32, y: 1032, z: 30, height: 28, width: 1856, tabOrder: 30 },
      [
        {
          text: "Drivers page  ·  Self-serve product structure  ·  Top 15 uses RANKX on selected context",
          font: "Segoe UI",
          size: "9pt",
          color: "#6B7C86",
        },
      ]
    )
  );
}

function buildMarket() {
  clearVisuals(PAGES.market);
  writePageMeta(PAGES.market, "Customer & Market");

  writeVisual(
    PAGES.market,
    textbox(id(), { x: 32, y: 16, z: 0, height: 36, width: 900, tabOrder: 0 }, [
      {
        text: "Customer & Market  -  Concentration and opportunity",
        font: "Segoe UI Semibold",
        size: "18pt",
        color: "#0F1C24",
        bold: true,
      },
    ])
  );
  writeVisual(
    PAGES.market,
    textbox(id(), { x: 32, y: 52, z: 1, height: 28, width: 1000, tabOrder: 1 }, [
      {
        text: "Where revenue lives geographically, how markets grow YoY, and which customers dominate the book.",
        font: "Segoe UI",
        size: "11pt",
        color: "#5A6B75",
      },
    ])
  );
  writeVisual(
    PAGES.market,
    dropdownSlicer(
      id(),
      { x: 900, y: 12, z: 2, height: 80, width: 176, tabOrder: 2 },
      "DimDate",
      "Year",
      "Year",
      "SyncYear"
    )
  );
  writeVisual(
    PAGES.market,
    dropdownSlicer(
      id(),
      { x: 1088, y: 12, z: 3, height: 80, width: 176, tabOrder: 3 },
      "DimProduct",
      "Category",
      "Category",
      "SyncCategory"
    )
  );
  writeVisual(
    PAGES.market,
    dropdownSlicer(
      id(),
      { x: 1276, y: 12, z: 4, height: 80, width: 200, tabOrder: 4 },
      "DimCustomer",
      "CustomerName",
      "Customer",
      null
    )
  );
  writeVisual(
    PAGES.market,
    pageNavigator(id(), { ...NAV, z: 5, tabOrder: 5 })
  );

  writeVisual(
    PAGES.market,
    simpleCard(
      id(),
      { x: 32, y: 104, z: 6, height: 100, width: 300, tabOrder: 6 },
      "YoY Revenue %",
      ACCENTS.Share,
      "Revenue YoY %"
    )
  );
  writeVisual(
    PAGES.market,
    simpleCard(
      id(),
      { x: 348, y: 104, z: 7, height: 100, width: 300, tabOrder: 7 },
      "Customers",
      ACCENTS.Customers,
      "Active customers"
    )
  );
  writeVisual(
    PAGES.market,
    simpleCard(
      id(),
      { x: 664, y: 104, z: 8, height: 100, width: 300, tabOrder: 8 },
      "AOV",
      ACCENTS.AOV,
      "Avg order value"
    )
  );

  writeVisual(
    PAGES.market,
    barChart(
      id(),
      { x: 32, y: 224, z: 10, height: 360, width: 920, tabOrder: 10 },
      "DimCustomer",
      "Country",
      "Revenue",
      "Revenue by country  -  geographic concentration",
      "#2F5F73",
      "#D7E6EC"
    )
  );
  writeVisual(
    PAGES.market,
    barChart(
      id(),
      { x: 976, y: 224, z: 11, height: 360, width: 912, tabOrder: 11 },
      "DimCustomer",
      "Country",
      "YoY Revenue %",
      "YoY revenue % by country  -  growth vs drag",
      "#4A6B5C",
      "#E4EDE8"
    )
  );
  writeVisual(
    PAGES.market,
    barChart(
      id(),
      { x: 32, y: 608, z: 12, height: 400, width: 1856, tabOrder: 12 },
      "DimCustomer",
      "CustomerName",
      "Revenue Top15 Customers",
      "Top 15 customers by revenue  -  relationship risk and opportunity",
      "#C17B3A",
      "#F3E4D4"
    )
  );
  writeVisual(
    PAGES.market,
    textbox(
      id(),
      { x: 32, y: 1032, z: 30, height: 28, width: 1856, tabOrder: 30 },
      [
        {
          text: "Customer & Market  ·  Concentration KPIs above rankings  ·  Dual-channel YoY on Pulse cards",
          font: "Segoe UI",
          size: "9pt",
          color: "#6B7C86",
        },
      ]
    )
  );
}

// Report settings: quieter chrome
const reportPath = path.join(REPORT, "definition/report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
report.settings = {
  useStylableVisualContainerHeader: true,
  exportDataMode: "AllowSummarized",
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// --- Landing ---
function buildLanding() {
  clearVisuals(PAGES.landing);
  landingChrome(PAGES.landing);
  let z = 0;
  writeVisual(
    PAGES.landing,
    shapeRect(id(), { x: 0, y: 0, z: z++, height: 1080, width: 14, tabOrder: 0 }, "#2F5F73")
  );
  writeVisual(PAGES.landing, pageNavigator(id(), { ...NAV, z: z++, tabOrder: 1 }));
  writeVisual(
    PAGES.landing,
    shapeRect(id(), { x: 56, y: 112, z: z++, height: 900, width: 1808, tabOrder: 2 }, "#FFFFFF")
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 160, z: z++, height: 88, width: 1100, tabOrder: 3 }, [
      {
        text: "Sales Executive",
        font: "Segoe UI Semibold",
        size: "40pt",
        bold: true,
      },
    ])
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 256, z: z++, height: 72, width: 1100, tabOrder: 4 }, [
      {
        text: "Portfolio health for the board in one glance — then self-serve into drivers and markets.",
        font: "Segoe UI",
        size: "18pt",
        color: "#5A6B75",
      },
    ])
  );
  writeVisual(
    PAGES.landing,
    shapeRect(id(), { x: 96, y: 348, z: z++, height: 4, width: 280, tabOrder: 5 }, "#B87333")
  );
  writeVisual(
    PAGES.landing,
    editorialHero(
      id(),
      { x: 1280, y: 180, z: z++, height: 220, width: 520, tabOrder: 6 },
      "Revenue",
      "#2F5F73",
      "Revenue"
    )
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 400, z: z++, height: 36, width: 1100, tabOrder: 7 }, [
      {
        text: "Audience · CEO / CFO / CRO / board",
        font: "Segoe UI",
        size: "14pt",
        color: "#0F1C24",
      },
    ])
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 480, z: z++, height: 280, width: 1100, tabOrder: 8 }, [
      {
        text: "What you’ll see",
        font: "Segoe UI Semibold",
        size: "16pt",
        bold: true,
      },
      { text: "01  Portfolio Pulse — revenue and growth at a glance", size: "15pt" },
      { text: "02  Performance Drivers — category and product contribution", size: "15pt" },
      { text: "03  Customer & Market — geography and concentration", size: "15pt" },
    ])
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 800, z: z++, height: 100, width: 1100, tabOrder: 9 }, [
      {
        text: "Signature",
        font: "Segoe UI Semibold",
        size: "14pt",
        bold: true,
      },
      {
        text: "Dual-channel YoY on Pulse cards — value plus direction in the same glance.",
        font: "Segoe UI",
        size: "14pt",
        color: "#5A6B75",
      },
    ])
  );
  writeVisual(
    PAGES.landing,
    textbox(id(), { x: 96, y: 960, z: z++, height: 28, width: 1700, tabOrder: 10 }, [
      { text: FOOTER, font: "Segoe UI", size: "9pt", color: "#6B7C86" },
    ])
  );
}

buildLanding();
buildPulse();
buildDrivers();
buildMarket();
console.log("Elevated report written.");

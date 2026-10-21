/**
 * Elevate Study Duration — Landing poster · Pulse instrument · Argument Deneb · Context.
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
  buildDenebKm,
  buildDenebForest,
  buildDenebBetaTPanel,
  DENEB_GUID,
  ensureDenebPublicVisual,
} from "../../_shared/deneb/deneb-binders.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REPORT = path.join(root, "StudyDuration.Report");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

const FOOTER =
  "OULAD open-university modules · one row per student×module start · Nordic Boardroom · not an intervention product";
const NAV = { x: 1448, y: 12, z: 50, height: 80, width: 440 };
/** Plain-language claim for Landing / Argument headers */
const CLAIM =
  "Students leave module CCC almost twice as fast as FFF — the quiet reference course.";
const SUBCLAIM =
  "Open University online modules (OULAD). We follow each registration from day 0 until withdrawal or course end.";
const SCALE =
  "29,824 starts · 7,387 withdrawals (24.8%) · seven modules AAA–GGG · FFF is the comparison baseline.";

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
    field: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: name } },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
}
function column(entity, name, active = true) {
  const p = {
    field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: name } },
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
  };
  if (active) p.active = true;
  return p;
}

function cardChrome(title, subtitle) {
  const chrome = {
    background: [{ properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } }],
    border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
    visualHeader: [{ properties: { show: lit(false) } }],
    padding: [{ properties: { top: litD(8), bottom: litD(8), left: litD(12), right: litD(12) } }],
  };
  if (title) {
    chrome.title = [
      {
        properties: {
          show: lit(true),
          text: lit(title),
          fontSize: litD(12),
          fontColor: solid("#0F1C24"),
          fontFamily: lit("Segoe UI Semibold"),
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
          fontSize: litD(10),
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
                horizontalTextAlignment: r.align || "left",
              })),
            },
          },
        ],
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
        ...cardChrome(title),
      },
    },
  };
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
        labels: [
          {
            properties: {
              fontSize: litD(56),
              bold: lit(true),
              color: solid(accent),
              fontFamily: lit("Consolas"),
            },
          },
        ],
        categoryLabels: [{ properties: { show: lit(false) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: lit(true), color: solid("#F7FAFC"), transparency: litD(0) } }],
        border: [{ properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } }],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(caption),
              fontSize: litD(11),
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

function columnChart(name, pos, catEntity, catCol, measureEntity, measureName, title, accent, highlightValue) {
  const dataPoint = [{ properties: { defaultColor: solid(accent) } }];
  if (highlightValue) {
    dataPoint.push({
      properties: { fill: solid("#B42318") },
      selector: {
        data: [
          {
            scopeId: {
              Comparison: {
                ComparisonKind: 0,
                Left: {
                  Column: {
                    Expression: { SourceRef: { Entity: catEntity } },
                    Property: catCol,
                  },
                },
                Right: { Literal: { Value: `'${highlightValue}'` } },
              },
            },
          },
        ],
      },
    });
  }
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
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: measureEntity } },
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
        legend: [{ properties: { show: lit(false) } }],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              gridlineShow: lit(true),
              gridlineColor: solid("#EEF2F5"),
              labelColor: solid("#5A6B75"),
              fontSize: litD(9),
              showAxisTitle: lit(false),
              labelDisplayUnits: lit("0"),
            },
          },
        ],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(10),
            },
          },
        ],
        dataPoint,
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function barChart(name, pos, catEntity, catCol, measureEntity, measureName, title, accent) {
  return {
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
              labelDisplayUnits: lit("0"),
              fontSize: litD(9),
              color: solid("#0F1C24"),
            },
          },
        ],
        legend: [{ properties: { show: lit(false) } }],
        valueAxis: [{ properties: { show: lit(false), gridlineShow: lit(false) } }],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid("#5A6B75"),
              fontSize: litD(10),
            },
          },
        ],
        dataPoint: [{ properties: { defaultColor: solid(accent) } }],
      },
      visualContainerObjects: cardChrome(title),
    },
  };
}

function matrixSummary(name, pos, title) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "pivotTable",
      query: {
        queryState: {
          Rows: { projections: [column("StratumSummary", "Stratum")] },
          Values: {
            projections: [
              measure("StratumSummary", "Stratum N"),
              measure("StratumSummary", "Stratum Events"),
              measure("StratumSummary", "Restricted Mean"),
              measure("StratumSummary", "RM vs FFF"),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: "StratumSummary" } },
                  Property: "RM vs FFF",
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        rowHeaders: [
          {
            properties: {
              fontSize: litD(11),
              fontColor: solid("#0F1C24"),
              bold: lit(true),
            },
          },
        ],
        columnHeaders: [
          {
            properties: {
              fontSize: litD(10),
              fontColor: solid("#5A6B75"),
              bold: lit(true),
              autoSizeColumnWidth: lit(true),
            },
          },
        ],
        values: [
          {
            properties: {
              fontSize: litD(11),
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
      visualContainerObjects: cardChrome(title),
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
            { properties: { width: { expr: { Literal: { Value: `${outspaceWidth}D` } } } } },
          ],
        },
      },
      null,
      2
    )
  );
}

const pagesPath = path.join(REPORT, "definition/pages/pages.json");
const meta = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
const byDisplay = pageDisplayMap(meta);
const PAGES = {
  landing: byDisplay["Landing"],
  pulse: byDisplay["Pulse"],
  argument: byDisplay["Argument"],
  context: byDisplay["Context"],
};
if (!PAGES.landing || !PAGES.pulse || !PAGES.argument || !PAGES.context) {
  throw new Error("Missing pages — run scaffold-study-duration-pbip.mjs first");
}

ensureDenebPublicVisual(path.join(REPORT, "definition/report.json"));

const LANDING_ATMOSPHERE = "valley-dusk";
ensureLandingAtmosphere(REPORT, LANDING_ATMOSPHERE);

// --- Landing (portfolio poster) ---
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
          background: pageBackgroundWithAtmosphere("#F7FAFC", 22, LANDING_ATMOSPHERE),
        },
      },
      null,
      2
    )
  );
  clearVisuals(p);
  let z = 0;
  const visuals = [
    shapeRect(id(), { x: 48, y: 72, z: z++, height: 780, width: 14, tabOrder: 0 }, "#2F5F73"),
    shapeRect(id(), { x: 62, y: 72, z: z++, height: 780, width: 1320, tabOrder: 1 }, "#FFFFFF"),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    textbox(id(), { x: 96, y: 96, z: z++, height: 60, width: 820, tabOrder: 3 }, [
      { text: "Study Duration", size: "36pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 96, y: 156, z: z++, height: 36, width: 820, tabOrder: 4 }, [
      {
        text: "Who leaves an online module early — and which course codes lose them first.",
        size: "14pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 96, y: 204, z: z++, height: 72, width: 820, tabOrder: 5 }, [
      { text: CLAIM, size: "16pt", font: "Segoe UI Semibold", bold: true, color: "#0F1C24" },
    ]),
    shapeRect(id(), { x: 96, y: 288, z: z++, height: 4, width: 220, tabOrder: 6 }, "#B87333"),
    textbox(id(), { x: 96, y: 308, z: z++, height: 64, width: 820, tabOrder: 7 }, [
      { text: SUBCLAIM, size: "13pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 96, y: 384, z: z++, height: 200, width: 820, tabOrder: 8 }, [
      { text: "What you'll see", size: "14pt", font: "Segoe UI Semibold", bold: true },
      { text: "01  Pulse — how often each module loses students, and how many days they keep", size: "13pt" },
      { text: "02  Argument — stay-enrolled curves over time, and what raises withdrawal risk", size: "13pt" },
      { text: "03  Context — data clock, source licence, fit hash", size: "13pt" },
    ]),
    textbox(id(), { x: 96, y: 600, z: z++, height: 88, width: 820, tabOrder: 9 }, [
      {
        text: "Read it as a programme view: same clock for every module, FFF as baseline, CCC as the early-exit problem.",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    editorialHero(
      id(),
      { x: 960, y: 140, z: z++, height: 220, width: 360, tabOrder: 10 },
      "FactRegistration",
      "Withdrawal Rate",
      "#B42318",
      "Share who leave before the end"
    ),
    textbox(id(), { x: 960, y: 380, z: z++, height: 160, width: 360, tabOrder: 11 }, [
      { text: SCALE, size: "12pt", color: "#5A6B75" },
    ]),
    textbox(id(), { x: 96, y: 780, z: z++, height: 36, width: 1240, tabOrder: 12 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Pulse ---
{
  const p = PAGES.pulse;
  pageChrome(p, "Pulse", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 12, z: z++, height: 48, width: 1200, tabOrder: 0 }, [
      {
        text: "Nearly one in four module starts ends in withdrawal — CCC is the worst share.",
        size: "17pt",
        font: "Segoe UI Semibold",
        bold: true,
      },
    ]),
    textbox(id(), { x: 32, y: 60, z: z++, height: 32, width: 1400, tabOrder: 1 }, [
      {
        text: "Pulse = counts and days kept. Argument = the survival curves and risk model behind the claim.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 2 }),
    kpiCard(id(), { x: 32, y: 108, z: z++, height: 112, width: 448, tabOrder: 3 }, "FactRegistration", "Registrations", "Module starts", "#2F5F73"),
    kpiCard(id(), { x: 504, y: 108, z: z++, height: 112, width: 448, tabOrder: 4 }, "FactRegistration", "Withdrawals", "Withdrawals", "#B42318"),
    kpiCard(id(), { x: 976, y: 108, z: z++, height: 112, width: 448, tabOrder: 5 }, "FactRegistration", "Withdrawal Rate", "Withdrawal share", "#C17B3A"),
    kpiCard(id(), { x: 1448, y: 108, z: z++, height: 112, width: 440, tabOrder: 6 }, "ModelMetrics", "Fit Concordance", "Model ranking ability", "#4A6B5C"),
    columnChart(
      id(),
      { x: 32, y: 240, z: z++, height: 420, width: 920, tabOrder: 7 },
      "FactRegistration",
      "Stratum",
      "FactRegistration",
      "Withdrawal Rate",
      "Share who withdraw — by module code",
      "#2F5F73",
      "CCC"
    ),
    barChart(
      id(),
      { x: 968, y: 240, z: z++, height: 420, width: 920, tabOrder: 8 },
      "StratumSummary",
      "Stratum",
      "StratumSummary",
      "RM vs FFF",
      "Extra / fewer days kept vs FFF",
      "#C17B3A"
    ),
    matrixSummary(
      id(),
      { x: 32, y: 680, z: z++, height: 280, width: 1856, tabOrder: 9 },
      "By module — starts, withdrawals, average days kept (vs FFF)"
    ),
    textbox(id(), { x: 32, y: 992, z: z++, height: 36, width: 1856, tabOrder: 10 }, [
      { text: FOOTER, size: "9pt", color: "#6B7C86" },
    ]),
  ];
  visuals.forEach((v) => writeVisual(p, v));
}

// --- Argument (Deneb binders) ---
{
  const p = PAGES.argument;
  pageChrome(p, "Argument", 0);
  clearVisuals(p);
  let z = 0;
  const visuals = [
    textbox(id(), { x: 32, y: 8, z: z++, height: 40, width: 1400, tabOrder: 0 }, [
      { text: CLAIM, size: "14pt", font: "Segoe UI Semibold", bold: true },
    ]),
    textbox(id(), { x: 32, y: 48, z: z++, height: 28, width: 1400, tabOrder: 1 }, [
      {
        text: "Argument = time-to-withdrawal evidence. Curves = still enrolled; forest = how much faster/slower than FFF; right panels = when that “faster” is not constant.",
        size: "11pt",
        color: "#5A6B75",
      },
    ]),
    pageNavigator(id(), { ...NAV, y: 8, z: z++, tabOrder: 2 }),
    buildDenebKm(
      id(),
      { x: 32, y: 84, z: z++, height: 336, width: 1856, tabOrder: 3 },
      "Still enrolled over time — CCC (red) drops fastest",
      ""
    ),
    buildDenebForest(
      id(),
      { x: 32, y: 436, z: z++, height: 524, width: 900, tabOrder: 4 },
      "What raises withdrawal risk vs FFF (1 = same pace)",
      ""
    ),
    buildDenebBetaTPanel(
      id(),
      { x: 948, y: 436, z: z++, height: 168, width: 940, tabOrder: 5 },
      "StudiedCredits",
      "Risk over time · credit load"
    ),
    buildDenebBetaTPanel(
      id(),
      { x: 948, y: 612, z: z++, height: 168, width: 940, tabOrder: 6 },
      "Disability",
      "Risk over time · disability"
    ),
    buildDenebBetaTPanel(
      id(),
      { x: 948, y: 788, z: z++, height: 172, width: 940, tabOrder: 7 },
      "Stratum[AAA]",
      "Risk over time · module AAA"
    ),
    textbox(id(), { x: 32, y: 976, z: z++, height: 36, width: 1856, tabOrder: 8 }, [
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
    textbox(id(), { x: 32, y: 16, z: z++, height: 48, width: 1200, tabOrder: 0 }, [
      { text: "Context — what this analysis is", size: "18pt", font: "Segoe UI Semibold", bold: true },
    ]),
    pageNavigator(id(), { ...NAV, z: z++, tabOrder: 1 }),
    shapeRect(id(), { x: 32, y: 100, z: z++, height: 400, width: 900, tabOrder: 2 }, "#FFFFFF"),
    shapeRect(id(), { x: 952, y: 100, z: z++, height: 400, width: 936, tabOrder: 3 }, "#FFFFFF"),
    textbox(id(), { x: 56, y: 120, z: z++, height: 360, width: 850, tabOrder: 4 }, [
      { text: "Subject", size: "14pt", font: "Segoe UI Semibold", bold: true },
      {
        text: "Open University Learning Analytics Dataset (OULAD): virtual-learning modules coded AAA–GGG.",
        size: "12pt",
        color: "#5A6B75",
      },
      {
        text: "Unit of analysis: one student starting one module presentation. Outcome: days until Withdrawal (or censored if they stay to Pass / Fail / Distinction).",
        size: "12pt",
        color: "#5A6B75",
      },
      {
        text: "Question for a programme lead: which module codes shed students earliest, relative to FFF?",
        size: "12pt",
        color: "#5A6B75",
      },
      {
        text: "Clock starts at module day 0. Pulse’s “days kept” uses a shared horizon (τ = 262). The CCC vs FFF claim is judged on the early window (≈100 days).",
        size: "12pt",
        color: "#5A6B75",
      },
    ]),
    textbox(id(), { x: 976, y: 120, z: z++, height: 360, width: 880, tabOrder: 5 }, [
      { text: "Evidence and limits", size: "14pt", font: "Segoe UI Semibold", bold: true },
      {
        text: "Argument charts come from an approved duration fit on disk (data/fit-draft/APPROVED) — Kaplan–Meier curves, Cox hazard ratios, and β(t) checks when risk is not constant over time.",
        size: "12pt",
        color: "#5A6B75",
      },
      {
        text: "Deneb AppSource visual required in Desktop (GUID deneb7E15AEF80B9E4D4F8E12924291ECE89A).",
        size: "12pt",
        color: "#5A6B75",
      },
      {
        text: "OULAD · CC BY 4.0 · portfolio demonstration · not clinical or intervention advice.",
        size: "12pt",
        color: "#B42318",
      },
    ]),
    textbox(id(), { x: 32, y: 1000, z: z++, height: 36, width: 1856, tabOrder: 6 }, [
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
      atmosphere: LANDING_ATMOSPHERE,
      deneb: DENEB_GUID,
      claim: CLAIM,
      report: REPORT,
    },
    null,
    2
  )
);

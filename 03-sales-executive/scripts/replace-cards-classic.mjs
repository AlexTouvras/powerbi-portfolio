/**
 * Replace blank cardVisual KPIs with classic `card` (Values role).
 * cardVisual is validating but rendering empty in this Desktop session.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PAGES = {
  pulse: "ReportSection035c09e2ea04501067c189c6",
  drivers: "ReportSection627401f3bc0ed21de870c88d",
  market: "ReportSection8bec1e38448cf01490d178d1",
};
const ROOT =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages";
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

function lit(v) {
  if (typeof v === "boolean")
    return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number")
    return { expr: { Literal: { Value: `${v}D` } } };
  return { expr: { Literal: { Value: `'${String(v).replace(/'/g, "''")}'` } } };
}
function solid(hex) {
  return { solid: { color: { expr: { Literal: { Value: `'${hex}'` } } } } };
}
function measureValues(name) {
  return {
    field: {
      Measure: {
        Expression: { SourceRef: { Entity: "FactSales" } },
        Property: name,
      },
    },
    queryRef: `FactSales.${name}`,
    nativeQueryRef: name,
  };
}

function removeCards(pageKey) {
  const dir = path.join(ROOT, PAGES[pageKey], "visuals");
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const vp = path.join(dir, e.name, "visual.json");
    const j = JSON.parse(fs.readFileSync(vp, "utf8"));
    if (j.visual?.visualType === "cardVisual" || j.visual?.visualType === "card") {
      fs.rmSync(path.join(dir, e.name), { recursive: true, force: true });
    }
  }
}

function writeCard(pageKey, pos, measure, label, accent) {
  const name = crypto.randomBytes(10).toString("hex");
  const visual = {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measureValues(measure)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: lit(pos.height >= 100 ? 28 : 16),
              bold: lit(true),
              color: solid(accent || "#0F1C24"),
            },
          },
        ],
        categoryLabels: [
          {
            properties: {
              show: lit(true),
              fontSize: lit(10),
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
              transparency: lit(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: lit(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(label),
              fontSize: lit(10),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: lit(8),
              bottom: lit(8),
              left: lit(12),
              right: lit(8),
            },
          },
        ],
      },
    },
  };
  // Left accent via border isn't available on classic card — use title as label
  const dir = path.join(ROOT, PAGES[pageKey], "visuals", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
  console.log(pageKey, measure, name);
}

// --- Pulse: 5 value + 5 YoY ---
removeCards("pulse");
const pulse = [
  ["Revenue", "Revenue", "#2F5F73"],
  ["Orders", "Orders", "#5B8FA3"],
  ["AOV", "Avg order value", "#3D5A6C"],
  ["Customers", "Customers", "#4A6B5C"],
  ["Units", "Units", "#7A6A8A"],
];
const yoy = [
  ["YoY Revenue %", "YoY revenue"],
  ["YoY Orders %", "YoY orders"],
  ["YoY AOV %", "YoY AOV"],
  ["YoY Customers %", "YoY customers"],
  ["YoY Units %", "YoY units"],
];
const gap = 16;
const w = 352;
const x0 = 32;
pulse.forEach(([m, label, accent], i) => {
  writeCard(
    "pulse",
    {
      x: x0 + i * (w + gap),
      y: 104,
      z: 10 + i,
      height: 112,
      width: w,
      tabOrder: 10 + i,
    },
    m,
    label,
    accent
  );
});
yoy.forEach(([m, label], i) => {
  writeCard(
    "pulse",
    {
      x: x0 + i * (w + gap),
      y: 224,
      z: 20 + i,
      height: 72,
      width: w,
      tabOrder: 20 + i,
    },
    m,
    label,
    "#0F1C24"
  );
});

// --- Drivers: Margin + YoY under filter rail ---
removeCards("drivers");
writeCard(
  "drivers",
  { x: 32, y: 456, z: 8, height: 100, width: 248, tabOrder: 8 },
  "Margin %",
  "Gross margin %",
  "#C17B3A"
);
writeCard(
  "drivers",
  { x: 32, y: 572, z: 9, height: 100, width: 248, tabOrder: 9 },
  "YoY Revenue %",
  "Revenue YoY %",
  "#2F5F73"
);

// --- Market: 3 KPIs ---
removeCards("market");
writeCard(
  "market",
  { x: 32, y: 104, z: 6, height: 100, width: 300, tabOrder: 6 },
  "YoY Revenue %",
  "Revenue YoY %",
  "#2F5F73"
);
writeCard(
  "market",
  { x: 348, y: 104, z: 7, height: 100, width: 300, tabOrder: 7 },
  "Customers",
  "Active customers",
  "#4A6B5C"
);
writeCard(
  "market",
  { x: 664, y: 104, z: 8, height: 100, width: 300, tabOrder: 8 },
  "AOV",
  "Avg order value",
  "#3D5A6C"
);

console.log("done");

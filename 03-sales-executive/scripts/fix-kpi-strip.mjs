import fs from "fs";
import path from "path";
import crypto from "crypto";

const pageDir =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages/ReportSection035c09e2ea04501067c189c6";
const visualsDir = path.join(pageDir, "visuals");
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

function lit(v) {
  if (typeof v === "boolean")
    return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number")
    return {
      expr: { Literal: { Value: Number.isInteger(v) ? `${v}D` : `${v}D` } },
    };
  return { expr: { Literal: { Value: `'${v}'` } } };
}
function solid(hex) {
  return { solid: { color: { expr: { Literal: { Value: `'${hex}'` } } } } };
}
function measureProj(measure) {
  return {
    field: {
      Measure: {
        Expression: { SourceRef: { Entity: "FactSales" } },
        Property: measure,
      },
    },
    queryRef: `FactSales.${measure}`,
    nativeQueryRef: measure,
  };
}

for (const e of fs.readdirSync(visualsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const vp = path.join(visualsDir, e.name, "visual.json");
  if (!fs.existsSync(vp)) continue;
  const j = JSON.parse(fs.readFileSync(vp, "utf8"));
  if (j.visual?.visualType === "cardVisual") {
    fs.rmSync(path.join(visualsDir, e.name), { recursive: true, force: true });
  }
}

const kpis = [
  { m: "Revenue", yoy: "YoY Revenue %", accent: "#2F5F73", label: "Revenue" },
  { m: "Orders", yoy: "YoY Orders %", accent: "#5B8FA3", label: "Orders" },
  { m: "AOV", yoy: "YoY AOV %", accent: "#3D5A6C", label: "Avg order value" },
  {
    m: "Customers",
    yoy: "YoY Customers %",
    accent: "#4A6B5C",
    label: "Customers",
  },
  { m: "Units", yoy: "YoY Units %", accent: "#7A6A8A", label: "Units" },
];

const gap = 16;
const width = 352;
const startX = 32;
const yVal = 104;
const hVal = 120;
const yYoy = 232;
const hYoy = 52;

kpis.forEach((k, i) => {
  const x = startX + i * (width + gap);
  const name = crypto.randomBytes(10).toString("hex");
  const visual = {
    $schema: SCHEMA,
    name,
    position: { x, y: yVal, z: 10 + i, height: hVal, width, tabOrder: 10 + i },
    visual: {
      visualType: "cardVisual",
      query: { queryState: { Data: { projections: [measureProj(k.m)] } } },
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
              width: lit(4),
              color: solid(k.accent),
            },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: {
              fontSize: lit(26),
              bold: lit(true),
              fontColor: solid(k.accent),
            },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit(true),
              text: lit(k.label),
              fontSize: lit(10),
              fontColor: solid("#5A6B75"),
            },
            selector: { id: "default" },
          },
        ],
        spacing: [
          {
            properties: { verticalSpacing: lit(-6) },
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
        title: [{ properties: { show: lit(false) } }],
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
  fs.mkdirSync(path.join(visualsDir, name), { recursive: true });
  fs.writeFileSync(
    path.join(visualsDir, name, "visual.json"),
    JSON.stringify(visual, null, 2)
  );

  const yName = crypto.randomBytes(10).toString("hex");
  const yVisual = {
    $schema: SCHEMA,
    name: yName,
    position: {
      x,
      y: yYoy,
      z: 20 + i,
      height: hYoy,
      width,
      tabOrder: 20 + i,
    },
    visual: {
      visualType: "cardVisual",
      query: { queryState: { Data: { projections: [measureProj(k.yoy)] } } },
      objects: {
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: { fontSize: lit(14), bold: lit(true) },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: {
              show: lit(true),
              text: lit("YoY"),
              fontSize: lit(9),
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
              transparency: lit(0),
            },
          },
        ],
        border: [
          {
            properties: {
              show: lit(true),
              color: solid("#E8EEF2"),
              radius: lit(6),
            },
          },
        ],
        title: [{ properties: { show: lit(false) } }],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: lit(4),
              bottom: lit(4),
              left: lit(8),
              right: lit(8),
            },
          },
        ],
      },
    },
  };
  fs.mkdirSync(path.join(visualsDir, yName), { recursive: true });
  fs.writeFileSync(
    path.join(visualsDir, yName, "visual.json"),
    JSON.stringify(yVisual, null, 2)
  );
  console.log(k.m, name, yName);
});

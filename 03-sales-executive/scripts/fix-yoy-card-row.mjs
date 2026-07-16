/**
 * Fix Pulse second-row YoY cards: denser layout, arrow measures, no duplicate labels.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const visualsDir =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages/ReportSection035c09e2ea04501067c189c6/visuals";
const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

function lit(v) {
  if (typeof v === "boolean")
    return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number")
    return { expr: { Literal: { Value: `${v}D` } } };
  return { expr: { Literal: { Value: `'${v}'` } } };
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

// Remove existing YoY row cards (y >= 200 classic cards)
for (const e of fs.readdirSync(visualsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const vp = path.join(visualsDir, e.name, "visual.json");
  const j = JSON.parse(fs.readFileSync(vp, "utf8"));
  if (j.visual?.visualType !== "card") continue;
  if ((j.position?.y ?? 0) < 200) continue;
  fs.rmSync(path.join(visualsDir, e.name), { recursive: true, force: true });
  console.log("removed", e.name);
}

// Arrow text measures already in model: Rev YoY, Ord YoY, AOV YoY, Cust YoY, Unit YoY
const row = [
  { m: "Rev YoY", label: "vs prior year", color: "#0F1C24" },
  { m: "Ord YoY", label: "vs prior year", color: "#0F1C24" },
  { m: "AOV YoY", label: "vs prior year", color: "#0F1C24" },
  { m: "Cust YoY", label: "vs prior year", color: "#0F1C24" },
  { m: "Unit YoY", label: "vs prior year", color: "#0F1C24" },
];

const gap = 16;
const width = 352;
const startX = 32;
const y = 224;
const height = 80;

row.forEach((k, i) => {
  const name = crypto.randomBytes(10).toString("hex");
  const visual = {
    $schema: SCHEMA,
    name,
    position: {
      x: startX + i * (width + gap),
      y,
      z: 20 + i,
      height,
      width,
      tabOrder: 20 + i,
    },
    visual: {
      visualType: "card",
      query: {
        queryState: {
          Values: { projections: [measureValues(k.m)] },
        },
      },
      objects: {
        labels: [
          {
            properties: {
              fontSize: lit(13),
              bold: lit(true),
              color: solid(k.color),
              preserveWhitespace: lit(true),
            },
          },
        ],
        categoryLabels: [
          {
            properties: {
              show: lit(false),
            },
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
              radius: lit(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(k.label),
              fontSize: lit(9),
              fontColor: solid("#5A6B75"),
            },
          },
        ],
        visualHeader: [{ properties: { show: lit(false) } }],
        padding: [
          {
            properties: {
              top: lit(4),
              bottom: lit(4),
              left: lit(10),
              right: lit(8),
            },
          },
        ],
      },
    },
  };
  const dir = path.join(visualsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
  console.log("added", k.m, name);
});

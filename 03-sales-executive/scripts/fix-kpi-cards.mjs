import fs from "fs";
import path from "path";
import crypto from "crypto";

const pageDir =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages/ReportSection035c09e2ea04501067c189c6";
const visualsDir = path.join(pageDir, "visuals");

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

function lit(v) {
  if (typeof v === "boolean") return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number") return { expr: { Literal: { Value: `${v}D` } } };
  return { expr: { Literal: { Value: `'${v}'` } } };
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

// Remove existing cardVisual folders
for (const e of fs.readdirSync(visualsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const vp = path.join(visualsDir, e.name, "visual.json");
  if (!fs.existsSync(vp)) continue;
  const j = JSON.parse(fs.readFileSync(vp, "utf8"));
  if (j.visual?.visualType === "cardVisual") {
    fs.rmSync(path.join(visualsDir, e.name), { recursive: true, force: true });
    console.log("removed", e.name);
  }
}

const measures = ["Revenue", "Orders", "AOV", "Customers", "Units"];
const gap = 16;
const width = 352;
const startX = 32;
const y = 112;
const height = 120;

measures.forEach((m, i) => {
  const name = crypto.randomBytes(10).toString("hex");
  const visual = {
    $schema: SCHEMA,
    name,
    position: {
      x: startX + i * (width + gap),
      y,
      z: 10 + i,
      height,
      width,
      tabOrder: 10 + i,
    },
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: { projections: [measureProj(m)] },
        },
      },
      objects: {
        outline: [
          {
            properties: { show: lit(false) },
            selector: { id: "default" },
          },
        ],
        label: [
          {
            properties: { show: lit(true) },
            selector: { id: "default" },
          },
        ],
        value: [
          {
            properties: {
              fontSize: lit(28),
              bold: lit(true),
            },
            selector: { id: "default" },
          },
        ],
      },
    },
  };
  const dir = path.join(visualsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
  console.log("added card", m, name);
});

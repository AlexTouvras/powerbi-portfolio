import fs from "fs";
import path from "path";

const root =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report";

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "visual.json") {
      let t = fs.readFileSync(p, "utf8");
      const n = t
        .replace(/\u2014/g, " - ")
        .replace(/\u2013/g, " - ")
        .replace(/â€”/g, " - ")
        .replace(/â€“/g, " - ");
      if (n !== t) {
        fs.writeFileSync(p, n);
        console.log("fixed", p);
      }
      const j = JSON.parse(n);
      if (j.visual?.visualType === "cardVisual") {
        console.log(
          "CARD",
          path.basename(path.dirname(p)),
          "projections",
          j.visual.query.queryState.Data.projections.length,
          "y",
          j.position.y,
          "h",
          j.position.height
        );
      }
      if (j.visual?.visualType === "textbox") {
        console.log(
          "TEXT",
          j.visual.objects.general[0].properties.paragraphs[0].textRuns[0].value
        );
      }
    } else if (e.name === "page.json") {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      j.objects = j.objects || {};
      j.objects.outspacePane = [
        {
          properties: {
            visible: { expr: { Literal: { Value: "false" } } },
            expanded: { expr: { Literal: { Value: "false" } } },
            width: { expr: { Literal: { Value: "0D" } } },
          },
        },
      ];
      fs.writeFileSync(p, JSON.stringify(j, null, 2));
      console.log("pane collapsed", p);
    }
  }
}

walk(path.join(root, "definition", "pages"));

// Simplify KPI card: keep only 5 primary measures
function simplifyCards(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) simplifyCards(p);
    else if (e.name === "visual.json") {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.visual?.visualType !== "cardVisual") continue;
      const keep = new Set(["Revenue", "Orders", "AOV", "Customers", "Units"]);
      j.visual.query.queryState.Data.projections =
        j.visual.query.queryState.Data.projections.filter((pr) =>
          keep.has(pr.nativeQueryRef)
        );
      j.position.height = 140;
      fs.writeFileSync(p, JSON.stringify(j, null, 2));
      console.log(
        "simplified card projections=",
        j.visual.query.queryState.Data.projections.length
      );
    }
  }
}
simplifyCards(path.join(root, "definition", "pages"));

// Update scaffold source titles to ASCII for future runs
const scaffold =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/scripts/scaffold-pbip.mjs";
let s = fs.readFileSync(scaffold, "utf8");
s = s.replaceAll("—", " - ");
fs.writeFileSync(scaffold, s);
console.log("scaffold titles ascii");

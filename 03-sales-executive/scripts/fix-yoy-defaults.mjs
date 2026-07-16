import fs from "fs";
import path from "path";

const report =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages";

const yearFilter = {
  Version: 2,
  From: [{ Name: "d", Entity: "DimDate", Type: 0 }],
  Where: [
    {
      Condition: {
        In: {
          Expressions: [
            {
              Column: {
                Expression: { SourceRef: { Source: "d" } },
                Property: "Year",
              },
            },
          ],
          Values: [[{ Literal: { Value: "2013L" } }]],
        },
      },
    },
  ],
};

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "visual.json") {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.visual?.visualType !== "slicer") continue;
      const proj =
        j.visual.query?.queryState?.Values?.projections?.[0];
      if (proj?.queryRef !== "DimDate.Year") continue;
      j.visual.objects = j.visual.objects || {};
      const dataMode = j.visual.objects.data || [
        {
          properties: {
            mode: { expr: { Literal: { Value: "'Dropdown'" } } },
          },
        },
      ];
      j.visual.objects.data = dataMode;
      j.visual.objects.general = [
        {
          properties: {
            filter: { filter: yearFilter },
          },
        },
      ];
      fs.writeFileSync(p, JSON.stringify(j, null, 2));
      console.log("default Year=2013", p);
    }
  }
}

walk(report);

// Update Market YoY chart title
const marketYoY =
  "C:/Users/kater/.cursor/projects/PowerBI/03-sales-executive/SalesExecutive.Report/definition/pages/ReportSection8bec1e38448cf01490d178d1/visuals/a57f24149ca6b988906c/visual.json";
if (fs.existsSync(marketYoY)) {
  const j = JSON.parse(fs.readFileSync(marketYoY, "utf8"));
  const title = j.visual.visualContainerObjects?.title?.[0];
  if (title?.properties?.text) {
    title.properties.text = {
      expr: {
        Literal: {
          Value: "'YoY revenue % by country  -  vs prior year (pick a Year)'",
        },
      },
    };
    fs.writeFileSync(marketYoY, JSON.stringify(j, null, 2));
    console.log("updated Market YoY title");
  }
}

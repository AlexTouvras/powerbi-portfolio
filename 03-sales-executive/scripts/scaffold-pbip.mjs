/**
 * Scaffold SalesExecutive PBIP (SemanticModel TMDL + Report PBIR) from gold CSVs.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const goldDir = path.join(root, "data", "gold").replace(/\\/g, "/");
const themeSrc = path.resolve(root, "../_shared/themes/Nordic-Boardroom-a1b2c3d4.json");
const themeFileName = "Nordic-Boardroom-a1b2c3d4.json";

const sm = path.join(root, "SalesExecutive.SemanticModel");
const rpt = path.join(root, "SalesExecutive.Report");
const def = path.join(sm, "definition");
const tablesDir = path.join(def, "tables");

function hex(n) {
  return crypto.randomBytes(n).toString("hex");
}
function visualId() {
  return hex(10);
}
function pageId() {
  return "ReportSection" + hex(12);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function write(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function csvPartition(tableName, fileName, typeSteps) {
  // typeSteps: array of `{"Column", type}` M fragments â€” prefer `type nullable date` for optional dates
  const types = typeSteps.map(([c, t]) => `{"${c}", ${t}}`).join(", ");
  return `
	partition ${tableName} = m
		mode: import
		source =
			let
				Source = Csv.Document(File.Contents("${goldDir}/${fileName}"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
				#"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
				#"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers", {${types}})
			in
				#"Changed Type"
`.trimEnd();
}

// --- Semantic model ---
ensureDir(tablesDir);

write(
  path.join(sm, "definition.pbism"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
      version: "4.2",
      settings: { qnaEnabled: true },
    },
    null,
    2
  )
);

write(
  path.join(def, "database.tmdl"),
  `database SalesExecutive
\tcompatibilityLevel: 1567
`
);

write(
  path.join(def, "model.tmdl"),
  `model Model
\tculture: en-US
\tdefaultPowerBIDataSourceVersion: powerBI_V3
\tsourceQueryCulture: en-US

ref table FactSales
ref table DimDate
ref table DimCustomer
ref table DimProduct
`
);

write(
  path.join(def, "relationships.tmdl"),
  `relationship FactSales_DimDate
\tfromColumn: FactSales.OrderDate
\ttoColumn: DimDate.Date

relationship FactSales_DimCustomer
\tfromColumn: FactSales.CustomerKey
\ttoColumn: DimCustomer.CustomerKey

relationship FactSales_DimProduct
\tfromColumn: FactSales.ProductKey
\ttoColumn: DimProduct.ProductKey
`
);

write(
  path.join(tablesDir, "DimDate.tmdl"),
  `table DimDate
\tdataCategory: Time

\tcolumn Date
\t\tdataType: dateTime
\t\tformatString: yyyy-mm-dd
\t\tsummarizeBy: none
\t\tsourceColumn: Date
\t\tdataCategory: Time

\tcolumn Year
\t\tdataType: int64
\t\tformatString: 0
\t\tsummarizeBy: none
\t\tsourceColumn: Year

\tcolumn Month
\t\tdataType: int64
\t\tformatString: 0
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: Month

\tcolumn MonthName
\t\tdataType: string
\t\tsourceColumn: MonthName
\t\tsortByColumn: Month

\tcolumn YearMonth
\t\tdataType: string
\t\tsourceColumn: YearMonth
\t\tsortByColumn: MonthYearSort

\tcolumn Quarter
\t\tdataType: string
\t\tsourceColumn: Quarter

\tcolumn YearQuarter
\t\tdataType: string
\t\tsourceColumn: YearQuarter

\tcolumn Day
\t\tdataType: int64
\t\tformatString: 0
\t\tsummarizeBy: none
\t\tsourceColumn: Day

\tcolumn MonthYearSort
\t\tdataType: int64
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: MonthYearSort

${csvPartition("DimDate", "DimDate.csv", [
  ["Date", "type date"],
  ["Year", "Int64.Type"],
  ["Month", "Int64.Type"],
  ["MonthName", "type text"],
  ["YearMonth", "type text"],
  ["Quarter", "type text"],
  ["YearQuarter", "type text"],
  ["Day", "Int64.Type"],
  ["MonthYearSort", "Int64.Type"],
])}
`
);

write(
  path.join(tablesDir, "DimCustomer.tmdl"),
  `table DimCustomer

\tcolumn CustomerKey
\t\tdataType: int64
\t\tformatString: 0
\t\tsummarizeBy: none
\t\tsourceColumn: CustomerKey

\tcolumn CustomerID
\t\tdataType: int64
\t\tformatString: 0
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: CustomerID

\tcolumn CustomerNumber
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: CustomerNumber

\tcolumn CustomerName
\t\tdataType: string
\t\tsourceColumn: CustomerName

\tcolumn FirstName
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: FirstName

\tcolumn LastName
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: LastName

\tcolumn Country
\t\tdataType: string
\t\tsourceColumn: Country

\tcolumn MaritalStatus
\t\tdataType: string
\t\tsourceColumn: MaritalStatus

\tcolumn Gender
\t\tdataType: string
\t\tsourceColumn: Gender

\tcolumn Birthdate
\t\tdataType: dateTime
\t\tformatString: yyyy-mm-dd
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: Birthdate

${csvPartition("DimCustomer", "DimCustomer.csv", [
  ["CustomerKey", "Int64.Type"],
  ["CustomerID", "Int64.Type"],
  ["CustomerNumber", "type text"],
  ["CustomerName", "type text"],
  ["FirstName", "type text"],
  ["LastName", "type text"],
  ["Country", "type text"],
  ["MaritalStatus", "type text"],
  ["Gender", "type text"],
  ["Birthdate", "type nullable date"],
])}
`
);

write(
  path.join(tablesDir, "DimProduct.tmdl"),
  `table DimProduct

\tcolumn ProductKey
\t\tdataType: int64
\t\tformatString: 0
\t\tsummarizeBy: none
\t\tsourceColumn: ProductKey

\tcolumn ProductID
\t\tdataType: int64
\t\tformatString: 0
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: ProductID

\tcolumn ProductNumber
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: ProductNumber

\tcolumn ProductName
\t\tdataType: string
\t\tsourceColumn: ProductName

\tcolumn CategoryId
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: CategoryId

\tcolumn Category
\t\tdataType: string
\t\tsourceColumn: Category

\tcolumn Subcategory
\t\tdataType: string
\t\tsourceColumn: Subcategory

\tcolumn ProductLine
\t\tdataType: string
\t\tsourceColumn: ProductLine

\tcolumn Cost
\t\tdataType: double
\t\tformatString: $#,0.00
\t\tsummarizeBy: none
\t\tsourceColumn: Cost

\tcolumn Maintenance
\t\tdataType: string
\t\tisHidden
\t\tsourceColumn: Maintenance

${csvPartition("DimProduct", "DimProduct.csv", [
  ["ProductKey", "Int64.Type"],
  ["ProductID", "Int64.Type"],
  ["ProductNumber", "type text"],
  ["ProductName", "type text"],
  ["CategoryId", "type text"],
  ["Category", "type text"],
  ["Subcategory", "type text"],
  ["ProductLine", "type text"],
  ["Cost", "type number"],
  ["Maintenance", "type text"],
])}
`
);

write(
  path.join(tablesDir, "FactSales.tmdl"),
  `table FactSales

\t/// Total sales revenue
\tmeasure Revenue = SUM(FactSales[SalesAmount])
\t\tformatString: $#,0

\t/// Distinct order count
\tmeasure Orders = DISTINCTCOUNT(FactSales[OrderNumber])
\t\tformatString: #,0

\t/// Units sold
\tmeasure Units = SUM(FactSales[Quantity])
\t\tformatString: #,0

\t/// Average order value
\tmeasure AOV = DIVIDE([Revenue], [Orders])
\t\tformatString: $#,0.00

\t/// Distinct customers
\tmeasure Customers = DISTINCTCOUNT(FactSales[CustomerKey])
\t\tformatString: #,0

\tmeasure 'YoY Revenue' = CALCULATE([Revenue], SAMEPERIODLASTYEAR(DimDate[Date]))
\t\tformatString: $#,0

\tmeasure 'YoY Revenue %' = DIVIDE([Revenue] - [YoY Revenue], [YoY Revenue])
\t\tformatString: 0.0%

\tmeasure 'YoY Orders' = CALCULATE([Orders], SAMEPERIODLASTYEAR(DimDate[Date]))
\t\tformatString: #,0

\tmeasure 'YoY Orders %' = DIVIDE([Orders] - [YoY Orders], [YoY Orders])
\t\tformatString: 0.0%

\tmeasure 'YoY AOV' = CALCULATE([AOV], SAMEPERIODLASTYEAR(DimDate[Date]))
\t\tformatString: $#,0.00

\tmeasure 'YoY AOV %' = DIVIDE([AOV] - [YoY AOV], [YoY AOV])
\t\tformatString: 0.0%

\tmeasure 'YoY Customers' = CALCULATE([Customers], SAMEPERIODLASTYEAR(DimDate[Date]))
\t\tformatString: #,0

\tmeasure 'YoY Customers %' = DIVIDE([Customers] - [YoY Customers], [YoY Customers])
\t\tformatString: 0.0%

\tmeasure 'YoY Units' = CALCULATE([Units], SAMEPERIODLASTYEAR(DimDate[Date]))
\t\tformatString: #,0

\tmeasure 'YoY Units %' = DIVIDE([Units] - [YoY Units], [YoY Units])
\t\tformatString: 0.0%

\tmeasure 'Cost Amount' = SUMX(FactSales, RELATED(DimProduct[Cost]) * FactSales[Quantity])
\t\tformatString: $#,0

\tmeasure 'Margin %' = DIVIDE([Revenue] - [Cost Amount], [Revenue])
\t\tformatString: 0.0%

\tcolumn OrderNumber
\t\tdataType: string
\t\tsourceColumn: OrderNumber

\tcolumn ProductKey
\t\tdataType: int64
\t\tformatString: 0
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: ProductKey

\tcolumn CustomerKey
\t\tdataType: int64
\t\tformatString: 0
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: CustomerKey

\tcolumn OrderDate
\t\tdataType: dateTime
\t\tformatString: yyyy-mm-dd
\t\tsummarizeBy: none
\t\tsourceColumn: OrderDate

\tcolumn ShippingDate
\t\tdataType: dateTime
\t\tformatString: yyyy-mm-dd
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: ShippingDate

\tcolumn DueDate
\t\tdataType: dateTime
\t\tformatString: yyyy-mm-dd
\t\tisHidden
\t\tsummarizeBy: none
\t\tsourceColumn: DueDate

\tcolumn SalesAmount
\t\tdataType: double
\t\tformatString: $#,0.00
\t\tsummarizeBy: sum
\t\tsourceColumn: SalesAmount

\tcolumn Quantity
\t\tdataType: int64
\t\tformatString: 0
\t\tsummarizeBy: sum
\t\tsourceColumn: Quantity

\tcolumn Price
\t\tdataType: double
\t\tformatString: $#,0.00
\t\tsummarizeBy: none
\t\tsourceColumn: Price

${csvPartition("FactSales", "FactSales.csv", [
  ["OrderNumber", "type text"],
  ["ProductKey", "Int64.Type"],
  ["CustomerKey", "Int64.Type"],
  ["OrderDate", "type date"],
  ["ShippingDate", "type nullable date"],
  ["DueDate", "type nullable date"],
  ["SalesAmount", "type number"],
  ["Quantity", "Int64.Type"],
  ["Price", "type number"],
])}
`
);

// --- Report ---
const pages = {
  pulse: pageId(),
  drivers: pageId(),
  market: pageId(),
};

ensureDir(path.join(rpt, "definition", "pages"));
ensureDir(path.join(rpt, "StaticResources", "SharedResources", "BaseThemes"));
ensureDir(path.join(rpt, "StaticResources", "RegisteredResources"));

write(
  path.join(root, "SalesExecutive.pbip"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
      version: "1.0",
      artifacts: [{ report: { path: "SalesExecutive.Report" } }],
      settings: { enableAutoRecovery: true },
    },
    null,
    2
  )
);

write(
  path.join(rpt, "definition.pbir"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
      version: "4.0",
      datasetReference: { byPath: { path: "../SalesExecutive.SemanticModel" } },
    },
    null,
    2
  )
);

write(
  path.join(rpt, "definition", "version.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
      version: "2.0.0",
    },
    null,
    2
  )
);

function writePlatform(dir, displayName, type) {
  write(
    path.join(dir, ".platform"),
    JSON.stringify(
      {
        $schema:
          "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        metadata: {
          type,
          displayName,
        },
        config: {
          version: "2.0",
          logicalId: crypto.randomUUID(),
        },
      },
      null,
      2
    )
  );
}
writePlatform(rpt, "Sales Executive", "Report");
writePlatform(sm, "Sales Executive", "SemanticModel");

// Theme registration
fs.copyFileSync(themeSrc, path.join(rpt, "StaticResources", "RegisteredResources", themeFileName));

const reportVersionAtImport = {
  visual: "1.8.92",
  report: "2.0.84",
  page: "1.3.40",
};

write(
  path.join(rpt, "definition", "report.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
      themeCollection: {
        baseTheme: {
          name: "CY25SU06",
          reportVersionAtImport,
          type: "SharedResources",
        },
        customTheme: {
          name: themeFileName,
          reportVersionAtImport,
          type: "RegisteredResources",
        },
      },
      objects: {
        section: [
          {
            properties: {
              verticalAlignment: { expr: { Literal: { Value: "'Middle'" } } },
            },
          },
        ],
      },
      resourcePackages: [
        {
          name: "SharedResources",
          type: "SharedResources",
          items: [
            {
              name: "CY25SU06",
              path: "BaseThemes/CY25SU06.json",
              type: "BaseTheme",
            },
          ],
        },
        {
          name: "RegisteredResources",
          type: "RegisteredResources",
          items: [
            {
              name: themeFileName,
              path: themeFileName,
              type: "CustomTheme",
            },
          ],
        },
      ],
      settings: {
        exportDataMode: "AllowSummarized",
      },
    },
    null,
    2
  )
);

// Minimal base theme stub if missing - Desktop often needs it; copy from skill base or empty
const baseThemePath = path.join(
  rpt,
  "StaticResources",
  "SharedResources",
  "BaseThemes",
  "CY25SU06.json"
);
if (!fs.existsSync(baseThemePath)) {
  write(
    baseThemePath,
    JSON.stringify({ name: "CY25SU06", dataColors: ["#2F5F73"], foreground: "#0F1C24", background: "#FFFFFF" }, null, 2)
  );
}

write(
  path.join(rpt, "definition", "pages", "pages.json"),
  JSON.stringify(
    {
      $schema:
        "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
      pageOrder: [pages.pulse, pages.drivers, pages.market],
      activePageName: pages.pulse,
    },
    null,
    2
  )
);

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

function lit(v) {
  if (typeof v === "boolean") return { expr: { Literal: { Value: v ? "true" : "false" } } };
  if (typeof v === "number") return { expr: { Literal: { Value: `${v}D` } } };
  return { expr: { Literal: { Value: `'${v}'` } } };
}

function measureProj(table, measure) {
  return {
    field: {
      Measure: {
        Expression: { SourceRef: { Entity: table } },
        Property: measure,
      },
    },
    queryRef: `${table}.${measure}`,
    nativeQueryRef: measure,
  };
}

function columnProj(table, column, active = true) {
  return {
    field: {
      Column: {
        Expression: { SourceRef: { Entity: table } },
        Property: column,
      },
    },
    queryRef: `${table}.${column}`,
    nativeQueryRef: column,
    active,
  };
}

function textbox(name, text, pos) {
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
              paragraphs: [
                {
                  textRuns: [
                    {
                      value: text,
                      textStyle: {
                        fontFamily: "Segoe UI Semibold",
                        fontSize: "20pt",
                        color: "#0F1C24",
                      },
                    },
                  ],
                  horizontalTextAlignment: "left",
                },
              ],
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
              top: lit(0),
              bottom: lit(0),
              left: lit(0),
              right: lit(0),
            },
          },
        ],
      },
    },
  };
}

function slicer(name, table, column, pos, mode = "Dropdown") {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "slicer",
      query: {
        queryState: {
          Values: { projections: [columnProj(table, column)] },
        },
      },
      objects: {
        data: [{ properties: { mode: lit(mode) } }],
      },
      visualContainerObjects: {
        padding: [
          {
            properties: {
              top: lit(8),
              bottom: lit(8),
              left: lit(8),
              right: lit(8),
            },
          },
        ],
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(column),
            },
          },
        ],
      },
    },
  };
}

function cardVisual(name, measures, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "cardVisual",
      query: {
        queryState: {
          Data: {
            projections: measures.map((m) => measureProj("FactSales", m)),
          },
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
}

function barChart(name, categoryTable, categoryCol, measure, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [columnProj(categoryTable, categoryCol)] },
          Y: { projections: [measureProj("FactSales", measure)] },
        },
        sortDefinition: {
          sort: [
            {
              field: measureProj("FactSales", measure).field,
              direction: "Descending",
            },
          ],
        },
      },
      visualContainerObjects: {
        title: [
          {
            properties: {
              show: lit(true),
              text: lit(`${measure} by ${categoryCol}`),
            },
          },
        ],
      },
    },
  };
}

function lineChart(name, pos) {
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: { projections: [columnProj("DimDate", "YearMonth")] },
          Y: { projections: [measureProj("FactSales", "Revenue")] },
        },
      },
      objects: {
        dataPoint: [
          {
            properties: {
              defaultColor: {
                solid: { color: { expr: { Literal: { Value: "'#2F5F73'" } } } },
              },
            },
          },
        ],
      },
      visualContainerObjects: {
        title: [
          {
            properties: {
              show: lit(true),
              text: lit("Revenue by Month"),
            },
          },
        ],
      },
    },
  };
}

function writeVisual(pageDir, visual) {
  const dir = path.join(pageDir, "visuals", visual.name);
  write(path.join(dir, "visual.json"), JSON.stringify(visual, null, 2));
}

function makePage(pageKey, displayName, width = 1920, height = 1080) {
  const pageDir = path.join(rpt, "definition", "pages", pageKey);
  ensureDir(path.join(pageDir, "visuals"));
  write(
    path.join(pageDir, "page.json"),
    JSON.stringify(
      {
        $schema: PAGE_SCHEMA,
        name: pageKey,
        displayName,
        displayOption: "FitToPage",
        height,
        width,
      },
      null,
      2
    )
  );
  return pageDir;
}

// Page 1 â€” Portfolio Pulse
{
  const d = makePage(pages.pulse, "Portfolio Pulse");
  let z = 0;
  const visuals = [
    textbox(visualId(), "Portfolio Pulse â€” Revenue and Growth at a Glance", {
      x: 32,
      y: 24,
      z: z++,
      height: 48,
      width: 900,
      tabOrder: 0,
    }),
    slicer(visualId(), "DimDate", "Year", {
      x: 1100,
      y: 16,
      z: z++,
      height: 80,
      width: 200,
      tabOrder: 1,
    }),
    slicer(visualId(), "DimCustomer", "Country", {
      x: 1320,
      y: 16,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 2,
    }),
    slicer(visualId(), "DimProduct", "Category", {
      x: 1580,
      y: 16,
      z: z++,
      height: 80,
      width: 280,
      tabOrder: 3,
    }),
    cardVisual(
      visualId(),
      ["Revenue", "YoY Revenue %", "Orders", "YoY Orders %", "AOV", "YoY AOV %", "Customers", "YoY Customers %", "Units", "YoY Units %"],
      { x: 32, y: 112, z: z++, height: 160, width: 1856, tabOrder: 4 }
    ),
    lineChart(visualId(), {
      x: 32,
      y: 296,
      z: z++,
      height: 720,
      width: 1120,
      tabOrder: 5,
    }),
    barChart(visualId(), "DimProduct", "Category", "Revenue", {
      x: 1176,
      y: 296,
      z: z++,
      height: 720,
      width: 712,
      tabOrder: 6,
    }),
  ];
  visuals.forEach((v) => writeVisual(d, v));
}

// Page 2 â€” Performance Drivers
{
  const d = makePage(pages.drivers, "Performance Drivers");
  let z = 0;
  const visuals = [
    textbox(visualId(), "Performance Drivers â€” Where Growth Comes From", {
      x: 32,
      y: 24,
      z: z++,
      height: 48,
      width: 1100,
      tabOrder: 0,
    }),
    slicer(visualId(), "DimDate", "Year", {
      x: 32,
      y: 96,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 1,
    }),
    slicer(visualId(), "DimCustomer", "Country", {
      x: 32,
      y: 192,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 2,
    }),
    slicer(visualId(), "DimProduct", "Category", {
      x: 32,
      y: 288,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 3,
    }),
    slicer(visualId(), "DimProduct", "ProductLine", {
      x: 32,
      y: 384,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 4,
    }),
    barChart(visualId(), "DimProduct", "Category", "Revenue", {
      x: 304,
      y: 96,
      z: z++,
      height: 400,
      width: 760,
      tabOrder: 5,
    }),
    barChart(visualId(), "DimProduct", "ProductLine", "Revenue", {
      x: 1096,
      y: 96,
      z: z++,
      height: 400,
      width: 792,
      tabOrder: 6,
    }),
    barChart(visualId(), "DimProduct", "ProductName", "Revenue", {
      x: 304,
      y: 520,
      z: z++,
      height: 504,
      width: 1584,
      tabOrder: 7,
    }),
  ];
  visuals.forEach((v) => writeVisual(d, v));
}

// Page 3 â€” Customer & Market
{
  const d = makePage(pages.market, "Customer & Market");
  let z = 0;
  const visuals = [
    textbox(visualId(), "Customer & Market â€” Concentration and Opportunity", {
      x: 32,
      y: 24,
      z: z++,
      height: 48,
      width: 1100,
      tabOrder: 0,
    }),
    slicer(visualId(), "DimDate", "Year", {
      x: 1100,
      y: 16,
      z: z++,
      height: 80,
      width: 200,
      tabOrder: 1,
    }),
    slicer(visualId(), "DimProduct", "Category", {
      x: 1320,
      y: 16,
      z: z++,
      height: 80,
      width: 240,
      tabOrder: 2,
    }),
    slicer(visualId(), "DimCustomer", "CustomerName", {
      x: 1580,
      y: 16,
      z: z++,
      height: 80,
      width: 280,
      tabOrder: 3,
    }),
    barChart(visualId(), "DimCustomer", "Country", "Revenue", {
      x: 32,
      y: 112,
      z: z++,
      height: 440,
      width: 920,
      tabOrder: 4,
    }),
    barChart(visualId(), "DimCustomer", "Country", "YoY Revenue %", {
      x: 976,
      y: 112,
      z: z++,
      height: 440,
      width: 912,
      tabOrder: 5,
    }),
    barChart(visualId(), "DimCustomer", "CustomerName", "Revenue", {
      x: 32,
      y: 576,
      z: z++,
      height: 448,
      width: 1856,
      tabOrder: 6,
    }),
  ];
  visuals.forEach((v) => writeVisual(d, v));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pbip: path.join(root, "SalesExecutive.pbip"),
      pages,
      goldDir,
    },
    null,
    2
  )
);

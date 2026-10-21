/**
 * Reusable PBIR visual patterns for the plot catalogue:
 *   #16–20 Slope/Dumbbell/Stream/Decomp/Lollipop · Statement (Controllership)
 *
 * IMPORTANT: Do NOT use a disconnected period table on a line/area axis.
 * Measure context often ignores it → flat / identical points. Prefer related
 * DimDate fields + visual filters. Cap stream series at ~4.
 * Seasonal decomp = three separate panels (trend / season / remainder), never
 * one collapsed multi-measure line.
 * Lollipop = lineClusteredColumnComboChart: thin columns (stem) + markers (dot),
 * line stroke hidden. Bind two measures that equal the same value (Stem / Dot).
 * Statement = CoA table (operator labels) + variance bars — not one collapsed KPI.
 */

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

export const SERIES_COLORS = [
  "#2F5F73",
  "#C17B3A",
  "#4A6B5C",
  "#5B8FA3",
  "#7A6A8A",
  "#8B5E3C",
  "#3D5A6C",
  "#6B7C86",
];

export const TWO_POINT_PALETTE = {
  ink: "#0F1C24",
  muted: "#5A6B75",
  border: "#E8EEF2",
  surface: "#FFFFFF",
  accent: "#2F5F73",
  copper: "#C17B3A",
};

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

function measure(entity, name, active = false) {
  const p = {
    field: {
      Measure: {
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

function cardChrome(title, subtitle) {
  const chrome = {
    background: [
      {
        properties: {
          show: lit(true),
          color: solid(TWO_POINT_PALETTE.surface),
          transparency: litD(0),
        },
      },
    ],
    border: [
      {
        properties: {
          show: lit(true),
          color: solid(TWO_POINT_PALETTE.border),
          radius: litD(8),
        },
      },
    ],
    title: title
      ? [
          {
            properties: {
              show: lit(true),
              text: lit(title),
              fontSize: litD(12),
              fontColor: solid(TWO_POINT_PALETTE.ink),
              fontFamily: lit("Segoe UI Semibold"),
            },
          },
        ]
      : [{ properties: { show: lit(false) } }],
    visualHeader: [{ properties: { show: lit(false) } }],
    padding: [
      {
        properties: {
          top: litD(8),
          bottom: litD(8),
          left: litD(12),
          right: litD(16),
        },
      },
    ],
  };
  if (subtitle) {
    chrome.subTitle = [
      {
        properties: {
          show: lit(true),
          text: lit(subtitle),
          fontSize: litD(9),
          fontColor: solid(TWO_POINT_PALETTE.muted),
          fontFamily: lit("Segoe UI"),
        },
      },
    ];
  }
  return chrome;
}

/**
 * Visual-level year filter: keep exactly the two years on the slope axis.
 * @param {string} dateEntity
 * @param {string} yearColumn
 * @param {number[]} years
 * @param {string} filterName
 */
export function yearInFilter(dateEntity, yearColumn, years, filterName) {
  return {
    name: filterName,
    field: {
      Column: {
        Expression: { SourceRef: { Entity: dateEntity } },
        Property: yearColumn,
      },
    },
    type: "Categorical",
    filter: {
      Version: 2,
      From: [{ Name: "d", Entity: dateEntity, Type: 0 }],
      Where: [
        {
          Condition: {
            In: {
              Expressions: [
                {
                  Column: {
                    Expression: { SourceRef: { Source: "d" } },
                    Property: yearColumn,
                  },
                },
              ],
              Values: years.map((y) => [{ Literal: { Value: `${y}L` } }]),
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

/**
 * Two-point slope/dumbbell on a related year column (native filter context).
 *
 * @param {object} opts
 * @param {number[]} [opts.years=[2012,2013]] exactly two calendar years
 * @param {string} [opts.yearEntity='DimDate']
 * @param {string} [opts.yearColumn='Year']
 * @param {string} [opts.measureName='Revenue'] use a normal related measure
 */
export function buildTwoPointLineChart(opts) {
  const {
    name,
    position,
    years = [2012, 2013],
    yearEntity = "DimDate",
    yearColumn = "Year",
    seriesEntity,
    seriesColumn,
    measureEntity = "FactSales",
    measureName = "Revenue",
    title,
    subtitle,
    variant = "slope",
    seriesNames = [],
    filterName,
    $schema = SCHEMA,
  } = opts;

  if (years.length !== 2) {
    throw new Error("buildTwoPointLineChart requires exactly two years");
  }

  const isDumbbell = variant === "dumbbell";
  const strokeWidth = isDumbbell ? 3 : 2.25;
  const markerSize = isDumbbell ? 9 : 7;

  /** @type {object[]} */
  const dataPoint = seriesNames.map((seriesName, i) => ({
    properties: {
      fill: solid(SERIES_COLORS[i % SERIES_COLORS.length]),
    },
    selector: {
      data: [
        {
          scopeId: {
            Comparison: {
              ComparisonKind: 0,
              Left: {
                Column: {
                  Expression: { SourceRef: { Entity: seriesEntity } },
                  Property: seriesColumn,
                },
              },
              Right: {
                Literal: {
                  Value: `'${String(seriesName).replace(/'/g, "''")}'`,
                },
              },
            },
          },
        },
      ],
    },
  }));

  const fid =
    filterName ||
    "Filter" +
      [...Array(24)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("");

  return {
    $schema,
    name,
    position,
    visual: {
      visualType: "lineChart",
      query: {
        queryState: {
          Category: {
            projections: [column(yearEntity, yearColumn)],
          },
          Series: {
            projections: [column(seriesEntity, seriesColumn)],
          },
          Y: {
            projections: [measure(measureEntity, measureName)],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: yearEntity } },
                  Property: yearColumn,
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
              color: solid(TWO_POINT_PALETTE.ink),
              labelPrecision: lit(0),
            },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              start: litD(0),
              gridlineShow: lit(true),
              gridlineColor: solid("#EEF2F5"),
              gridlineThickness: litD(1),
              labelColor: solid(TWO_POINT_PALETTE.muted),
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
              labelColor: solid(TWO_POINT_PALETTE.ink),
              fontSize: litD(11),
              bold: lit(true),
              concatenateLabels: lit(false),
            },
          },
        ],
        lineStyles: [
          {
            properties: {
              strokeWidth: litD(strokeWidth),
              lineChartType: lit("linear"),
              showMarker: lit(true),
              markerShape: lit("circle"),
              markerSize: litD(markerSize),
              areaShow: lit(false),
            },
          },
        ],
        seriesLabels: [
          {
            properties: {
              show: lit(true),
              showByDefault: lit(true),
              seriesMatchColor: lit(true),
              seriesPosition: lit("Right"),
              textSize: litD(10),
              bold: lit(true),
              enableBackground: lit(false),
              leaderLines: lit(false),
              maximumOffset: litD(24),
            },
          },
        ],
        ...(dataPoint.length ? { dataPoint } : {}),
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
    filterConfig: {
      filters: [yearInFilter(yearEntity, yearColumn, years, fid)],
    },
  };
}

export function buildSlopeChart(opts) {
  const years = opts.years || [2012, 2013];
  return buildTwoPointLineChart({
    ...opts,
    years,
    variant: "slope",
    subtitle:
      opts.subtitle ??
      `${years[0]} → ${years[1]} · one line per entity · crossings = rank change`,
  });
}

export function buildDumbbellChart(opts) {
  const years = opts.years || [2012, 2013];
  return buildTwoPointLineChart({
    ...opts,
    years,
    variant: "dumbbell",
    subtitle:
      opts.subtitle ??
      `${years[0]} → ${years[1]} · thicker stem · comparable series only`,
  });
}

/**
 * Categorical In-filter for string series (e.g. top categories on a stream).
 */
export function seriesInFilter(entity, column, values, filterName) {
  return {
    name: filterName,
    field: {
      Column: {
        Expression: { SourceRef: { Entity: entity } },
        Property: column,
      },
    },
    type: "Categorical",
    filter: {
      Version: 2,
      From: [{ Name: "s", Entity: entity, Type: 0 }],
      Where: [
        {
          Condition: {
            In: {
              Expressions: [
                {
                  Column: {
                    Expression: { SourceRef: { Source: "s" } },
                    Property: column,
                  },
                },
              ],
              Values: values.map((v) => [
                {
                  Literal: {
                    Value: `'${String(v).replace(/'/g, "''")}'`,
                  },
                },
              ]),
            },
          },
        },
      ],
    },
    howCreated: "User",
  };
}

/**
 * Catalogue #18 — Stream / mix-over-time.
 *
 * Default: 100% stacked area (share of mix). Pass mode: "volume" for absolute
 * stacked area. Keep seriesNames length ≤ 4.
 *
 * @param {object} opts
 * @param {'share'|'volume'} [opts.mode='share']
 * @param {string[]} opts.seriesNames capped series on the legend
 */
export function buildStreamChart(opts) {
  const {
    name,
    position,
    timeEntity = "DimDate",
    timeColumn = "YearMonth",
    timeSortColumn = "MonthYearSort",
    seriesEntity,
    seriesColumn,
    measureEntity,
    measureName,
    seriesNames = [],
    mode = "share",
    title,
    subtitle,
    $schema = SCHEMA,
  } = opts;

  if (seriesNames.length > 4) {
    throw new Error("buildStreamChart: keep seriesNames ≤ 4 (catalogue rule)");
  }

  const visualType =
    mode === "volume" ? "stackedAreaChart" : "hundredPercentStackedAreaChart";

  const dataPoint = seriesNames.map((seriesName, i) => ({
    properties: {
      fill: solid(SERIES_COLORS[i % SERIES_COLORS.length]),
    },
    selector: {
      data: [
        {
          scopeId: {
            Comparison: {
              ComparisonKind: 0,
              Left: {
                Column: {
                  Expression: { SourceRef: { Entity: seriesEntity } },
                  Property: seriesColumn,
                },
              },
              Right: {
                Literal: {
                  Value: `'${String(seriesName).replace(/'/g, "''")}'`,
                },
              },
            },
          },
        },
      ],
    },
  }));

  const filters = [];
  if (seriesNames.length) {
    const fid =
      "Filter" +
      [...Array(24)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("");
    filters.push(seriesInFilter(seriesEntity, seriesColumn, seriesNames, fid));
  }

  return {
    $schema,
    name,
    position,
    visual: {
      visualType,
      query: {
        queryState: {
          Category: {
            projections: [column(timeEntity, timeColumn)],
          },
          Series: {
            projections: [column(seriesEntity, seriesColumn)],
          },
          Y: {
            projections: [measure(measureEntity, measureName)],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: timeEntity } },
                  Property: timeSortColumn,
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
              labelColor: solid(TWO_POINT_PALETTE.muted),
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
              gridlineColor: solid("#EEF2F5"),
              labelColor: solid(TWO_POINT_PALETTE.muted),
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
              labelColor: solid(TWO_POINT_PALETTE.muted),
              fontSize: litD(9),
            },
          },
        ],
        ...(dataPoint.length ? { dataPoint } : {}),
      },
      visualContainerObjects: cardChrome(
        title,
        subtitle ??
          (mode === "volume"
            ? "Stacked volume · ≤4 series · related time axis"
            : "100% mix over time · ≤4 series · share is the story")
      ),
    },
    ...(filters.length ? { filterConfig: { filters } } : {}),
  };
}

/**
 * Catalogue #19 — Seasonal decomposition strip (three panels).
 *
 * Returns an array of three lineChart visuals. Bind measures from
 * FactForecast (Sum Trend / Sum Seasonal / Sum Remainder) — same WeekStart
 * grain as the PI ribbon so Desktop only refreshes an existing table.
 *
 * @param {object} opts
 * @param {() => string} opts.id factory for visual names
 * @param {{ x: number, y: number, z: number, height: number, width: number, gap?: number, tabOrder?: number }} opts.position
 *   `width` is the full strip width; each panel is (width - 2*gap) / 3.
 */
export function buildSeasonalDecompPanels(opts) {
  const {
    id,
    position,
    timeEntity = "FactForecast",
    timeColumn = "WeekStart",
    measureEntity = "FactForecast",
    $schema = SCHEMA,
  } = opts;

  const gap = position.gap ?? 16;
  const panelW = Math.floor((position.width - 2 * gap) / 3);
  const panels = [
    {
      measureName: "Sum Trend",
      title: "Trend",
      subtitle: "Slow level of weekly orders",
      color: SERIES_COLORS[0],
    },
    {
      measureName: "Sum Seasonal",
      title: "Seasonal",
      subtitle: "Repeating within-year pulse",
      color: SERIES_COLORS[1],
    },
    {
      measureName: "Sum Remainder",
      title: "Remainder",
      subtitle: "What the season model leaves",
      color: SERIES_COLORS[2],
    },
  ];

  return panels.map((p, i) => {
    const name = typeof id === "function" ? id() : `${id}_${i}`;
    const x = position.x + i * (panelW + gap);
    return {
      $schema,
      name,
      position: {
        x,
        y: position.y,
        z: position.z + i,
        height: position.height,
        width: panelW,
        tabOrder: (position.tabOrder ?? 0) + i,
      },
      visual: {
        visualType: "lineChart",
        query: {
          queryState: {
            Category: { projections: [column(timeEntity, timeColumn)] },
            Y: { projections: [measure(measureEntity, p.measureName)] },
          },
          sortDefinition: {
            sort: [
              {
                field: {
                  Column: {
                    Expression: { SourceRef: { Entity: timeEntity } },
                    Property: timeColumn,
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
                show: lit(true),
                gridlineShow: lit(true),
                gridlineColor: solid("#EEF2F5"),
                labelColor: solid(TWO_POINT_PALETTE.muted),
                fontSize: litD(8),
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
                labelColor: solid(TWO_POINT_PALETTE.muted),
                fontSize: litD(8),
              },
            },
          ],
          dataPoint: [{ properties: { defaultColor: solid(p.color) } }],
          lineStyles: [
            {
              properties: {
                strokeWidth: litD(2),
                showMarker: lit(false),
              },
            },
          ],
        },
        visualContainerObjects: cardChrome(p.title, p.subtitle),
      },
    };
  });
}

/**
 * Catalogue #20 — Lollipop (ranked magnitude, less ink than bars).
 *
 * Native combo: columns = stem, line markers = dot, connecting stroke off.
 * Pass stemMeasure / dotMeasure that resolve to the same value (two Y roles).
 *
 * @param {object} opts
 * @param {string} [opts.stemColor='#9AA8B2'] hairline column
 * @param {string} [opts.dotColor] marker fill (defaults accent)
 * @param {'Ascending'|'Descending'} [opts.sortDirection='Ascending']
 * @param {number} [opts.innerPadding=96] higher → thinner stems (must read as lines, not bars)
 * @param {string[]} [opts.categoryNames] optional In-filter so each stem has room
 */
export function buildLollipopChart(opts) {
  const {
    name,
    position,
    categoryEntity,
    categoryColumn,
    measureEntity,
    stemMeasure,
    dotMeasure,
    title,
    subtitle,
    stemColor = "#9AA8B2",
    dotColor = TWO_POINT_PALETTE.accent,
    sortDirection = "Ascending",
    innerPadding = 96,
    categoryNames = [],
    $schema = SCHEMA,
  } = opts;

  const stemMeta = [`${measureEntity}.${stemMeasure}`, stemMeasure];
  const dotMeta = [`${measureEntity}.${dotMeasure}`, dotMeasure];

  const filters = [];
  if (categoryNames.length) {
    const fid =
      "Filter" +
      [...Array(24)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("");
    filters.push(
      seriesInFilter(categoryEntity, categoryColumn, categoryNames, fid)
    );
  }

  return {
    $schema,
    name,
    position,
    visual: {
      visualType: "lineClusteredColumnComboChart",
      query: {
        queryState: {
          Category: { projections: [column(categoryEntity, categoryColumn)] },
          Y: { projections: [measure(measureEntity, stemMeasure)] },
          Y2: { projections: [measure(measureEntity, dotMeasure)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Measure: {
                  Expression: { SourceRef: { Entity: measureEntity } },
                  Property: stemMeasure,
                },
              },
              direction: sortDirection,
            },
          ],
        },
      },
      objects: {
        legend: [{ properties: { show: lit(false) } }],
        labels: [{ properties: { show: lit(false) } }],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid(TWO_POINT_PALETTE.muted),
              fontSize: litD(9),
              // Near-max padding → stem reads as a line, not a bar
              innerPadding: lit(innerPadding),
              preferredCategoryWidth: litD(48),
            },
          },
        ],
        valueAxis: [
          {
            properties: {
              show: lit(true),
              start: litD(0),
              secShow: lit(false),
              secStart: litD(0),
              gridlineShow: lit(true),
              gridlineColor: solid("#EEF2F5"),
              labelColor: solid(TWO_POINT_PALETTE.muted),
              fontSize: litD(9),
              showAxisTitle: lit(false),
              labelDisplayUnits: lit("0"),
            },
          },
        ],
        dataPoint: [
          { properties: { defaultColor: solid(stemColor) } },
          ...stemMeta.map((key) => ({
            properties: { fill: solid(stemColor) },
            selector: { metadata: key },
          })),
        ],
        lineStyles: [
          // Unselected defaults so markers still show if metadata selectors miss
          {
            properties: {
              strokeShow: lit(false),
              strokeWidth: litD(0),
              strokeTransparency: litD(100),
              showMarker: lit(true),
              showMarkerByDefault: lit(true),
              markerShape: lit("circle"),
              markerSize: litD(16),
              markerColor: solid(dotColor),
            },
          },
          ...dotMeta.map((key) => ({
            properties: {
              strokeShow: lit(false),
              strokeWidth: litD(0),
              strokeTransparency: litD(100),
              showMarker: lit(true),
              showMarkerByDefault: lit(true),
              markerShape: lit("circle"),
              markerSize: litD(16),
              markerColor: solid(dotColor),
            },
            selector: { metadata: key },
          })),
        ],
      },
      visualContainerObjects: cardChrome(
        title,
        subtitle ?? "Lollipop · hairline stem + heavy dot · not a bar chart"
      ),
    },
    ...(filters.length ? { filterConfig: { filters } } : {}),
  };
}

/**
 * OpenBI Statement kind — chart-of-accounts roll-up + variance bars.
 *
 * Returns [statementTable, varianceBars]. Bind DimAccount[StatementLabel]
 * (sorted by SortOrder) with Actual / Budget / Variance measures.
 */
/** Signed divergence fill: solid red below 0, solid green above (tight mid band). */
export function divergenceDataPoint(measureEntity, measureName, opts = {}) {
  const {
    adverse = "#B42318",
    neutral = "#6B7C86",
    favorable = "#1B7A4E",
  } = opts;
  const queryRef = `${measureEntity}.${measureName}`;
  return {
    properties: {
      fill: {
        solid: {
          color: {
            expr: {
              FillRule: {
                Input: {
                  Measure: {
                    Expression: { SourceRef: { Entity: measureEntity } },
                    Property: measureName,
                  },
                },
                FillRule: {
                  linearGradient3: {
                    min: {
                      color: { Literal: { Value: `'${adverse}'` } },
                      value: { Literal: { Value: "-1D" } },
                    },
                    mid: {
                      color: { Literal: { Value: `'${neutral}'` } },
                      value: { Literal: { Value: "0D" } },
                    },
                    max: {
                      color: { Literal: { Value: `'${favorable}'` } },
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
      metadata: queryRef,
    },
  };
}

export function buildStatementLayout(opts) {
  const {
    id,
    tablePosition,
    barsPosition,
    accountEntity = "DimAccount",
    labelColumn = "StatementLabel",
    sortColumn = "SortOrder",
    measureEntity = "FactPnL",
    actualMeasure = "Sum Actual Eur",
    budgetMeasure = "Sum Budget Eur",
    varianceMeasure = "Sum Variance Eur",
    signedVarianceMeasure = "Signed Variance Eur",
    tableTitle = "P&L statement - operator roll-up",
    barsTitle = "OP contribution variance (EUR)",
    favorableColor = "#1B7A4E",
    adverseColor = "#B42318",
    $schema = SCHEMA,
  } = opts;

  const nameTable = typeof id === "function" ? id() : `${id}_table`;
  const nameBars = typeof id === "function" ? id() : `${id}_bars`;

  const statementTable = {
    $schema,
    name: nameTable,
    position: tablePosition,
    visual: {
      visualType: "tableEx",
      query: {
        queryState: {
          Values: {
            projections: [
              column(accountEntity, labelColumn),
              measure(measureEntity, actualMeasure, true),
              measure(measureEntity, budgetMeasure, true),
              measure(measureEntity, varianceMeasure, true),
              measure(measureEntity, signedVarianceMeasure, true),
            ],
          },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: accountEntity } },
                  Property: sortColumn,
                },
              },
              direction: "Ascending",
            },
          ],
        },
      },
      objects: {
        columnHeaders: [
          {
            properties: {
              autoSizeColumnWidth: lit(true),
              fontSize: litD(10),
            },
          },
        ],
        values: [{ properties: { fontSize: litD(10) } }],
        grid: [{ properties: { outlineColor: solid("#E8EEF2"), outlineWeight: litD(1) } }],
      },
      visualContainerObjects: {
        ...cardChrome(tableTitle, "Operators on the left - Signed Variance = OP contribution"),
        stylePreset: [{ properties: { name: lit("None") } }],
      },
    },
  };

  const varianceBars = {
    $schema,
    name: nameBars,
    position: barsPosition,
    visual: {
      visualType: "barChart",
      query: {
        queryState: {
          Category: { projections: [column(accountEntity, labelColumn)] },
          Y: { projections: [measure(measureEntity, signedVarianceMeasure)] },
        },
        sortDefinition: {
          sort: [
            {
              field: {
                Column: {
                  Expression: { SourceRef: { Entity: accountEntity } },
                  Property: sortColumn,
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
              fontSize: litD(9),
              color: solid(TWO_POINT_PALETTE.ink),
            },
          },
        ],
        valueAxis: [{ properties: { show: lit(true), gridlineShow: lit(true), showAxisTitle: lit(false), labelColor: solid(TWO_POINT_PALETTE.muted), fontSize: litD(8) } }],
        categoryAxis: [
          {
            properties: {
              show: lit(true),
              showAxisTitle: lit(false),
              labelColor: solid(TWO_POINT_PALETTE.muted),
              fontSize: litD(9),
            },
          },
        ],
        dataPoint: [
          divergenceDataPoint(measureEntity, signedVarianceMeasure, {
            favorable: favorableColor,
            adverse: adverseColor,
          }),
        ],
      },
      visualContainerObjects: cardChrome(
        barsTitle,
        "Green helps OP vs budget - red hurts - statement order"
      ),
    },
  };

  return [statementTable, varianceBars];
}

export const plotPatternHelpers = {
  lit,
  litD,
  solid,
  measure,
  column,
  cardChrome,
  divergenceDataPoint,
  SCHEMA,
};

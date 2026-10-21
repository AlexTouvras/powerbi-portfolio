/**
 * PBIR helpers for Deneb argument-page binders (KM / forest / β(t)).
 * Specs live in templates/*.vl.json — field names must match engine Fact* columns.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DENEB_GUID = "deneb7E15AEF80B9E4D4F8E12924291ECE89A";

const SCHEMA =
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";

const BINDINGS = {
  km: {
    template: "km-at-risk.vl.json",
    entity: "FactKm",
    fields: [
      ["Stratum", "column"],
      ["Time", "column"],
      ["Survival", "column"],
      ["Lo", "column"],
      ["Hi", "column"],
      ["NRisk", "column"],
    ],
  },
  forest: {
    template: "forest.vl.json",
    entity: "FactCox",
    fields: [
      ["Term", "column"],
      ["HazardRatio", "column"],
      ["Lo", "column"],
      ["Hi", "column"],
    ],
  },
  betaT: {
    template: "beta-t.vl.json",
    entity: "FactBetaT",
    fields: [
      ["Term", "column"],
      ["Time", "column"],
      ["Residual", "column"],
      ["Beta", "column"],
      ["Lo", "column"],
      ["Hi", "column"],
      ["Kind", "column"],
    ],
  },
  betaTPanel: {
    template: "beta-t-panel.vl.json",
    entity: "FactBetaT",
    fields: [
      ["Term", "column"],
      ["Time", "column"],
      ["Residual", "column"],
      ["Beta", "column"],
      ["Lo", "column"],
      ["Hi", "column"],
      ["Kind", "column"],
    ],
  },
};

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

function projection(entity, name, kind) {
  const field =
    kind === "measure"
      ? { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: name } }
      : { Column: { Expression: { SourceRef: { Entity: entity } }, Property: name } };
  return {
    field,
    queryRef: `${entity}.${name}`,
    nativeQueryRef: name,
    active: true,
  };
}

function loadSpec(templateFile, replacements = {}) {
  let raw = fs.readFileSync(path.join(__dirname, "templates", templateFile), "utf8");
  for (const [key, value] of Object.entries(replacements)) {
    raw = raw.split(key).join(value);
  }
  // Compact JSON — Deneb stores the whole spec as a single-quoted PBIR literal.
  return JSON.stringify(JSON.parse(raw));
}

function escapeSpecLiteral(specJson) {
  // PBIR Literal.Value is a single-quoted string; escape inner quotes for JSON-in-string.
  return `'${specJson.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function cardChrome(title, subtitle) {
  const chrome = {
    background: [
      { properties: { show: lit(true), color: solid("#FFFFFF"), transparency: litD(0) } },
    ],
    border: [
      { properties: { show: lit(true), color: solid("#E8EEF2"), radius: litD(8) } },
    ],
    visualHeader: [{ properties: { show: lit(false) } }],
  };
  if (title) {
    chrome.title = [
      {
        properties: {
          show: lit(true),
          text: lit(title),
          fontSize: litD(12),
          fontColor: solid("#0F1C24"),
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
  } else {
    chrome.subTitle = [{ properties: { show: lit(false) } }];
  }
  return chrome;
}

function buildDeneb(name, pos, kind, title, subtitle, entityOverride, replacements = {}) {
  const cfg = BINDINGS[kind];
  if (!cfg) throw new Error(`Unknown Deneb binder kind: ${kind}`);
  const entity = entityOverride || cfg.entity;
  const specJson = loadSpec(cfg.template, replacements);
  return {
    $schema: SCHEMA,
    name,
    position: pos,
    visual: {
      visualType: DENEB_GUID,
      query: {
        queryState: {
          dataset: {
            projections: cfg.fields.map(([field, kind]) => projection(entity, field, kind)),
          },
        },
      },
      objects: {
        vega: [
          {
            properties: {
              jsonSpec: { expr: { Literal: { Value: escapeSpecLiteral(specJson) } } },
              jsonConfig: { expr: { Literal: { Value: "'{}'" } } },
            },
          },
        ],
      },
      visualContainerObjects: cardChrome(title, subtitle),
    },
  };
}

export function buildDenebKm(name, pos, title = "Kaplan–Meier", subtitle = "FactKm · band + at-risk", entity) {
  return buildDeneb(name, pos, "km", title, subtitle, entity);
}

export function buildDenebForest(name, pos, title = "Forest (hazard ratios)", subtitle = "FactCox · line at 1", entity) {
  return buildDeneb(name, pos, "forest", title, subtitle, entity);
}

export function buildDenebBetaT(name, pos, title = "β(t)", subtitle = "FactBetaT · PH check", entity) {
  return buildDeneb(name, pos, "betaT", title, subtitle, entity);
}

/** One β(t) term panel — use three stacked in PBIR so width:container fits without H-scroll. */
export function buildDenebBetaTPanel(name, pos, term, title, entity) {
  return buildDeneb(name, pos, "betaTPanel", title || term, "", entity, {
    __TERM__: term,
  });
}

/** Ensure report.json lists the AppSource Deneb GUID. */
export function ensureDenebPublicVisual(reportJsonPath) {
  const report = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
  const list = new Set(report.publicCustomVisuals || []);
  list.add(DENEB_GUID);
  report.publicCustomVisuals = [...list];
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
  return DENEB_GUID;
}

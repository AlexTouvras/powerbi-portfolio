/**
 * Ensure a Nordic Landing atmosphere image is registered in a PBIP Report.
 * Variants share the same mist / cool-gray vibe but use distinct scenes.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../assets");

/** @typedef {"fjord-dawn" | "alpine-mist" | "coastal-fog" | "valley-dusk"} AtmosphereVariant */

/** @type {Record<AtmosphereVariant, { source: string, display: string, file: string }>} */
export const LANDING_ATMOSPHERES = {
  "fjord-dawn": {
    source: "nordic-landing-fjord-dawn.png",
    display: "nordic-landing-fjord-dawn.png",
    file: "nordic-landing-fjord-dawn17123456789012345.png",
  },
  "alpine-mist": {
    source: "nordic-landing-alpine-mist.png",
    display: "nordic-landing-alpine-mist.png",
    file: "nordic-landing-alpine-mist17123456789012346.png",
  },
  "coastal-fog": {
    source: "nordic-landing-coastal-fog.png",
    display: "nordic-landing-coastal-fog.png",
    file: "nordic-landing-coastal-fog17123456789012347.png",
  },
  "valley-dusk": {
    source: "nordic-landing-valley-dusk.png",
    display: "nordic-landing-valley-dusk.png",
    file: "nordic-landing-valley-dusk17123456789012348.png",
  },
};

/** @deprecated Prefer LANDING_ATMOSPHERES["fjord-dawn"] */
export const LANDING_ATMOSPHERE_DISPLAY = LANDING_ATMOSPHERES["fjord-dawn"].display;
/** @deprecated Prefer LANDING_ATMOSPHERES["fjord-dawn"] */
export const LANDING_ATMOSPHERE_FILE = LANDING_ATMOSPHERES["fjord-dawn"].file;

/**
 * @param {string} reportDir
 * @param {AtmosphereVariant} [variant="fjord-dawn"]
 */
export function ensureLandingAtmosphere(reportDir, variant = "fjord-dawn") {
  const spec = LANDING_ATMOSPHERES[variant];
  if (!spec) {
    throw new Error(`Unknown atmosphere variant: ${variant}`);
  }
  const sharedPng = path.join(ASSETS, spec.source);
  // Fallback for older installs that only have the original filename
  const legacy = path.join(ASSETS, "nordic-landing-atmosphere.png");
  const src = fs.existsSync(sharedPng)
    ? sharedPng
    : variant === "fjord-dawn" && fs.existsSync(legacy)
      ? legacy
      : null;
  if (!src) {
    throw new Error(`Missing atmosphere asset: ${sharedPng}`);
  }

  const destDir = path.join(reportDir, "StaticResources/RegisteredResources");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, spec.file);
  fs.copyFileSync(src, dest);

  const reportPath = path.join(reportDir, "definition/report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (!Array.isArray(report.resourcePackages)) report.resourcePackages = [];

  let pkg = report.resourcePackages.find((p) => p.name === "RegisteredResources");
  if (!pkg) {
    pkg = { name: "RegisteredResources", type: "RegisteredResources", items: [] };
    report.resourcePackages.push(pkg);
  }
  if (!Array.isArray(pkg.items)) pkg.items = [];
  const exists = pkg.items.some((i) => i.name === spec.file);
  if (!exists) {
    pkg.items.push({
      name: spec.file,
      path: spec.file,
      type: "Image",
    });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return spec.file;
}

/**
 * @param {string} [colorHex="#F7FAFC"]
 * @param {number} [transparency=35]
 * @param {AtmosphereVariant} [variant="fjord-dawn"]
 */
export function pageBackgroundWithAtmosphere(
  colorHex = "#F7FAFC",
  transparency = 35,
  variant = "fjord-dawn"
) {
  const spec = LANDING_ATMOSPHERES[variant];
  if (!spec) {
    throw new Error(`Unknown atmosphere variant: ${variant}`);
  }
  return [
    {
      properties: {
        color: { solid: { color: { expr: { Literal: { Value: `'${colorHex}'` } } } } },
        transparency: { expr: { Literal: { Value: `${transparency}D` } } },
        image: {
          image: {
            name: { expr: { Literal: { Value: `'${spec.display}'` } } },
            url: {
              expr: {
                ResourcePackageItem: {
                  PackageName: "RegisteredResources",
                  PackageType: 1,
                  ItemName: spec.file,
                },
              },
            },
            scaling: { expr: { Literal: { Value: "'Fill'" } } },
          },
        },
      },
    },
  ];
}

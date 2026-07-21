/**
 * Ensure Nordic Landing atmosphere image is registered in a PBIP Report.
 * Returns the on-disk RegisteredResources filename.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_PNG = path.join(__dirname, "../assets/nordic-landing-atmosphere.png");
export const LANDING_ATMOSPHERE_DISPLAY = "nordic-landing-atmosphere.png";
export const LANDING_ATMOSPHERE_FILE = "nordic-landing-atmosphere17123456789012345.png";

export function ensureLandingAtmosphere(reportDir) {
  if (!fs.existsSync(SHARED_PNG)) {
    throw new Error(`Missing atmosphere asset: ${SHARED_PNG}`);
  }
  const destDir = path.join(reportDir, "StaticResources/RegisteredResources");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, LANDING_ATMOSPHERE_FILE);
  fs.copyFileSync(SHARED_PNG, dest);

  const reportPath = path.join(reportDir, "definition/report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (!Array.isArray(report.resourcePackages)) report.resourcePackages = [];

  let pkg = report.resourcePackages.find((p) => p.name === "RegisteredResources");
  if (!pkg) {
    pkg = { name: "RegisteredResources", type: "RegisteredResources", items: [] };
    report.resourcePackages.push(pkg);
  }
  if (!Array.isArray(pkg.items)) pkg.items = [];
  const exists = pkg.items.some((i) => i.name === LANDING_ATMOSPHERE_FILE);
  if (!exists) {
    pkg.items.push({
      name: LANDING_ATMOSPHERE_FILE,
      path: LANDING_ATMOSPHERE_FILE,
      type: "Image",
    });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return LANDING_ATMOSPHERE_FILE;
}

export function pageBackgroundWithAtmosphere(colorHex = "#F7FAFC", transparency = 35) {
  return [
    {
      properties: {
        color: { solid: { color: { expr: { Literal: { Value: `'${colorHex}'` } } } } },
        transparency: { expr: { Literal: { Value: `${transparency}D` } } },
        image: {
          image: {
            name: { expr: { Literal: { Value: `'${LANDING_ATMOSPHERE_DISPLAY}'` } } },
            url: {
              expr: {
                ResourcePackageItem: {
                  PackageName: "RegisteredResources",
                  PackageType: 1,
                  ItemName: LANDING_ATMOSPHERE_FILE,
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

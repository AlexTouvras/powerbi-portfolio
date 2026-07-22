/**
 * Snapshot latest Nordic board from gold CSVs → heatmap-web/public/board.json
 * Run: node scripts/snapshot-board.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gold = path.join(root, "data/gold");
const out = path.join(root, "heatmap-web/public/board.json");

/** Domains for logo favicons (Google s2). Initials fallback if missing. */
const DOMAINS = {
  NOKIA: "nokia.com",
  SAMPO: "sampo.com",
  KNEBV: "kone.com",
  NESTE: "neste.com",
  "NDA-FI": "nordea.com",
  UPM: "upm.com",
  STERV: "storaenso.com",
  FORTUM: "fortum.com",
  ORNBV: "orion.fi",
  WRT1V: "wartsila.com",
  ELISA: "elisa.fi",
  "VOLV-B": "volvo.com",
  "ATCO-A": "atlascopco.com",
  "INVE-B": "investorab.com",
  "HEXA-B": "hexagon.com",
  "ERIC-B": "ericsson.com",
  "SEB-A": "seb.se",
  "SWED-A": "swedbank.se",
  "SHB-A": "handelsbanken.se",
  "ASSA-B": "assaabloy.com",
  SAND: "home.sandvik",
  "ESSITY-B": "essity.com",
  "HM-B": "hm.com",
  ALFA: "alfalaval.com",
  "SKF-B": "skf.com",
  TELIA: "telia.com",
  BOL: "boliden.com",
  "NOVO-B": "novonordisk.com",
  DSV: "dsv.com",
  "MAERSK-B": "maersk.com",
  ORSTED: "orsted.com",
  "CARL-B": "carlsberggroup.com",
  "COLO-B": "coloplast.com",
  VWS: "vestas.com",
  DANSKE: "danskebank.com",
  GMAB: "genmab.com",
  EQNR: "equinor.com",
  DNB: "dnb.no",
  TEL: "telenor.com",
  MOWI: "mowi.com",
  YAR: "yara.com",
  NHY: "hydro.com",
  ORK: "orkla.com",
  CGCBV: "cargotec.com",
  KALMAR: "kalmarglobal.com",
  HIAB: "hiab.com",
  KESKOB: "kesko.fi",
  METSO: "mogroup.com",
  VALMT: "valmet.com",
  OUT1V: "outokumpu.com",
  HUH1V: "huhtamaki.com",
  TYRES: "nokiantyres.com",
  QTCOM: "qt.io",
  TIETO: "tietoevry.com",
  EQT: "eqtgroup.com",
  "EPI-A": "epiroc.com",
  "SAAB-B": "saab.com",
  "NIBE-B": "nibe.com",
  "SCA-B": "sca.com",
  AZN: "astrazeneca.com",
  "GETI-B": "getinge.com",
  "TEL2-B": "tele2.com",
  "SECU-B": "securitas.com",
  "ELUX-B": "electroluxgroup.com",
  SINCH: "sinch.com",
  "INDU-C": "industrivarden.se",
  "KINV-B": "kinnevik.com",
  PNDORA: "pandoragroup.com",
  "ROCK-B": "rockwool.com",
  "NSIS-B": "novonesis.com",
  "NZYM-B": "novonesis.com",
  DEMANT: "demant.com",
  GN: "gn.com",
  TRYG: "tryg.com",
  BAVA: "bavarian-nordic.com",
  "AMBU-B": "ambu.com",
  AKERBP: "akerbp.com",
  AKRBP: "akerbp.com",
  TOM: "tomra.com",
  SAL: "salmar.no",
  SALM: "salmar.no",
  STB: "storebrand.no",
  GJF: "gjensidige.no",
  BAKKA: "bakkafrost.com",
  SUBC: "subsea7.com",
  AUTO: "autostoresystem.com",
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const hdr = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const row = {};
    hdr.forEach((h, i) => {
      row[h] = parts[i];
    });
    return row;
  });
}

const companies = parseCsv(fs.readFileSync(path.join(gold, "DimCompany.csv"), "utf8"));
const prices = parseCsv(fs.readFileSync(path.join(gold, "FactPrices.csv"), "utf8"));
const latest = {};
for (const p of prices) {
  if (p.IsLatest === "1") {
    latest[p.Ticker] = {
      changePct: Number(p.ChangePct),
      close: Number(p.Close),
      date: p.Date,
    };
  }
}

const stocks = companies.map((c) => {
  const t = c.Ticker;
  const L = latest[t] || {};
  const domain = DOMAINS[t] || null;
  return {
    ticker: t,
    yahoo: c.YahooSymbol,
    name: c.CompanyName,
    country: c.Country,
    sector: c.Sector,
    industry: c.Industry,
    marketCapEURm: Number(c.MarketCapEURm),
    changePct: L.changePct ?? null,
    close: L.close ?? null,
    domain,
    logoUrl: domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      : null,
  };
});

const asOf =
  stocks.map((s) => latest[s.ticker]?.date).filter(Boolean).sort().at(-1) ||
  new Date().toISOString().slice(0, 10);

const board = {
  asOf,
  generatedAt: new Date().toISOString(),
  universe: "Nordic large caps (FI / SE / DK / NO)",
  count: stocks.length,
  stocks,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(board, null, 2));
console.log(`Wrote ${stocks.length} stocks → ${out} (asOf ${asOf})`);

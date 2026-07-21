/**
 * Build Nordic Equity gold CSVs from Yahoo Finance chart API (delayed).
 * Tables: DimCompany, DimDate, FactPrices (OHLCV + classic indicators).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gold = path.join(root, "data", "gold");
const RANGE = process.env.NORDIC_RANGE || "1y";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NordicEquityGold/1.0";

/** Curated Nordic large caps — YahooSymbol, display Ticker, sector, approx MarketCapEUR (M) */
const UNIVERSE = [
  // Finland
  { Ticker: "NOKIA", YahooSymbol: "NOKIA.HE", Name: "Nokia", Country: "FI", Sector: "Technology", Industry: "Communications Equipment", MarketCapEURm: 5200 },
  { Ticker: "SAMPO", YahooSymbol: "SAMPO.HE", Name: "Sampo", Country: "FI", Sector: "Financials", Industry: "Insurance", MarketCapEURm: 22000 },
  { Ticker: "KNEBV", YahooSymbol: "KNEBV.HE", Name: "KONE", Country: "FI", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 28000 },
  { Ticker: "NESTE", YahooSymbol: "NESTE.HE", Name: "Neste", Country: "FI", Sector: "Energy", Industry: "Oil & Gas Refining", MarketCapEURm: 12000 },
  { Ticker: "NDA-FI", YahooSymbol: "NDA-FI.HE", Name: "Nordea Bank", Country: "FI", Sector: "Financials", Industry: "Banks", MarketCapEURm: 42000 },
  { Ticker: "UPM", YahooSymbol: "UPM.HE", Name: "UPM-Kymmene", Country: "FI", Sector: "Materials", Industry: "Paper & Forest", MarketCapEURm: 14000 },
  { Ticker: "STERV", YahooSymbol: "STERV.HE", Name: "Stora Enso", Country: "FI", Sector: "Materials", Industry: "Paper & Forest", MarketCapEURm: 8000 },
  { Ticker: "FORTUM", YahooSymbol: "FORTUM.HE", Name: "Fortum", Country: "FI", Sector: "Utilities", Industry: "Electric Utilities", MarketCapEURm: 15000 },
  { Ticker: "ORNBV", YahooSymbol: "ORNBV.HE", Name: "Orion", Country: "FI", Sector: "Health Care", Industry: "Pharmaceuticals", MarketCapEURm: 7000 },
  { Ticker: "WRT1V", YahooSymbol: "WRT1V.HE", Name: "Wärtsilä", Country: "FI", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 11000 },
  { Ticker: "ELISA", YahooSymbol: "ELISA.HE", Name: "Elisa", Country: "FI", Sector: "Communication Services", Industry: "Telecom", MarketCapEURm: 7000 },
  { Ticker: "CGCBV", YahooSymbol: "CGCBV.HE", Name: "Cargotec", Country: "FI", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 4000 },
  // Sweden
  { Ticker: "VOLV-B", YahooSymbol: "VOLV-B.ST", Name: "Volvo B", Country: "SE", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 55000 },
  { Ticker: "ATCO-A", YahooSymbol: "ATCO-A.ST", Name: "Atlas Copco A", Country: "SE", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 70000 },
  { Ticker: "INVE-B", YahooSymbol: "INVE-B.ST", Name: "Investor B", Country: "SE", Sector: "Financials", Industry: "Diversified Financials", MarketCapEURm: 80000 },
  { Ticker: "HEXA-B", YahooSymbol: "HEXA-B.ST", Name: "Hexagon B", Country: "SE", Sector: "Technology", Industry: "Software", MarketCapEURm: 28000 },
  { Ticker: "ERIC-B", YahooSymbol: "ERIC-B.ST", Name: "Ericsson B", Country: "SE", Sector: "Technology", Industry: "Communications Equipment", MarketCapEURm: 25000 },
  { Ticker: "SEB-A", YahooSymbol: "SEB-A.ST", Name: "SEB A", Country: "SE", Sector: "Financials", Industry: "Banks", MarketCapEURm: 32000 },
  { Ticker: "SWED-A", YahooSymbol: "SWED-A.ST", Name: "Swedbank A", Country: "SE", Sector: "Financials", Industry: "Banks", MarketCapEURm: 25000 },
  { Ticker: "SHB-A", YahooSymbol: "SHB-A.ST", Name: "Handelsbanken A", Country: "SE", Sector: "Financials", Industry: "Banks", MarketCapEURm: 22000 },
  { Ticker: "ASSA-B", YahooSymbol: "ASSA-B.ST", Name: "ASSA ABLOY B", Country: "SE", Sector: "Industrials", Industry: "Building Products", MarketCapEURm: 30000 },
  { Ticker: "SAND", YahooSymbol: "SAND.ST", Name: "Sandvik", Country: "SE", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 25000 },
  { Ticker: "ESSITY-B", YahooSymbol: "ESSITY-B.ST", Name: "Essity B", Country: "SE", Sector: "Consumer Staples", Industry: "Household Products", MarketCapEURm: 18000 },
  { Ticker: "HM-B", YahooSymbol: "HM-B.ST", Name: "H&M B", Country: "SE", Sector: "Consumer Discretionary", Industry: "Apparel Retail", MarketCapEURm: 22000 },
  { Ticker: "ALFA", YahooSymbol: "ALFA.ST", Name: "Alfa Laval", Country: "SE", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 16000 },
  { Ticker: "SKF-B", YahooSymbol: "SKF-B.ST", Name: "SKF B", Country: "SE", Sector: "Industrials", Industry: "Machinery", MarketCapEURm: 9000 },
  { Ticker: "TELIA", YahooSymbol: "TELIA.ST", Name: "Telia", Country: "SE", Sector: "Communication Services", Industry: "Telecom", MarketCapEURm: 12000 },
  { Ticker: "BOL", YahooSymbol: "BOL.ST", Name: "Boliden", Country: "SE", Sector: "Materials", Industry: "Metals & Mining", MarketCapEURm: 10000 },
  // Denmark
  { Ticker: "NOVO-B", YahooSymbol: "NOVO-B.CO", Name: "Novo Nordisk B", Country: "DK", Sector: "Health Care", Industry: "Pharmaceuticals", MarketCapEURm: 350000 },
  { Ticker: "DSV", YahooSymbol: "DSV.CO", Name: "DSV", Country: "DK", Sector: "Industrials", Industry: "Logistics", MarketCapEURm: 45000 },
  { Ticker: "MAERSK-B", YahooSymbol: "MAERSK-B.CO", Name: "A.P. Moller-Maersk B", Country: "DK", Sector: "Industrials", Industry: "Marine Shipping", MarketCapEURm: 28000 },
  { Ticker: "ORSTED", YahooSymbol: "ORSTED.CO", Name: "Ørsted", Country: "DK", Sector: "Utilities", Industry: "Renewable Electricity", MarketCapEURm: 20000 },
  { Ticker: "CARL-B", YahooSymbol: "CARL-B.CO", Name: "Carlsberg B", Country: "DK", Sector: "Consumer Staples", Industry: "Beverages", MarketCapEURm: 18000 },
  { Ticker: "COLO-B", YahooSymbol: "COLO-B.CO", Name: "Coloplast B", Country: "DK", Sector: "Health Care", Industry: "Health Care Equipment", MarketCapEURm: 22000 },
  { Ticker: "VWS", YahooSymbol: "VWS.CO", Name: "Vestas Wind", Country: "DK", Sector: "Industrials", Industry: "Electrical Equipment", MarketCapEURm: 22000 },
  { Ticker: "DANSKE", YahooSymbol: "DANSKE.CO", Name: "Danske Bank", Country: "DK", Sector: "Financials", Industry: "Banks", MarketCapEURm: 25000 },
  { Ticker: "GMAB", YahooSymbol: "GMAB.CO", Name: "Genmab", Country: "DK", Sector: "Health Care", Industry: "Biotechnology", MarketCapEURm: 18000 },
  // Norway
  { Ticker: "EQNR", YahooSymbol: "EQNR.OL", Name: "Equinor", Country: "NO", Sector: "Energy", Industry: "Integrated Oil & Gas", MarketCapEURm: 70000 },
  { Ticker: "DNB", YahooSymbol: "DNB.OL", Name: "DNB Bank", Country: "NO", Sector: "Financials", Industry: "Banks", MarketCapEURm: 30000 },
  { Ticker: "TEL", YahooSymbol: "TEL.OL", Name: "Telenor", Country: "NO", Sector: "Communication Services", Industry: "Telecom", MarketCapEURm: 18000 },
  { Ticker: "MOWI", YahooSymbol: "MOWI.OL", Name: "Mowi", Country: "NO", Sector: "Consumer Staples", Industry: "Food Products", MarketCapEURm: 10000 },
  { Ticker: "YAR", YahooSymbol: "YAR.OL", Name: "Yara International", Country: "NO", Sector: "Materials", Industry: "Fertilizers", MarketCapEURm: 9000 },
  { Ticker: "NHY", YahooSymbol: "NHY.OL", Name: "Norsk Hydro", Country: "NO", Sector: "Materials", Industry: "Aluminum", MarketCapEURm: 12000 },
  { Ticker: "ORK", YahooSymbol: "ORK.OL", Name: "Orkla", Country: "NO", Sector: "Consumer Staples", Industry: "Food Products", MarketCapEURm: 8000 },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${RANGE}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${symbol}`);
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close?.[i] ?? adj?.[i];
    if (close == null || Number.isNaN(close)) continue;
    const d = new Date(ts[i] * 1000);
    const iso = d.toISOString().slice(0, 10);
    rows.push({
      Date: iso,
      Open: q.open?.[i] ?? close,
      High: q.high?.[i] ?? close,
      Low: q.low?.[i] ?? close,
      Close: close,
      Volume: q.volume?.[i] ?? 0,
    });
  }
  return rows;
}

function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      if (i < n - 1) continue;
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += values[j];
      prev = s / n;
      out[i] = prev;
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < n + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= n;
  avgLoss /= n;
  out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (n - 1) + gain) / n;
    avgLoss = (avgLoss * (n - 1) + loss) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function bollinger(values, n = 20, k = 2) {
  const mid = sma(values, n);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = n - 1; i < values.length; i++) {
    let sq = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const d = values[j] - mid[i];
      sq += d * d;
    }
    const sd = Math.sqrt(sq / n);
    upper[i] = mid[i] + k * sd;
    lower[i] = mid[i] - k * sd;
  }
  return { mid, upper, lower };
}

function enrich(rows) {
  const closes = rows.map((r) => r.Close);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null
  );
  const macdVals = macd.map((v) => v ?? 0);
  // Signal on MACD series — seed with nulls preserved
  const signal = new Array(macd.length).fill(null);
  const macdValidIdx = [];
  for (let i = 0; i < macd.length; i++) if (macd[i] != null) macdValidIdx.push(i);
  const macdSeries = macdValidIdx.map((i) => macd[i]);
  const sigSeries = ema(macdSeries, 9);
  for (let j = 0; j < macdValidIdx.length; j++) signal[macdValidIdx[j]] = sigSeries[j];
  const hist = macd.map((v, i) => (v != null && signal[i] != null ? v - signal[i] : null));
  const rsi14 = rsi(closes, 14);
  const bb = bollinger(closes, 20, 2);

  return rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1].Close : null;
    const change = prev != null ? r.Close - prev : null;
    const changePct = prev != null && prev !== 0 ? (change / prev) * 100 : null;
    return {
      ...r,
      PrevClose: prev,
      Change: change,
      ChangePct: changePct,
      SMA20: sma20[i],
      SMA50: sma50[i],
      EMA12: ema12[i],
      EMA26: ema26[i],
      MACD: macd[i],
      MACDSignal: signal[i],
      MACDHist: hist[i],
      RSI14: rsi14[i],
      BBMid: bb.mid[i],
      BBUpper: bb.upper[i],
      BBLower: bb.lower[i],
    };
  });
}

function csvEscape(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function buildDimDate(dates) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const uniq = [...new Set(dates)].sort();
  return uniq.map((iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const month = m;
    const q = Math.ceil(month / 3);
    return {
      Date: iso,
      Year: y,
      Month: month,
      MonthName: months[month - 1],
      YearMonth: `${y}-${String(month).padStart(2, "0")}`,
      Quarter: `Q${q}`,
      YearQuarter: `${y}-Q${q}`,
      Day: d,
      MonthYearSort: y * 100 + month,
    };
  });
}

function round(n, p = 4) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

async function main() {
  fs.mkdirSync(gold, { recursive: true });
  const factRows = [];
  const ok = [];
  const fail = [];

  for (let i = 0; i < UNIVERSE.length; i++) {
    const u = UNIVERSE[i];
    try {
      const raw = await fetchChart(u.YahooSymbol);
      if (raw.length < 60) throw new Error(`Too few bars (${raw.length})`);
      const enriched = enrich(raw);
      for (const r of enriched) {
        factRows.push({
          Date: r.Date,
          Ticker: u.Ticker,
          Open: round(r.Open, 4),
          High: round(r.High, 4),
          Low: round(r.Low, 4),
          Close: round(r.Close, 4),
          Volume: Math.round(r.Volume || 0),
          PrevClose: round(r.PrevClose, 4),
          Change: round(r.Change, 4),
          ChangePct: round(r.ChangePct, 4),
          MarketCapEURm: u.MarketCapEURm,
          SMA20: round(r.SMA20, 4),
          SMA50: round(r.SMA50, 4),
          EMA12: round(r.EMA12, 4),
          EMA26: round(r.EMA26, 4),
          MACD: round(r.MACD, 6),
          MACDSignal: round(r.MACDSignal, 6),
          MACDHist: round(r.MACDHist, 6),
          RSI14: round(r.RSI14, 4),
          BBMid: round(r.BBMid, 4),
          BBUpper: round(r.BBUpper, 4),
          BBLower: round(r.BBLower, 4),
        });
      }
      ok.push(u.Ticker);
      process.stdout.write(`OK ${u.Ticker} (${raw.length}d)\n`);
    } catch (e) {
      fail.push({ ticker: u.Ticker, err: String(e.message || e) });
      process.stdout.write(`FAIL ${u.Ticker}: ${e.message}\n`);
    }
    await sleep(120);
  }

  if (ok.length < 10) {
    throw new Error(`Too few successful tickers (${ok.length}). Aborting.`);
  }

  const dimCompany = UNIVERSE.filter((u) => ok.includes(u.Ticker)).map((u) => ({
    Ticker: u.Ticker,
    YahooSymbol: u.YahooSymbol,
    CompanyName: u.Name,
    Country: u.Country,
    Sector: u.Sector,
    Industry: u.Industry,
    MarketCapEURm: u.MarketCapEURm,
  }));

  const dimDate = buildDimDate(factRows.map((r) => r.Date));

  // Latest session flag for heatmap measures
  const maxDate = factRows.reduce((m, r) => (r.Date > m ? r.Date : m), "");
  for (const r of factRows) r.IsLatest = r.Date === maxDate ? 1 : 0;

  writeCsv(
    path.join(gold, "DimCompany.csv"),
    ["Ticker", "YahooSymbol", "CompanyName", "Country", "Sector", "Industry", "MarketCapEURm"],
    dimCompany
  );
  writeCsv(
    path.join(gold, "DimDate.csv"),
    ["Date", "Year", "Month", "MonthName", "YearMonth", "Quarter", "YearQuarter", "Day", "MonthYearSort"],
    dimDate
  );
  writeCsv(
    path.join(gold, "FactPrices.csv"),
    [
      "Date",
      "Ticker",
      "Open",
      "High",
      "Low",
      "Close",
      "Volume",
      "PrevClose",
      "Change",
      "ChangePct",
      "MarketCapEURm",
      "SMA20",
      "SMA50",
      "EMA12",
      "EMA26",
      "MACD",
      "MACDSignal",
      "MACDHist",
      "RSI14",
      "BBMid",
      "BBUpper",
      "BBLower",
      "IsLatest",
    ],
    factRows
  );

  const meta = {
    generatedAt: new Date().toISOString(),
    range: RANGE,
    latestDate: maxDate,
    okCount: ok.length,
    failCount: fail.length,
    fail,
    ok,
  };
  fs.writeFileSync(path.join(gold, "build-meta.json"), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify({ ok: true, ...meta, gold }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

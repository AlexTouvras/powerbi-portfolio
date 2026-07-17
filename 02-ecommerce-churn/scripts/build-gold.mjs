/**
 * Gold layer: clean ecommerce_churn.csv → data/gold/DimCustomer.csv
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rawPath = path.join(root, "data", "raw", "ecommerce_churn.csv");
const goldDir = path.join(root, "data", "gold");
const outPath = path.join(goldDir, "DimCustomer.csv");

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mean(nums) {
  const v = nums.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

function bandWarehouse(d) {
  if (d == null) return "Unknown";
  if (d <= 10) return "Very close";
  if (d <= 20) return "Close";
  if (d <= 30) return "Moderate";
  return "Far";
}

function bandTenure(t) {
  if (t == null) return "Unknown";
  if (t <= 6) return "0–6 months";
  if (t <= 12) return "7–12 months";
  if (t <= 24) return "13–24 months";
  return "25+ months";
}

function bandCashback(c) {
  if (c == null) return "Unknown";
  if (c <= 100) return "Low";
  if (c <= 200) return "Moderate";
  if (c <= 300) return "High";
  return "Very high";
}

function quintileScore(values, value, invert = false) {
  const sorted = [...values].filter((x) => x != null).sort((a, b) => a - b);
  if (value == null || !sorted.length) return 3;
  const idx = sorted.findIndex((x) => x >= value);
  const pct = idx < 0 ? 1 : idx / sorted.length;
  const score = Math.min(5, Math.max(1, Math.ceil(pct * 5)));
  return invert ? 6 - score : score;
}

const raw = fs.readFileSync(rawPath, "utf8");
let rows = parseCsv(raw);

// Categorical normalisation (per source SQL)
for (const r of rows) {
  if (r.PreferredLoginDevice === "Mobile Phone") r.PreferredLoginDevice = "Phone";
  if (r.PreferedOrderCat === "Mobile") r.PreferedOrderCat = "Mobile Phone";
  if (r.PreferredPaymentMode === "COD") r.PreferredPaymentMode = "Cash on Delivery";
  const wh = num(r.WarehouseToHome);
  if (wh === 126) r.WarehouseToHome = "26";
  if (wh === 127) r.WarehouseToHome = "27";
}

const numericCols = [
  "Tenure",
  "WarehouseToHome",
  "HourSpendOnApp",
  "OrderAmountHikeFromlastYear",
  "CouponUsed",
  "OrderCount",
  "DaySinceLastOrder",
];

const colMeans = {};
for (const c of numericCols) {
  colMeans[c] = mean(rows.map((r) => num(r[c])));
}

for (const r of rows) {
  for (const c of numericCols) {
    if (r[c] === "" || r[c] == null) r[c] = String(Math.round(colMeans[c] * 100) / 100);
  }
  r.Churn = String(num(r.Churn) ?? 0);
  r.CustomerStatus = r.Churn === "1" ? "Churned" : "Stayed";
  const wh = num(r.WarehouseToHome);
  const ten = num(r.Tenure);
  const cb = num(r.CashbackAmount);
  r.WarehouseDistanceBand = bandWarehouse(wh);
  r.TenureBand = bandTenure(ten);
  r.CashbackBand = bandCashback(cb);
}

const recencyVals = rows.map((r) => num(r.DaySinceLastOrder));
const freqVals = rows.map((r) => num(r.OrderCount));
for (const r of rows) {
  r.RecencyScore = String(quintileScore(recencyVals, num(r.DaySinceLastOrder), true));
  r.FrequencyScore = String(quintileScore(freqVals, num(r.OrderCount), false));
}

const headers = [
  "CustomerID",
  "Churn",
  "Tenure",
  "PreferredLoginDevice",
  "CityTier",
  "WarehouseToHome",
  "PreferredPaymentMode",
  "Gender",
  "HourSpendOnApp",
  "NumberOfDeviceRegistered",
  "PreferedOrderCat",
  "SatisfactionScore",
  "MaritalStatus",
  "NumberOfAddress",
  "Complain",
  "OrderAmountHikeFromlastYear",
  "CouponUsed",
  "OrderCount",
  "DaySinceLastOrder",
  "CashbackAmount",
  "CustomerStatus",
  "WarehouseDistanceBand",
  "TenureBand",
  "CashbackBand",
  "RecencyScore",
  "FrequencyScore",
];

fs.mkdirSync(goldDir, { recursive: true });
const lines = [headers.join(",")];
for (const r of rows) {
  lines.push(headers.map((h) => r[h] ?? "").join(","));
}
fs.writeFileSync(outPath, lines.join("\n"), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      rows: rows.length,
      churnRate: (rows.filter((r) => r.Churn === "1").length / rows.length).toFixed(4),
      outPath,
    },
    null,
    2
  )
);

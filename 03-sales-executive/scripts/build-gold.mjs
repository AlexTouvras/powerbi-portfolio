/**
 * Bronze CRM/ERP CSVs → Gold star-schema CSVs (mirrors DataWithBaraa silver/gold logic).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.resolve(__dirname, "../data/raw");
const goldDir = path.resolve(__dirname, "../data/gold");
fs.mkdirSync(goldDir, { recursive: true });

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  let row = [];
  let field = "";
  let inQuotes = false;
  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((x) => x !== "")).map((r) => {
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = (r[idx] ?? "").trim();
    });
    return o;
  });
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [columns.join(",")];
  for (const r of rows) {
    lines.push(columns.map((c) => esc(r[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

function parseYmd(v) {
  if (!v || v === "0" || String(v).length !== 8) return null;
  const s = String(v);
  const y = +s.slice(0, 4);
  const m = +s.slice(4, 6);
  const d = +s.slice(6, 8);
  if (!y || !m || !d) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function normCountry(c) {
  const t = (c || "").trim();
  if (!t) return "n/a";
  if (t === "DE") return "Germany";
  if (t === "US" || t === "USA") return "United States";
  return t;
}

function normGender(g) {
  const t = (g || "").trim().toUpperCase();
  if (t === "F" || t === "FEMALE") return "Female";
  if (t === "M" || t === "MALE") return "Male";
  return "n/a";
}

function productLine(code) {
  const t = (code || "").trim().toUpperCase();
  if (t === "M") return "Mountain";
  if (t === "R") return "Road";
  if (t === "S") return "Other Sales";
  if (t === "T") return "Touring";
  return "n/a";
}

const custRaw = parseCsv(fs.readFileSync(path.join(rawDir, "cust_info.csv"), "utf8"));
const az12 = parseCsv(fs.readFileSync(path.join(rawDir, "CUST_AZ12.csv"), "utf8"));
const loc = parseCsv(fs.readFileSync(path.join(rawDir, "LOC_A101.csv"), "utf8"));
const prdRaw = parseCsv(fs.readFileSync(path.join(rawDir, "prd_info.csv"), "utf8"));
const catRaw = parseCsv(fs.readFileSync(path.join(rawDir, "PX_CAT_G1V2.csv"), "utf8"));
const salesRaw = parseCsv(fs.readFileSync(path.join(rawDir, "sales_details.csv"), "utf8"));

// Deduplicate customers: latest create_date per cst_id
const custById = new Map();
for (const r of custRaw) {
  if (!r.cst_id) continue;
  const prev = custById.get(r.cst_id);
  if (!prev || (r.cst_create_date || "") >= (prev.cst_create_date || "")) {
    custById.set(r.cst_id, r);
  }
}

const azMap = new Map();
for (const r of az12) {
  let cid = r.CID || "";
  if (cid.startsWith("NAS")) cid = cid.slice(3);
  azMap.set(cid, r);
}

const locMap = new Map();
for (const r of loc) {
  const cid = (r.CID || "").replace(/-/g, "");
  locMap.set(cid, normCountry(r.CNTRY));
}

const catMap = new Map();
for (const r of catRaw) {
  catMap.set(r.ID, r);
}

// Customers gold
const dimCustomers = [];
let customerKey = 0;
const custIdToKey = new Map();
for (const r of [...custById.values()].sort((a, b) => +a.cst_id - +b.cst_id)) {
  customerKey += 1;
  const cstKey = r.cst_key;
  const az = azMap.get(cstKey);
  const country = locMap.get(cstKey) || "n/a";
  let gender = normGender(r.cst_gndr);
  if (gender === "n/a" && az) gender = normGender(az.GEN);
  const marital =
    (r.cst_marital_status || "").toUpperCase() === "S"
      ? "Single"
      : (r.cst_marital_status || "").toUpperCase() === "M"
        ? "Married"
        : "n/a";
  const row = {
    CustomerKey: customerKey,
    CustomerID: r.cst_id,
    CustomerNumber: cstKey,
    CustomerName: `${(r.cst_firstname || "").trim()} ${(r.cst_lastname || "").trim()}`.trim() || `Customer ${r.cst_id}`,
    FirstName: (r.cst_firstname || "").trim(),
    LastName: (r.cst_lastname || "").trim(),
    Country: country,
    MaritalStatus: marital,
    Gender: gender,
    Birthdate: az?.BDATE || "",
  };
  dimCustomers.push(row);
  custIdToKey.set(String(r.cst_id), customerKey);
}

// Products: extract cat_id + product_number; keep current (empty end) or latest start
const prdTransformed = prdRaw.map((r) => {
  const pk = r.prd_key || "";
  const catId = pk.slice(0, 5).replace(/-/g, "_");
  const productNumber = pk.length > 6 ? pk.slice(6) : pk;
  return {
    ...r,
    cat_id: catId,
    product_number: productNumber,
    prd_line_name: productLine(r.prd_line),
    cost: r.prd_cost === "" || r.prd_cost == null ? 0 : Number(r.prd_cost),
  };
});

const byProdNum = new Map();
for (const r of prdTransformed) {
  const list = byProdNum.get(r.product_number) || [];
  list.push(r);
  byProdNum.set(r.product_number, list);
}

const dimProducts = [];
let productKey = 0;
const prodNumToKey = new Map();
for (const [productNumber, list] of [...byProdNum.entries()].sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  const current = list.filter((x) => !x.prd_end_dt);
  const pick =
    current.sort((a, b) => (b.prd_start_dt || "").localeCompare(a.prd_start_dt || ""))[0] ||
    list.sort((a, b) => (b.prd_start_dt || "").localeCompare(a.prd_start_dt || ""))[0];
  productKey += 1;
  const cat = catMap.get(pick.cat_id);
  dimProducts.push({
    ProductKey: productKey,
    ProductID: pick.prd_id,
    ProductNumber: productNumber,
    ProductName: pick.prd_nm,
    CategoryId: pick.cat_id,
    Category: cat?.CAT || "n/a",
    Subcategory: cat?.SUBCAT || "n/a",
    ProductLine: pick.prd_line_name,
    Cost: pick.cost,
    Maintenance: cat?.MAINTENANCE || "n/a",
  });
  prodNumToKey.set(productNumber, productKey);
}

// Sales fact
const factSales = [];
let unmatchedProd = 0;
let unmatchedCust = 0;
let badDate = 0;
for (const r of salesRaw) {
  const orderDate = parseYmd(r.sls_order_dt);
  if (!orderDate) {
    badDate += 1;
    continue;
  }
  const qty = Number(r.sls_quantity) || 0;
  let price = Number(r.sls_price);
  let sales = Number(r.sls_sales);
  if (!price || price <= 0) price = qty ? sales / qty : 0;
  if (!sales || sales <= 0 || sales !== qty * Math.abs(price)) {
    sales = qty * Math.abs(price);
  }
  const pk = prodNumToKey.get(r.sls_prd_key);
  const ck = custIdToKey.get(String(r.sls_cust_id));
  if (!pk) unmatchedProd += 1;
  if (!ck) unmatchedCust += 1;
  factSales.push({
    OrderNumber: r.sls_ord_num,
    ProductKey: pk || 0,
    CustomerKey: ck || 0,
    OrderDate: orderDate,
    ShippingDate: parseYmd(r.sls_ship_dt) || "",
    DueDate: parseYmd(r.sls_due_dt) || "",
    SalesAmount: Math.round(sales * 100) / 100,
    Quantity: qty,
    Price: Math.round(Math.abs(price) * 100) / 100,
  });
}

// DimDate
const dates = factSales.map((x) => x.OrderDate).filter(Boolean).sort();
const minD = dates[0];
const maxD = dates[dates.length - 1];
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dimDate = [];
for (let d = minD; d <= maxD; d = addDays(d, 1)) {
  const dt = new Date(d + "T00:00:00Z");
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const monthName = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  dimDate.push({
    Date: d,
    Year: year,
    Month: month,
    MonthName: monthName,
    YearMonth: `${year}-${String(month).padStart(2, "0")}`,
    Quarter: `Q${Math.ceil(month / 3)}`,
    YearQuarter: `${year}-Q${Math.ceil(month / 3)}`,
    Day: dt.getUTCDate(),
    MonthYearSort: year * 100 + month,
  });
}

fs.writeFileSync(
  path.join(goldDir, "DimCustomer.csv"),
  toCsv(dimCustomers, [
    "CustomerKey",
    "CustomerID",
    "CustomerNumber",
    "CustomerName",
    "FirstName",
    "LastName",
    "Country",
    "MaritalStatus",
    "Gender",
    "Birthdate",
  ])
);
fs.writeFileSync(
  path.join(goldDir, "DimProduct.csv"),
  toCsv(dimProducts, [
    "ProductKey",
    "ProductID",
    "ProductNumber",
    "ProductName",
    "CategoryId",
    "Category",
    "Subcategory",
    "ProductLine",
    "Cost",
    "Maintenance",
  ])
);
fs.writeFileSync(
  path.join(goldDir, "FactSales.csv"),
  toCsv(factSales, [
    "OrderNumber",
    "ProductKey",
    "CustomerKey",
    "OrderDate",
    "ShippingDate",
    "DueDate",
    "SalesAmount",
    "Quantity",
    "Price",
  ])
);
fs.writeFileSync(
  path.join(goldDir, "DimDate.csv"),
  toCsv(dimDate, [
    "Date",
    "Year",
    "Month",
    "MonthName",
    "YearMonth",
    "Quarter",
    "YearQuarter",
    "Day",
    "MonthYearSort",
  ])
);

const revenue = factSales.reduce((s, r) => s + r.SalesAmount, 0);
console.log(
  JSON.stringify(
    {
      customers: dimCustomers.length,
      products: dimProducts.length,
      sales: factSales.length,
      dates: dimDate.length,
      unmatchedProd,
      unmatchedCust,
      badDate,
      revenue: Math.round(revenue),
      goldDir,
    },
    null,
    2
  )
);

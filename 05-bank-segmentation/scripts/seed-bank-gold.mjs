/**
 * Seed scaled bank gold CSVs (customers, accounts, transactions, date, city).
 * Schema aligned with franklinanalytics Bank-Segmentation-Analysis.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gold = path.join(root, "data", "gold");

const N_CUSTOMERS = 5000;
const TXN_PER_ACCOUNT_AVG = 12;
const SEED = 42;

// Mulberry32 PRNG for reproducibility
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const round2 = (n) => Math.round(n * 100) / 100;

const FIRST = [
  "Chinedu", "Aisha", "Tunde", "Ngozi", "Bola", "Obinna", "Fatima", "Yakubu",
  "Emeka", "Zainab", "Ifeanyi", "Uche", "Abubakar", "Lilian", "Segun", "Halima",
  "Adesuwa", "Kehinde", "Mercy", "Emmanuel", "Amaka", "Ibrahim", "Grace", "David",
];
const LAST = [
  "Okonkwo", "Balogun", "Adegoke", "Nwachukwu", "Danjuma", "Adelaja", "Ibrahim",
  "Umeh", "Ogunleye", "Abiola", "Mohammed", "Eze", "Lawal", "Obi", "Ahmed", "Onyeka",
  "Nwabueze", "Ajibade", "Suleman", "Johnson", "Okoro", "Bello", "Okeke", "Hassan",
];

/** Curated geocoding — Nigeria urban centers (approx city centroids WGS84) */
const CITIES = [
  { City: "Lagos", Latitude: 6.5244, Longitude: 3.3792 },
  { City: "Abuja", Latitude: 9.0765, Longitude: 7.3986 },
  { City: "Port Harcourt", Latitude: 4.8156, Longitude: 7.0498 },
  { City: "Enugu", Latitude: 6.5244, Longitude: 7.5105 }, // slight: Enugu ~6.4584, 7.5464
  { City: "Kano", Latitude: 12.0022, Longitude: 8.592 },
  { City: "Ibadan", Latitude: 7.3775, Longitude: 3.947 },
  { City: "Jos", Latitude: 9.8965, Longitude: 8.8583 },
  { City: "Abeokuta", Latitude: 7.1475, Longitude: 3.3619 },
  { City: "Calabar", Latitude: 4.9757, Longitude: 8.3417 },
  { City: "Owerri", Latitude: 5.484, Longitude: 7.0351 },
  { City: "Benin City", Latitude: 6.335, Longitude: 5.6037 },
  { City: "Kaduna", Latitude: 10.5105, Longitude: 7.4165 },
];
// Fix Enugu coords
CITIES[3] = { City: "Enugu", Latitude: 6.4584, Longitude: 7.5464 };

const CREDIT_DESC = [
  "Salary credited",
  "Bank transfer from GTBank",
  "Credit alert from Zenith",
  "Reversal of failed transaction",
  "Loan disbursement",
  "Wallet top-up",
  "Refund from vendor",
  "POS reversal",
  "Received from customer",
  "Online payment received",
  "Cash deposit",
];
const DEBIT_DESC = [
  "POS payment at Shoprite",
  "MTN Airtime recharge",
  "Fuel purchase at Mobil",
  "Electricity bill payment",
  "Loan EMI debit",
  "House rent payment",
  "Online purchase at Jumia",
  "Cash withdrawal from ATM",
  "Subscription payment",
  "Insurance premium debit",
  "Bank transfer to Fidelity Bank",
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

fs.mkdirSync(gold, { recursive: true });

// DimCity
{
  const lines = ["City,Latitude,Longitude,Country"];
  for (const c of CITIES) lines.push(`${c.City},${c.Latitude},${c.Longitude},Nigeria`);
  fs.writeFileSync(path.join(gold, "DimCity.csv"), lines.join("\n"));
}

// DimCustomer
const customers = [];
const today = new Date();
today.setUTCHours(12, 0, 0, 0);
const minSignup = addDays(today, -1095);

for (let i = 1; i <= N_CUSTOMERS; i++) {
  const city = pick(CITIES);
  const gender = rand() < 0.5 ? "M" : "F";
  const dob = addDays(new Date("1970-01-01T12:00:00Z"), randInt(0, 10000));
  const signup = addDays(minSignup, randInt(0, 1095));
  customers.push({
    CustomerID: i,
    CustomerName: `${pick(FIRST)} ${pick(LAST)}`,
    Gender: gender,
    BirthDate: isoDate(dob),
    SignupDate: isoDate(signup),
    City: city.City,
    Latitude: city.Latitude,
    Longitude: city.Longitude,
  });
}
{
  const headers = Object.keys(customers[0]);
  const lines = [headers.join(",")];
  for (const r of customers) lines.push(headers.map((h) => r[h]).join(","));
  fs.writeFileSync(path.join(gold, "DimCustomer.csv"), lines.join("\n"));
}

// DimAccount — 1–2 per customer
const accounts = [];
let accountId = 1;
for (const c of customers) {
  const n = rand() < 0.65 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const open = addDays(new Date(c.SignupDate + "T12:00:00Z"), randInt(0, 90));
    accounts.push({
      AccountID: accountId++,
      CustomerID: c.CustomerID,
      AccountNumber: String(randInt(1e9, 1e10 - 1)).padStart(10, "0"),
      AccountType: pick(["savings", "current", "loan"]),
      OpenDate: isoDate(open),
      Balance: round2(1000 + rand() * 499000),
    });
  }
}
{
  const headers = Object.keys(accounts[0]);
  const lines = [headers.join(",")];
  for (const r of accounts) lines.push(headers.map((h) => r[h]).join(","));
  fs.writeFileSync(path.join(gold, "DimAccount.csv"), lines.join("\n"));
}

// FactTransactions
const txns = [];
let txnId = 1;
const minTxn = addDays(today, -730);
for (const a of accounts) {
  const n = randInt(4, TXN_PER_ACCOUNT_AVG * 2);
  for (let k = 0; k < n; k++) {
    const isCredit = rand() < 0.48;
    const d = addDays(minTxn, randInt(0, 730));
    // Bias: some accounts dormant (few recent txns)
    if (a.CustomerID % 17 === 0 && d > addDays(today, -365)) continue;
    txns.push({
      TransactionID: txnId++,
      AccountID: a.AccountID,
      CustomerID: a.CustomerID,
      TransactionDate: isoDate(d),
      Amount: round2(500 + rand() * 249500),
      TransactionType: isCredit ? "credit" : "debit",
      Description: isCredit ? pick(CREDIT_DESC) : pick(DEBIT_DESC),
    });
  }
}
{
  const headers = Object.keys(txns[0]);
  const lines = [headers.join(",")];
  for (const r of txns) lines.push(headers.map((h) => r[h]).join(","));
  fs.writeFileSync(path.join(gold, "FactTransactions.csv"), lines.join("\n"));
}

// DimDate continuous
{
  const start = addDays(today, -800);
  const end = today;
  const lines = ["Date,Year,Month,MonthName,YearMonth,Quarter,YearQuarter,Day,MonthYearSort"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const q = Math.ceil(m / 3);
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const sort = y * 100 + m;
    lines.push(
      `${isoDate(d)},${y},${m},${monthNames[m - 1]},${ym},Q${q},${y}-Q${q},${day},${sort}`
    );
  }
  fs.writeFileSync(path.join(gold, "DimDate.csv"), lines.join("\n"));
}

console.log(
  JSON.stringify(
    {
      ok: true,
      customers: customers.length,
      accounts: accounts.length,
      transactions: txns.length,
      cities: CITIES.length,
      gold,
    },
    null,
    2
  )
);

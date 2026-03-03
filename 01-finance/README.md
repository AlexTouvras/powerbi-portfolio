# 01 – Nordic Stock Market Treemap Dashboard

## 1. Business context

This dashboard provides a high-level visual overview of Nordic stock market performance using a treemap layout.  
Primary audience: investors, analysts, or finance stakeholders who want a quick sense of how different sectors and countries in the Nordic region are performing.  
Purpose: Help users quickly identify winning and losing sectors, spot standout stocks, and understand the overall market mood at a glance.

The focus is on stocks listed in the Nordic markets (e.g. Sweden, Finland, Norway, Denmark, and optionally Iceland).

---

## 2. Key questions

This report is designed to answer questions such as:

1. Which sectors in the Nordic markets are performing best and worst today (or for the latest available trading day)?
2. Which individual stocks are the top gainers and losers by daily percentage change?
3. How is performance distributed across countries (e.g. Sweden vs Finland vs Norway vs Denmark)?
4. How concentrated is market capitalization across sectors and stocks?
5. What is the overall balance between advancing and declining stocks?

---

## 3. Metrics and dimensions

### Core metrics

- Latest price (close or last traded price)
- Previous close price
- Daily price change (absolute)
- Daily price change %
- Volume (optional)
- Market capitalization

From these fields, the dashboard uses DAX measures such as:

- Total Market Cap
- Average Daily Change %
- Count of Stocks
- Number of Advancers (Daily Change % > 0)
- Number of Decliners (Daily Change % < 0)

### Dimensions

- Date (trading date)
- Ticker
- Company name
- Country (e.g. SE, FI, NO, DK, IS)
- Sector (e.g. Financials, Industrials, Healthcare)
- Industry / sub‑sector (optional)
- Index / market segment (optional, e.g. Large Cap, Mid Cap, Small Cap)

---

## 4. Data source

- Source: Nordic stock market price data (e.g. from an API, market data provider, or downloaded end‑of‑day files).  
- Time period covered: Focused primarily on the **latest trading day** for the treemap view, with the option to extend to a recent window (e.g. last 5–30 days) for trends.  
- Granularity: One row per stock per date.

For portfolio purposes, this dashboard uses **delayed or end‑of‑day data**, not real-time tick‑by‑tick prices.  
The emphasis is on modeling and visualization rather than on live trading or execution.

### Planned tables

- `FactPrices`
  - Date  
  - Ticker  
  - ClosePrice  
  - PreviousClosePrice  
  - DailyChange (ClosePrice − PreviousClosePrice)  
  - DailyChangePct (DailyChange / PreviousClosePrice)  
  - Volume (optional)  
  - MarketCap  

- `DimCompany`
  - Ticker  
  - CompanyName  
  - Country  
  - Sector  
  - Industry (optional)  
  - IndexSegment (optional)  

- Optional: `DimDate`
  - Date  
  - Year, Quarter, Month, Day, etc.

---

## 5. Planned KPIs

The initial version of this dashboard will focus on:

- **Total Market Cap** (sum of all included stocks)
- **Average Daily Change %** across all selected stocks
- **Number of Stocks** in the current selection
- **Number of Advancers** vs **Number of Decliners**
- **Top Gainer** and **Top Loser** by Daily Change %

These KPIs will be implemented as DAX measures and used consistently across visuals.

---

## 6. Planned layout (v1)

**Page: Nordic Market Overview**

- **Top bar**
  - Page title: *“Nordic Stock Market – Treemap Overview”*  
  - Short subtitle describing the purpose and data delay (e.g. “End‑of‑day prices, delayed data”).  
  - Slicers:
    - Date (latest trading days)
    - Country
    - Sector

  - KPI cards (right side):
    - Total Market Cap
    - Average Daily Change %
    - Number of Stocks
    - Advancers vs Decliners (could be a card or a small bar)

- **Main area – left**
  - Treemap:
    - Group: Sector (and optionally Industry within Sector)
    - Size: Market Cap
    - Color: Daily Change % (e.g. green for positive, red for negative, neutral for flat)

- **Main area – right**
  - Bar chart:
    - Average Daily Change % by Sector
  - Table or bar chart:
    - Top 10 Gainers (by Daily Change %)
  - Table or bar chart:
    - Top 10 Losers (by Daily Change %)

---

## 7. Design and style

This dashboard follows a clean, Nordic-inspired design:

- Light, neutral background with plenty of white space.
- Limited, calm color palette:
  - Neutral colors for most elements
  - Green / red only for performance indication (Daily Change %).
- Simple, readable typography with consistent font sizes.
- Minimal text and clutter, focusing on a few high‑impact visuals.

---

## 8. Future enhancements (ideas)

- Add time‑series visuals to show sector performance over multiple days or weeks.
- Introduce filters for index membership (e.g. main index vs small caps).
- Add tooltips with key financial ratios (P/E, dividend yield, etc.) if data is available.
- Automate data refresh from an API or scheduled job.

# Report Spec — Logistics Pulse

**Status:** APPROVED — Featured on portfolio main  
**Folder:** `04-supply-chain`  
**Report name:** Logistics Pulse  
**PBIP:** `LogisticsPulse.pbip`  
**Theme:** Nordic Boardroom (`_shared/themes/Nordic-Boardroom*.json`)  
**Landing atmosphere:** `harbor-mist`

---

## 1. Job to be done

| Field | Decision |
|-------|----------|
| Audience | COO / logistics lead |
| Primary job | In ≤10s: is on-time delivery on track? Then: which sellers/routes bleed? Then: what demand (with uncertainty) should capacity plan against? |
| Success | Viewer leaves with **3 executable moves** (intervene on late sellers / tighten freight corridors / plan capacity off forecast band) |
| Failure | Looks like another propensity queue or Bank-style map hero |

**Differentiation vs portfolio peers**

- `02` / `06` / `11` = classification / propensity / scorecard — **not** time-series forecast  
- `05-bank` = Icon Map geo hero — **avoid** as hero here  
- This report = **ops vocabulary** + portfolio-first **demand forecast prediction-interval ribbon**

---

## 2. Design identity

| Element | Choice |
|---------|--------|
| Tone | Nordic Boardroom (mist `#F7FAFC`, teal `#2F5F73`, copper `#C17B3A`) |
| Signature | **Forecast band** — Demand Outlook shows actuals + forecast + 80%/95% prediction-interval ribbon; other pages inherit on-time / late semantic colors |
| Chrome | Page navigator pills · footer source line · filter pane collapsed on Landing/Context |
| Risk color | Semantic green/amber/red **only** for on-time / late / risk bands — never decorative |

---

## 3. Dataset & gold

| Layer | Decision |
|-------|----------|
| Source | [Olist Brazilian E-Commerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) (9 CSVs; CC BY-NC-SA 4.0) |
| Grain | Delivered orders with non-null `order_delivered_customer_date` |
| Raw in git | **No** — gitignored; download via script / Kaggle / GitHub mirror |
| Branding | Report KPI = **On-time delivery %**; Context explains OTIF-style framing; **In-Full out of v1** |

### Metric definitions (binding)

| Metric | Definition |
|--------|------------|
| Population | `order_status = delivered` ∧ non-null delivered_customer_date |
| On-time | calendar date(delivered) ≤ calendar date(estimated_delivery) |
| Lead time | days purchase → delivered |
| Seller rank gate | ≥ 30 delivered orders |
| Demand series | weekly **order count** by purchase week |

### Gold tables

| Table | Grain | Key columns |
|-------|-------|-------------|
| `FactOrders` | 1 row / order | OrderID, OrderDate, OnTime, LeadTimeDays, Freight, SellerID, CustomerState, SellerState, Category, LateFlag |
| `DimSeller` | 1 row / seller | SellerID, City, State, OrderN, LateRate, RiskBand, RiskRank |
| `DimProduct` | category | Category (EN), OrderN |
| `DimCustomer` | customer | CustomerID, State |
| `DimDate` | day | continuous calendar covering order dates |
| `FactDemandWeekly` | week | WeekStart, Orders (actuals history) |
| `FactForecast` | week | WeekStart, Actual, Forecast, Lo80, Hi80, Lo95, Hi95, IsFuture |
| `FactCorridor` | seller_state × customer_state | Orders, LateRate, AvgLeadTime, AvgFreight |
| `ModelMetrics` | 1 row | HoldoutMAPE, Coverage80, Coverage95, Method, HorizonWeeks, SampleN |

### Forecast method

1. Aggregate weekly order counts by purchase week  
2. Hold out last **12** weeks for backtest  
3. Fit **SARIMAX** (weekly seasonality) when available; else seasonal-naive fallback  
4. Forward horizon **8** weeks; write 80%/95% prediction intervals  
5. Persist holdout MAPE + interval coverage to `ModelMetrics`

---

## 4. Page plan (5 visible)

### P0 — Landing (Portfolio Landing)

- Poster · thesis · audience · numbered page map  
- **One hero:** On-time delivery % (composite KPI treatment)  
- Thesis names Demand Outlook forecast band as craft differentiator  
- No slicers / charts · atmosphere `harbor-mist`

### P1 — Delivery Pulse (Executive · Hero-Right)

**Question:** Is delivery performance on track?

| Zone | Content |
|------|---------|
| KPIs | On-time % · Avg lead time · Late orders · Delivered orders |
| Trend | Monthly volume + on-time rate |
| Mix | Category late-rate bars (top categories) |

### P2 — Sellers & Routes (Analytical)

**Question:** Which sellers and corridors bleed?

| Zone | Content |
|------|---------|
| Queue | Seller late-rate rank (N≥30) · RiskBand · RecommendedAction |
| Corridor | State→state matrix / table (orders, late rate) — **not** Icon Map hero |
| Scatter | Freight vs late rate (optional secondary) |

### P3 — Demand Outlook (Analytical — **signature**)

**Question:** What demand should we plan for — with uncertainty?

| Zone | Content |
|------|---------|
| Hero band | Weekly actuals + forecast + PI ribbon (80%/95%) |
| KPI | Holdout MAPE · Coverage80 · Forward 8-week sum |
| Mix | Light category volume (historical) |

### P4 — Context (facts-only, last visible)

- Olist attribution · Brazilian 2016–2018 sample  
- On-time definition · In-Full out of scope  
- Forecast method + caveats · not inventory policy advice  

---

## 5. Measures (core)

`Orders`, `OnTime Orders`, `On-time %`, `Late Orders`, `Avg Lead Time`, `Avg Freight`,  
`Holdout MAPE`, `Coverage 80`, `Coverage 95`, `Forecast Horizon Orders`

---

## 6. Build sequence

| Phase | Work | Verify |
|------:|------|--------|
| 1 | Download Olist raw (gitignored) | 9 CSVs present |
| 2 | `build-gold.py` + `forecast-demand.py` | gold CSVs + ModelMetrics |
| 3 | `scaffold-logistics-pbip.mjs` | TMDL + page shells |
| 4 | `elevate-logistics-report.mjs` | Landing + 4 pages + nav |
| 5 | Validate + Desktop screenshots | `powerbi-report-author validate`; no banners |
| 6 | README + DATASETS Featured | Orbit sync if requested |

---

## 7. Out of scope (v1)

- Live carrier APIs  
- EOQ / inventory solver what-if  
- Delay-propensity ML queue  
- Icon Map as hero  
- Fabric publish  
- True In-Full OTIF without documented multi-item rule  

---

## 8. User decisions (settled)

- Audience COO · Nordic Boardroom · local PBIP  
- Pages: Landing · Delivery Pulse · Sellers & Routes · Demand Outlook · Context  
- Landing hero = On-time %; signature visual = forecast band  
- Plan approved 2026-07-24: “approved. lock and start working on it”

---

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-design
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: Nordic Boardroom
    signature: Forecast prediction-interval ribbon on Demand Outlook; on-time/late semantic accents elsewhere
  archetype: Portfolio Landing + Executive + Analytical composition
  color_map:
    - measure: FactOrders[On-time %]
      color: "#1B7A4E"
      tint: "#E6F4EC"
    - measure: FactOrders[Late Orders]
      color: "#B42318"
      tint: "#FCE8E6"
    - measure: FactOrders[Orders]
      color: "#2F5F73"
      tint: "#E8EEF2"
    - measure: FactOrders[Avg Lead Time]
      color: "#C17B3A"
      tint: "#F5E6D8"
    - measure: FactForecast[Forecast]
      color: "#2F5F73"
      tint: "#D9E6EC"
    - measure: FactForecast[Hi80]
      color: "#5B8FA3"
      tint: "#E8EEF2"
  pages:
    - name: Landing
      role: landing
      archetype: Portfolio Landing
      layout_variant: A
      variant_rationale: Portfolio poster cover required for Nordic Boardroom Orbit open
      page_background: "#F7FAFC"
      layout_summary: Harbor-mist atmosphere; teal rail; white poster; copper rule; one On-time % hero; numbered page map
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            rail: [1, 1, 1, 13]
            poster: [2, 2, 9, 11]
            hero: [2, 5, 6, 8]
            map: [2, 8, 9, 11]
        placements:
          - id: page_title
            region: poster
            kind: textbox
            text: "Logistics Pulse"
            purpose: "Brand the report as the ops delivery story."
          - id: hero_ontime
            region: hero
            kind: composite_kpi
            field_bindings: FactOrders[On-time %]
            purpose: "One editorial ops number — on-time delivery rate."
            insight_basis: "Delivered orders with delivered_date <= estimated_delivery_date"
          - id: page_map
            region: map
            kind: textbox
            text: "1 Delivery Pulse · 2 Sellers & Routes · 3 Demand Outlook · 4 Context"
            purpose: "Numbered beats for analysis pages only."
        space_audit:
          unplaced_regions: []
          rationale: "Landing is poster-only; no chart regions; whitespace intentional."
    - name: Delivery Pulse
      role: detail
      archetype: Executive Summary
      layout_variant: B
      variant_rationale: KPI strip + trend + category mix — ops scan then drivers
      page_background: "#F7FAFC"
      layout_summary: Four KPIs; monthly trend; category late bars; year/state filters
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis: [1, 2, 13, 4]
            trend: [1, 4, 8, 9]
            mix: [8, 4, 13, 9]
            footer: [1, 12, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Delivery Pulse"
            purpose: "State the ops health page."
          - id: slicer_year
            region: filters
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: slicer_customer_state
            region: filters
            kind: slicer
            field_bindings: FactOrders[CustomerState]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: kpi_ontime
            region: kpis
            kind: card
            field_bindings: FactOrders[On-time %]
            purpose: "Primary delivery health."
          - id: kpi_lead
            region: kpis
            kind: card
            field_bindings: FactOrders[Avg Lead Time]
            purpose: "Speed of delivery."
          - id: kpi_late
            region: kpis
            kind: card
            field_bindings: FactOrders[Late Orders]
            purpose: "Exception volume."
          - id: kpi_orders
            region: kpis
            kind: card
            field_bindings: FactOrders[Orders]
            purpose: "Scale context."
          - id: trend_volume
            region: trend
            kind: lineChart
            field_bindings: [DimDate[YearMonth], FactOrders[Orders], FactOrders[On-time %]]
            purpose: "Volume and on-time over time."
          - id: category_late
            region: mix
            kind: barChart
            field_bindings: [FactOrders[Category], FactOrders[On-time %]]
            purpose: "Which categories miss on-time most."
        space_audit:
          unplaced_regions: []
          rationale: "Balanced left trend / right category; KPI band full width."
    - name: Sellers & Routes
      role: detail
      archetype: Analytical Canvas
      layout_variant: C
      variant_rationale: Action queue + corridor table without map hero (Bank owns Icon Map)
      page_background: "#F7FAFC"
      layout_summary: Seller risk queue; corridor performance table; freight vs late scatter
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            queue: [1, 2, 8, 9]
            corridor: [8, 2, 13, 7]
            scatter: [8, 7, 13, 12]
            footer: [1, 12, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Sellers & Routes"
            purpose: "Name the intervention page."
          - id: slicer_seller_state
            region: filters
            kind: slicer
            field_bindings: DimSeller[State]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: slicer_risk
            region: filters
            kind: slicer
            field_bindings: DimSeller[RiskBand]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: seller_queue
            region: queue
            kind: tableEx
            field_bindings: [DimSeller[SellerID], DimSeller[State], DimSeller[OrderN], DimSeller[LateRate], DimSeller[RiskBand], DimSeller[RecommendedAction]]
            purpose: "Ranked sellers to intervene on."
          - id: corridor_table
            region: corridor
            kind: tableEx
            field_bindings: [FactCorridor[SellerState], FactCorridor[CustomerState], FactCorridor[Orders], FactCorridor[LateRate]]
            purpose: "State corridors with late bleed."
          - id: freight_scatter
            region: scatter
            kind: scatterChart
            field_bindings: [DimSeller[AvgFreight], DimSeller[LateRate], DimSeller[OrderN]]
            purpose: "Freight cost vs lateness trade-off."
        space_audit:
          unplaced_regions: []
          rationale: "Queue dominates left; corridor+scatter stack right; no map region."
    - name: Demand Outlook
      role: detail
      archetype: Analytical Canvas
      layout_variant: A
      variant_rationale: Signature forecast band needs dominant width; metrics as supporting KPIs
      page_background: "#F7FAFC"
      layout_summary: Forecast ribbon hero; MAPE/coverage KPIs; light category mix
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis: [1, 2, 13, 4]
            band: [1, 4, 10, 11]
            mix: [10, 4, 13, 11]
            footer: [1, 12, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Demand Outlook"
            purpose: "Name the forecast signature page."
          - id: kpi_mape
            region: kpis
            kind: card
            field_bindings: ModelMetrics[HoldoutMAPE]
            purpose: "Forecast accuracy on holdout."
          - id: kpi_cov80
            region: kpis
            kind: card
            field_bindings: ModelMetrics[Coverage80]
            purpose: "80% interval calibration."
          - id: kpi_horizon
            region: kpis
            kind: card
            field_bindings: FactOrders[Forecast Horizon Orders]
            purpose: "Sum of forward 8-week forecast."
          - id: forecast_band
            region: band
            kind: lineChart
            field_bindings: [FactForecast[WeekStart], FactForecast[Actual], FactForecast[Forecast], FactForecast[Lo80], FactForecast[Hi80]]
            purpose: "Signature actuals + forecast + prediction interval ribbon."
            color_strategy: measure_match
          - id: category_mix
            region: mix
            kind: barChart
            field_bindings: [FactOrders[Category], FactOrders[Orders]]
            purpose: "Historical category volume context."
        space_audit:
          unplaced_regions: []
          rationale: "Band is dominant hero region; mix is narrow secondary."
    - name: Context
      role: detail
      archetype: Narrative Story
      layout_variant: B
      variant_rationale: Facts-only documentation page; no interactive analysis
      page_background: "#F7FAFC"
      layout_summary: Source, metric definitions, forecast caveats, disclaimers
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 13, 2]
            body: [1, 2, 13, 12]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Context"
            purpose: "Facts-only documentation."
          - id: context_body
            region: body
            kind: textbox
            text: "Olist Brazilian E-Commerce 2016–2018 · On-time = delivered date ≤ estimated · In-Full out of v1 · SARIMAX weekly demand forecast with PI bands · sample demo not inventory policy"
            purpose: "Attribution and caveats."
        space_audit:
          unplaced_regions: []
          rationale: "Single documentation column; no charts."
```

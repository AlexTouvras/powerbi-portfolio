# Report Spec

## Report identity
- Report name: Sales Executive — Portfolio Pulse
- Semantic model: new local PBIP from `03-sales-executive/data/raw` (CRM/ERP CSVs)
- Audience: C-level / senior leadership (CEO, CFO, CRO, board)
- Primary purpose: Know sales health in ≤10s; self-serve into drivers and customer/market concentration
- Delivery target: Local PBIP first (Fabric publish later, AUTH required)

## User decisions and constraints
- Scope: KDNuggets Sales (#3) only — other article datasets WIP
- Page count: **3**
- Interactivity: synced date + country + category; searchable customer on page 3; page navigation
- Design direction: **Nordic Boardroom** (improved theme)
- Publishing: local only until authorized
- Tooling: PBIP + Desktop Bridge verify before portfolio-ready
- Model edit permissions: create star schema + measures in PBIP
- Accessibility: WCAG AA text; color never sole variance signal; alt text on every visual
- Data caveats: AdventureWorks-style sample from article warehouse CSVs; dates are `YYYYMMDD` integers until typed; customer key prefix needs normalize (`AW` vs `AW-`)

## Narrative
- Core story: Is the portfolio growing profitably, and where should leadership lean in or intervene?
- Audience promise: Board-ready clarity without analyst babysitting
- Key questions answered:
  1. How are revenue, orders, AOV, and customers trending vs prior year?
  2. Which products/categories drive or drag performance?
  3. Which countries and customers concentrate risk/opportunity?

## Design identity (from `powerbi-report-design`)
- Tone: Nordic Boardroom — cool mist `#F7FAFC`, fjord teal `#2F5F73`, copper `#C17B3A` as second categorical hue; Segoe UI; sparse chrome; semantic green/red only for variance
- Signature: Composite KPI strip — headline value + YoY delta with color **and** ▲/▼ text
- Theme file: `_shared/themes/Nordic-Boardroom.json` (see `_shared/themes/THEME-REVIEW.md`)
- Brownfield delta: Nordic-Finesse → Nordic-Boardroom (contrast + sentiment + categorical separation)

## Page plan
1. **Portfolio Pulse**
   - Archetype: Executive Summary
   - Layout variant: **B. KPI-Strip** — five peer KPIs, no single hero metric
   - Purpose: 5-second status
   - Visuals: 5 composite KPI cards; monthly revenue trend; category mix bar
   - Fields/measures: Revenue, Orders, AOV, Customers, Units, YoY %
   - Slicers: Year (dropdown), Country, Category

2. **Performance Drivers**
   - Archetype: Analytical Canvas
   - Layout variant: **A. Filter-Rail** — ≥4 filter fields for self-serve
   - Purpose: Explain the pulse via product and price/volume structure
   - Visuals: revenue by category; by product line; top products bar; qty vs sales scatter or dual small charts
   - Fields/measures: Revenue, Units, Price, Product Category/Subcategory/Line
   - Slicers: rail — Year, Country, Category, Product line

3. **Customer & Market**
   - Archetype: Comparative Benchmark
   - Layout variant: **A. Side-by-Side** — country compare + customer ranking
   - Purpose: Who/where concentration and opportunity
   - Visuals: revenue by country; YoY by country; top 15 customers; customer concentration note
   - Fields/measures: Revenue, Customers, Country, Customer name
   - Slicers: Year, Category, searchable Customer

## Design system summary
- Theme: Nordic-Boardroom
- Color semantics: Revenue→teal `#2F5F73`; Orders→slate-teal `#5B8FA3`; copper for secondary breakdowns; good/bad only on deltas
- Typography: Segoe UI / Semibold; callout 32 / title 20 / label 10
- Layout: FHD 1920×1080; margin 32; gutter 24; 12×12 grid
- Accessibility: AA contrast; dual-channel variance; insight alt text; no red/green-only encoding

## Model requirements
- Existing measures: none (greenfield)
- New measures: Revenue, Orders, Units, AOV, Customers, YoY Revenue, YoY Revenue %, MoM Revenue %, Margin % (if `prd_cost` usable)
- New calculated columns: typed OrderDate; CustomerKey normalized; Product category keys from `prd_key` / `PX_CAT_G1V2`
- Relationship/sort requirements: DimDate; DimCustomer; DimProduct; DimGeography; FactSales grain = order line; Risk-free sort on Year/Month

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-design
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: "Nordic Boardroom — cool mist surfaces (#F7FAFC), fjord teal primary (#2F5F73), copper secondary categorical (#C17B3A), Segoe UI, generous whitespace, no drop shadows; semantic green/red only for variance"
    signature: "Composite KPI strip — value + YoY delta with color and ▲/▼ text (never color alone)"
  archetype: Executive
  theme:
    path: _shared/themes/Nordic-Boardroom.json
    name: Nordic-Boardroom
  color_map:
    - measure: Sales[Revenue]
      color: "#2F5F73"
      tint: "#D7E6EC"
    - measure: Sales[Orders]
      color: "#5B8FA3"
      tint: "#E2EEF3"
    - measure: Sales[AOV]
      color: "#3D5A6C"
      tint: "#E8EEF2"
    - measure: Sales[Customers]
      color: "#4A6B5C"
      tint: "#E4EDE8"
    - measure: Sales[Units]
      color: "#7A6A8A"
      tint: "#EDE8F0"
    - measure: Sales[YoY Revenue %]
      color: semantic
      tint: null
  pages:
    - name: "Portfolio Pulse — Revenue and Growth at a Glance"
      role: landing
      archetype: Executive
      layout_variant: B
      variant_rationale: "Five peer C-level KPIs of comparable weight (Revenue, Orders, AOV, Customers, Units) with no single hero metric — KPI-Strip fits."
      page_background: "#F7FAFC"
      layout_summary: "Header + filters; KPI strip; trend left; category mix right."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis:    [1, 2, 13, 5]
            trend:   [1, 5, 8, 13]
            mix:     [8, 5, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Portfolio Pulse — Revenue and Growth at a Glance"
            purpose: "State the landing thesis before charts."
          - id: slicer_year
            region: filters
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 3
          - id: slicer_country
            region: filters
            kind: slicer
            field_bindings: DimGeography[Country]
            slicer_type: dropdown
            slot: 2
            of: 3
          - id: slicer_category
            region: filters
            kind: slicer
            field_bindings: DimProduct[Category]
            slicer_type: dropdown
            slot: 3
            of: 3
          - id: kpi_revenue
            region: kpis
            kind: cardVisual
            purpose: "What is total revenue, and is YoY up or down?"
            field_bindings: { value: Sales[Revenue], reference: Sales[YoY Revenue %] }
            color_strategy: measure_match
            insight_basis: "Composite card — absolute + YoY %"
          - id: kpi_orders
            region: kpis
            kind: cardVisual
            purpose: "How many orders in the selected period vs prior year?"
            field_bindings: { value: Sales[Orders], reference: Sales[YoY Orders %] }
            color_strategy: measure_match
          - id: kpi_aov
            region: kpis
            kind: cardVisual
            purpose: "Is average order value healthy vs prior year?"
            field_bindings: { value: Sales[AOV], reference: Sales[YoY AOV %] }
            color_strategy: measure_match
          - id: kpi_customers
            region: kpis
            kind: cardVisual
            purpose: "How broad is the buying base?"
            field_bindings: { value: Sales[Customers], reference: Sales[YoY Customers %] }
            color_strategy: measure_match
          - id: kpi_units
            region: kpis
            kind: cardVisual
            purpose: "Are unit volumes supporting revenue?"
            field_bindings: { value: Sales[Units], reference: Sales[YoY Units %] }
            color_strategy: measure_match
          - id: trend_revenue_month
            region: trend
            kind: lineChart
            purpose: "How has revenue moved month over month in the selected years?"
            field_bindings: { values: Sales[Revenue], axis: DimDate[YearMonth] }
            color_strategy: measure_match
          - id: mix_category
            region: mix
            kind: barChart
            purpose: "Which product categories contribute most to revenue?"
            field_bindings: { values: Sales[Revenue], axis: DimProduct[Category] }
            color_strategy: gradient
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: trend, pct_of_content: 40 }
          balance_rationale: "Trend is the explanatory hero beside a supporting category mix; KPIs own the scan strip without dominating the canvas."

    - name: "Performance Drivers — Where Growth Comes From"
      role: detail
      archetype: Analytical
      layout_variant: A
      variant_rationale: "Self-serve exploration needs Year, Country, Category, and Product line together — Filter-Rail justified."
      page_background: "#F7FAFC"
      layout_summary: "Left filter rail; category and line charts; top products table/bar."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:     [1, 1, 13, 2]
            filter_rail: [1, 2, 3, 13]
            cat_bar:    [3, 2, 8, 7]
            line_bar:   [8, 2, 13, 7]
            top_prod:   [3, 7, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Performance Drivers — Where Growth Comes From"
            purpose: "Frame the analytical job."
          - id: rail_year
            region: filter_rail
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 4
          - id: rail_country
            region: filter_rail
            kind: slicer
            field_bindings: DimGeography[Country]
            slicer_type: dropdown
            slot: 2
            of: 4
          - id: rail_category
            region: filter_rail
            kind: slicer
            field_bindings: DimProduct[Category]
            slicer_type: dropdown
            slot: 3
            of: 4
          - id: rail_line
            region: filter_rail
            kind: slicer
            field_bindings: DimProduct[ProductLine]
            slicer_type: dropdown
            slot: 4
            of: 4
          - id: revenue_by_category
            region: cat_bar
            kind: barChart
            purpose: "Which categories lead or lag in revenue under current filters?"
            field_bindings: { values: Sales[Revenue], axis: DimProduct[Category] }
            color_strategy: measure_match
          - id: revenue_by_line
            region: line_bar
            kind: barChart
            purpose: "Which product lines drive the selected categories?"
            field_bindings: { values: Sales[Revenue], axis: DimProduct[ProductLine] }
            color_strategy: gradient
          - id: top_products
            region: top_prod
            kind: barChart
            purpose: "Which individual products concentrate revenue (top 15)?"
            field_bindings: { values: Sales[Revenue], axis: DimProduct[ProductName] }
            color_strategy: gradient
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: top_prod, pct_of_content: 42 }
          balance_rationale: "Rail stays narrow; two mid charts answer category vs line; bottom ranking answers SKU concentration."

    - name: "Customer & Market — Concentration and Opportunity"
      role: detail
      archetype: Comparative
      layout_variant: A
      variant_rationale: "Side-by-side country comparison plus customer ranking — two entity sets on one metric family."
      page_background: "#F7FAFC"
      layout_summary: "Header filters; country revenue; country YoY; top customers."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:    [1, 1, 9, 2]
            filters:   [9, 1, 13, 2]
            by_country:[1, 2, 7, 7]
            yoy_country:[7, 2, 13, 7]
            top_cust:  [1, 7, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Customer & Market — Concentration and Opportunity"
            purpose: "Frame comparative market/customer job."
          - id: slicer_year
            region: filters
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 3
          - id: slicer_category
            region: filters
            kind: slicer
            field_bindings: DimProduct[Category]
            slicer_type: dropdown
            slot: 2
            of: 3
          - id: slicer_customer
            region: filters
            kind: slicer
            field_bindings: DimCustomer[CustomerName]
            slicer_type: dropdown
            slot: 3
            of: 3
            notes: "Searchable dropdown — high cardinality"
          - id: revenue_by_country
            region: by_country
            kind: barChart
            purpose: "How does revenue rank across countries?"
            field_bindings: { values: Sales[Revenue], axis: DimGeography[Country] }
            color_strategy: measure_match
          - id: yoy_by_country
            region: yoy_country
            kind: barChart
            purpose: "Which countries are accelerating or decelerating YoY?"
            field_bindings: { values: Sales[YoY Revenue %], axis: DimGeography[Country] }
            color_strategy: semantic
          - id: top_customers
            region: top_cust
            kind: barChart
            purpose: "Which customers concentrate revenue (top 15)?"
            field_bindings: { values: Sales[Revenue], axis: DimCustomer[CustomerName] }
            color_strategy: gradient
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: top_cust, pct_of_content: 42 }
          balance_rationale: "Country pair answers market comparison; full-width customer rank answers concentration risk."
```

## Implementation notes
- Model changes: star schema PBIP from staged CSVs; date typing; key normalize
- PBIR/report authoring: implement this Design Brief only after approval
- Validation: `powerbi-report-author` validate
- Desktop screenshot verification: Desktop Bridge reload + page screenshots
- Publishing boundary: no Fabric until AUTH
- Risks: key mismatch cust_info↔LOC; null product cost; integer dates

---

**Approve this report spec so I can start building?**

1. Approve — start building (semantic model → design already locked → PBIR)
2. Revise audience/purpose
3. Revise scope/page plan
4. Revise design/theme/delivery

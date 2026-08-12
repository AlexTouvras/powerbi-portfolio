# Report Spec — Experience Pulse

**Status:** SHIPPED — Featured  
**Folder:** `08-customer-experience`  
**Report name:** Experience Pulse  
**PBIP:** `ExperiencePulse.pbip`  
**Theme:** Nordic Boardroom (`_shared/themes/Nordic-Boardroom*.json`)  
**Landing atmosphere:** `linen-mist`

---

## Report identity

| Field | Decision |
|-------|----------|
| Audience | **Primary:** CX / VoC lead · **Secondary:** category/seller ops · exec/board |
| Primary purpose | Run a **recovery queue** on low scores; explain **drivers** (late delivery, themes, category); light **pulse** for exec skim |
| Delivery target | Local PBIP only (publish later if requested) |
| Tone | Nordic Boardroom |
| Signature | **Score erosion by delivery outcome** — Avg Review Score falls On-time → Late → Very late (clustered column or waterfall-style ordered bars on Drivers; semantic accents elsewhere) |

---

## User decisions and constraints

| Field | Decision |
|-------|----------|
| Dataset | Olist order reviews × Logistics `FactOrders` (option 1 locked) |
| Scope | Shape **1**: Landing · Experience Pulse · Drivers · Recovery Queue · Context |
| Metric brand | **Avg review score** + **CSAT %** (score ≥ 4). **Proxy NPS** only as labeled secondary / Context caveat |
| Interactivity | Year + state + score-band slicers on analysis pages; searchable seller on Recovery |
| Model edit | New semantic model in this folder; sync dims from `04-supply-chain` gold |
| Accessibility | WCAG AA; alt text on charts; no red-on-red |
| Data caveats | Brazilian marketplace sample 2016–2018; PT→EN machine translation; keyword themes (not ML classifier); not a true 0–10 NPS survey |

### Out of scope (v1)

- True survey NPS instrument / invitation coverage  
- Dedicated Sellers benchmark page (shape 2)  
- Fabric publish  
- Overloading `LogisticsPulse.pbip`

---

## Narrative

| | |
|--|--|
| Core story | Late delivery destroys review scores — CX can see how much, why (themes), and which orders to recover |
| Audience promise | Leave with a ranked recovery list and one clear ops lever (on-time) |
| Key questions | Is experience healthy? What pulls scores down? Which low-score orders/sellers act on first? |

---

## Design identity (from `powerbi-report-design`)

| Element | Choice |
|---------|--------|
| Tone | Nordic Boardroom (mist `#F7FAFC`, teal `#2F5F73`, copper `#C17B3A`) |
| Signature | Score erosion by delivery outcome (On-time / Late / Very late) |
| Chrome | Page navigator pills · footer source line · filter pane collapsed on Landing/Context |
| Risk color | Semantic green/amber/red **only** for on-time / late / detractor bands |

---

## Page plan

1. **Landing** — Portfolio Landing · hero = **Avg Review Score** · page map · `linen-mist`
2. **Experience Pulse** — Executive Summary · KPIs (Avg Score, CSAT %, Proxy NPS labeled, Review coverage) · monthly score trend · score distribution
3. **Drivers** — Analytical Canvas · **signature** erosion bars · theme × severity matrix · category avg score
4. **Recovery Queue** — Operational / queue · ranked low-score reviews (≤2 primary; ≤3 optional filter) with seller, late flag, theme, EN quote snippet
5. **Context** — Facts-only · metric definitions · proxy NPS mapping · translation/theme caveats · Olist attribution

---

## Design system summary

- Theme: Nordic Boardroom base palette  
- Color semantics: teal = volume/neutral · green = on-time / healthy score · amber = mid · red = late / detractor · copper = categorical accent  
- Typography: Segoe UI (portfolio standard)  
- Layout: FHD 1920×1080 · 12×12 grid · margin 32 · gutter 24  
- Accessibility: AA contrast · alt text · dropdown slicers for high-cardinality seller  

---

## Model requirements

### Gold (pipeline already started: `scripts/enrich-reviews.py`)

| Table | Grain | Notes |
|-------|-------|-------|
| `FactReviews` | 1 row / review (joined delivered order) | Score, bands, OnTime/Late/LeadTime, themes, CommentPT/EN |
| `FactReviewTheme` | review × theme | Multi-label bridge |
| `DimTheme` | theme | Sort order |
| `FactThemeQuotes` | theme × band exemplars | Callout quotes |
| Synced | `FactOrders`, `DimDate`, `DimSeller`, `DimProduct` | Copy from `04-supply-chain/data/gold` |

### Binding metric definitions

| Metric | Definition |
|--------|------------|
| Population | Reviews inner-joined to delivered `FactOrders` |
| Avg Review Score | `AVERAGE(ReviewScore)` · 1–5 |
| CSAT % | `%` of reviews with `ReviewScore >= 4` |
| Proxy NPS | `%(score=5) − %(score≤3)` — **label as proxy** |
| ProxyNPSClass | 5→Promoter · 4→Passive · 1–3→Detractor |
| DeliveryOutcome | On-time (`LateFlag=0`) · Late (`LateFlag=1` ∧ LeadTimeDays ≤ 30) · Very late (`LateFlag=1` ∧ LeadTimeDays > 30) |
| Coverage % | Distinct orders with review / delivered orders (from synced FactOrders) |
| Seller rank gate | ≥ 30 reviews for seller aggregates on Drivers |

### Fix before model lock

- Align `ScoreBand` in enrich script with `ProxyNPSClass` (today ScoreBand treats ≥4 as Promoter). Prefer one field: **ProxyNPSClass** authoritative; ScoreBand = severity Low(1–2)/Mid(3)/High(4–5) **or** identical to ProxyNPSClass.
- Persist `DeliveryOutcome` column on `FactReviews` in gold (not only DAX).

### New measures (illustrative)

- Avg Review Score, CSAT %, Proxy NPS, Reviews, Detractor %, On-time Avg Score, Late Avg Score, Score Gap (On-time − Late), Coverage %

---

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-design
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: Nordic Boardroom
    signature: Score erosion by delivery outcome (On-time → Late → Very late) on Drivers; semantic on-time/late/detractor accents elsewhere
  archetype: Portfolio Landing + Executive + Analytical + Operational queue
  color_map:
    - measure: FactReviews[Avg Review Score]
      color: "#2F5F73"
      tint: "#E8EEF2"
    - measure: FactReviews[CSAT %]
      color: "#1B7A4E"
      tint: "#E6F4EC"
    - measure: FactReviews[Proxy NPS]
      color: "#C17B3A"
      tint: "#F5E6D8"
    - measure: FactReviews[Detractor %]
      color: "#B42318"
      tint: "#FCE8E6"
    - measure: FactReviews[Reviews]
      color: "#2F5F73"
      tint: "#E8EEF2"
    - measure: FactReviews[On-time Avg Score]
      color: "#1B7A4E"
      tint: "#E6F4EC"
    - measure: FactReviews[Late Avg Score]
      color: "#B42318"
      tint: "#FCE8E6"
  pages:
    - name: Landing
      role: landing
      archetype: Portfolio Landing
      layout_variant: A
      variant_rationale: Portfolio poster cover required for Nordic Boardroom Orbit open
      page_background: "#F7FAFC"
      layout_summary: linen-mist atmosphere; teal rail; white poster; copper rule; one Avg Review Score hero; numbered page map
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            rail: [1, 1, 1, 13]
            poster: [2, 2, 9, 11]
            hero: [9, 3, 13, 7]
            map: [2, 8, 9, 11]
        placements:
          - id: page_title
            region: poster
            kind: textbox
            text: "Experience Pulse"
            purpose: "Brand the report as the VoC / review-score story."
          - id: thesis
            region: poster
            kind: textbox
            text: "Late delivery destroys review scores — recover detractors with evidence."
            purpose: "One-line thesis for CX and board openers."
          - id: hero_avg_score
            region: hero
            kind: composite_kpi
            field_bindings: FactReviews[Avg Review Score]
            purpose: "One editorial experience number — average 1–5 review score."
            insight_basis: "Mean ReviewScore on reviews joined to delivered orders"
            color_strategy: measure_match
          - id: page_map
            region: map
            kind: textbox
            text: "1 Experience Pulse · 2 Drivers · 3 Recovery Queue · 4 Context"
            purpose: "Numbered beats for analysis pages only."
        space_audit:
          unplaced_regions: []
          empty_space_rationale: "Landing is poster-only; whitespace intentional; no chart regions."
          largest_region: { name: poster, pct_of_content: 55 }
          balance_rationale: "Title+thesis left; single hero right; map under copper rule."

    - name: Experience Pulse
      role: detail
      archetype: Executive Summary
      layout_variant: B
      variant_rationale: KPI strip + trend + distribution for exec skim and CX health check
      page_background: "#F7FAFC"
      layout_summary: Four KPIs; monthly avg-score trend; score 1–5 distribution; year/state filters
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis: [1, 2, 13, 4]
            trend: [1, 4, 8, 11]
            dist: [8, 4, 13, 11]
            footer: [1, 12, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Experience Pulse"
            purpose: "Name the health-scan page."
          - id: slicer_year
            region: filters
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: slicer_state
            region: filters
            kind: slicer
            field_bindings: FactReviews[CustomerState]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: kpi_avg_score
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Avg Review Score]
            purpose: "Primary experience level."
            color_strategy: measure_match
            slot: 1
            of: 4
          - id: kpi_csat
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[CSAT %]
            purpose: "Share of scores ≥ 4."
            color_strategy: measure_match
            slot: 2
            of: 4
          - id: kpi_proxy_nps
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Proxy NPS]
            purpose: "Secondary labeled proxy NPS (5 vs ≤3)."
            color_strategy: measure_match
            slot: 3
            of: 4
          - id: kpi_reviews
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Reviews]
            purpose: "Sample size / volume."
            color_strategy: measure_match
            slot: 4
            of: 4
          - id: trend_score
            region: trend
            kind: lineChart
            field_bindings: { Category: DimDate[YearMonth], Y: FactReviews[Avg Review Score] }
            purpose: "How average score moves over time."
            color_strategy: measure_match
          - id: score_dist
            region: dist
            kind: columnChart
            field_bindings: { Category: FactReviews[ReviewScore], Y: FactReviews[Reviews] }
            purpose: "Distribution of 1–5 scores."
            color_strategy: semantic
            sort_policy: category_asc
        space_audit:
          unplaced_regions: []
          empty_space_rationale: "Footer source line only; content fills analysis band."
          largest_region: { name: trend, pct_of_content: 40 }
          balance_rationale: "KPI band full width; trend dominates left; distribution supports right."

    - name: Drivers
      role: detail
      archetype: Analytical Canvas
      layout_variant: A
      variant_rationale: Signature erosion needs dominant width; theme matrix and category bars as supporting evidence
      page_background: "#F7FAFC"
      layout_summary: Score-erosion signature; theme×band matrix; category avg score; year/band filters
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            signature: [1, 2, 7, 8]
            themes: [7, 2, 13, 8]
            categories: [1, 8, 13, 12]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Drivers"
            purpose: "Name the why-scores-move page."
          - id: slicer_year
            region: filters
            kind: slicer
            field_bindings: DimDate[Year]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: slicer_band
            region: filters
            kind: slicer
            field_bindings: FactReviews[ProxyNPSClass]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: score_erosion
            region: signature
            kind: columnChart
            field_bindings: { Category: FactReviews[DeliveryOutcome], Y: FactReviews[Avg Review Score] }
            purpose: "Signature — how avg score erodes On-time → Late → Very late."
            color_strategy: semantic
            sort_policy: custom_delivery_outcome
          - id: theme_matrix
            region: themes
            kind: matrix
            field_bindings: { Rows: DimTheme[Theme], Columns: FactReviews[ProxyNPSClass], Values: FactReviews[Reviews] }
            purpose: "Which themes concentrate among detractors."
            color_strategy: gradient
          - id: category_scores
            region: categories
            kind: barChart
            field_bindings: { Category: FactReviews[Category], Y: FactReviews[Avg Review Score] }
            purpose: "Which categories drag average score."
            sort_policy: value_asc
            color_strategy: gradient
        space_audit:
          unplaced_regions: []
          empty_space_rationale: "No dead footer band; category bar uses full bottom width."
          largest_region: { name: signature, pct_of_content: 35 }
          balance_rationale: "Signature left; themes right; category strip full-width bottom."

    - name: Recovery Queue
      role: detail
      archetype: Operational Monitor
      layout_variant: C
      variant_rationale: Action queue dominates; supporting late/theme mix without diluting the list
      page_background: "#F7FAFC"
      layout_summary: Ranked low-score table; severity KPIs; searchable seller + score filters
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis: [1, 2, 13, 4]
            queue: [1, 4, 13, 12]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Recovery Queue"
            purpose: "Name the closed-loop action page."
          - id: slicer_score
            region: filters
            kind: slicer
            field_bindings: FactReviews[ReviewScore]
            slicer_type: dropdown
            slot: 1
            of: 3
          - id: slicer_late
            region: filters
            kind: slicer
            field_bindings: FactReviews[LateFlag]
            slicer_type: dropdown
            slot: 2
            of: 3
          - id: slicer_seller
            region: filters
            kind: slicer
            field_bindings: FactReviews[SellerID]
            slicer_type: dropdown
            slot: 3
            of: 3
          - id: kpi_detractors
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Detractor Reviews]
            purpose: "How many recovery candidates in filter."
            color_strategy: measure_match
            slot: 1
            of: 3
          - id: kpi_late_share
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Late Share of Detractors]
            purpose: "How often low scores coincide with late delivery."
            color_strategy: semantic
            slot: 2
            of: 3
          - id: kpi_top_theme
            region: kpis
            kind: cardVisual
            field_bindings: FactReviews[Top Detractor Theme]
            purpose: "Dominant theme among filtered detractors."
            color_strategy: none
            slot: 3
            of: 3
          - id: recovery_table
            region: queue
            kind: tableEx
            field_bindings:
              - FactReviews[ReviewDate]
              - FactReviews[OrderID]
              - FactReviews[SellerID]
              - FactReviews[Category]
              - FactReviews[ReviewScore]
              - FactReviews[LateFlag]
              - FactReviews[LeadTimeDays]
              - FactReviews[ThemePrimary]
              - FactReviews[CommentEN]
            purpose: "Ranked low-score orders to recover — default filter ReviewScore ≤ 2."
            sort_policy: score_asc_then_late_desc
        space_audit:
          unplaced_regions: []
          empty_space_rationale: "Queue consumes remaining canvas; no decorative side panel."
          largest_region: { name: queue, pct_of_content: 65 }
          balance_rationale: "Thin KPI strip then dominant action table — ops cadence."

    - name: Context
      role: detail
      archetype: Narrative Story
      layout_variant: B
      variant_rationale: Facts-only documentation page; no exploration charts
      page_background: "#F7FAFC"
      layout_summary: Metric definitions; proxy NPS mapping; translation/theme caveats; Olist license line
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1, 1, 13, 2]
            metrics: [1, 2, 7, 8]
            caveats: [7, 2, 13, 8]
            attribution: [1, 8, 13, 12]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Context"
            purpose: "Name the reference page."
          - id: metric_defs
            region: metrics
            kind: textbox
            text: "Avg Review Score · CSAT % (≥4) · Proxy NPS (5 minus ≤3) · DeliveryOutcome bands · Coverage"
            purpose: "Binding metric definitions for readers."
          - id: caveats_box
            region: caveats
            kind: textbox
            text: "Not a 0–10 NPS survey. Comments PT→EN via Argos. Themes are keyword rules. Brazilian Olist sample 2016–2018."
            purpose: "Honesty / sample caveats."
          - id: attribution
            region: attribution
            kind: textbox
            text: "Source: Olist Brazilian E-Commerce (Kaggle) · ops grain from Logistics Pulse FactOrders · CC BY-NC-SA 4.0"
            purpose: "Attribution and license."
        space_audit:
          unplaced_regions: []
          empty_space_rationale: "Documentary whitespace OK; no forced charts."
          largest_region: { name: metrics, pct_of_content: 35 }
          balance_rationale: "Two prose columns + attribution footer band."

  interaction_pattern:
    drill_targets: []
    cross_filter_rules: "Default Filter; Landing/Context no slicers"
  accessibility:
    alt_text_strategy: headline+trend for Pulse; comparison framing for Drivers erosion; queue structure for Recovery
    contrast_notes: Semantic red/green only on status; copper never for status
  theme:
    base: Nordic Boardroom from _shared/themes
    user_overrides: Preserve textbox/card zero-padding safeguards from portfolio base
```

---

## Implementation notes

| Step | Plan |
|------|------|
| Gold | Finish/resume `enrich-reviews.py` (PT→EN cache) · add `DeliveryOutcome` · fix ScoreBand · sync Logistics dims |
| Model | Scaffold `ExperiencePulse.SemanticModel` TMDL · measures above |
| Report | Scaffold PBIP · elevate Landing + 4 pages · register `linen-mist` atmosphere |
| Validate | `powerbi-report-author validate` · Desktop reload · screenshots |
| Publish | Not in v1 |
| Risks | Translation runtime long on first run · Portuguese residual in cache misses · seller cardinality needs search slicer |

---

## Approval

**Approved and shipped** — Featured local PBIP (2026-07-27). Fabric publish out of v1. 

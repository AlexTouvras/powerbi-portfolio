# Power BI portfolio pipeline

How reports move from local PBIP work to the Orbit Portfolio showcase.

```mermaid
flowchart LR
  Gold[Gold / star schemas] --> Model[Semantic model PBIP]
  Model --> Pages[Report pages PBIR]
  Pages --> Shots[Bridge snapshots]
  Shots --> Canvas[Canvas crop]
  Canvas --> Repo[screenshots/ in the report]
  Repo --> Sync[npm run powerbi:sync]
  Sync --> Orbit[Orbit Portfolio Power BI]
  Sync --> Meta[power-bi-reports.ts]
```

The last local step, once a report is finished, is `capture_showcase.py`. The Desktop Bridge snapshot is the report surface: it does not include the ribbon, the visualizations pane, the data pane, or the page tabs. The crop then drops the Filters pane and any fit-to-page margin, and writes a canvas PNG per page under that report's `screenshots/`.

# Nordic Boardroom stack

Shared design system and build path across featured Nordic Boardroom reports.

```mermaid
flowchart TB
  Shared[_shared theme and patterns] --> Churn[02 ecommerce churn]
  Shared --> Sales[03 sales executive]
  Shared --> Bank[05 bank segmentation]
  Shared --> Care[06 healthcare]
  Shared --> Credit[11 credit risk]
  Churn --> Export[Page screenshots]
  Sales --> Export
  Bank --> Export
  Care --> Export
  Credit --> Export
  Export --> GH[GitHub powerbi-portfolio]
  GH --> OrbitSync[Orbit sync Action]
```

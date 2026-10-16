# Analyst

One scorer for the whole portfolio. It runs before Power BI, on a gold CSV, and writes another gold CSV. A report does not carry its own copy of the math. It calls this entry point with its columns.

```powershell
py -3 _shared/analyst/brain.py network `
  --edges 04-supply-chain/data/gold/FactCorridor.csv `
  --source SellerState `
  --target CustomerState `
  --weight Late=Orders*LateRate `
  --weight Order=Orders `
  --node-column State `
  --label-map 04-supply-chain/data/ref/br-state-names.csv `
  --output 04-supply-chain/data/gold/DimLaneNetwork.csv
```

`--weight` may be repeated. `Name=Column` uses that column. `Name=Column*Column` multiplies them. A positive product keeps the directed edge. Self-loops are dropped. Betweenness counts paths. The weight does not become a distance.

Install once, from the repo root:

```powershell
py -3 -m pip install -r _shared/analyst/requirements.txt
```

Logistics Pulse calls the same command at the end of `build-gold.py`. Another report with an edge table uses the same command and its own paths.

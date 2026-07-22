import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import type { Stock } from "./types";

export type TileNode = {
  kind: "sector" | "stock";
  name: string;
  stock?: Stock;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type HierDatum = {
  name: string;
  stock?: Stock;
  children?: HierDatum[];
  value?: number;
};

export function layoutBoard(
  stocks: Stock[],
  width: number,
  height: number
): TileNode[] {
  const bySector = new Map<string, Stock[]>();
  for (const s of stocks) {
    const list = bySector.get(s.sector) ?? [];
    list.push(s);
    bySector.set(s.sector, list);
  }

  const data: HierDatum = {
    name: "root",
    children: [...bySector.entries()]
      .sort((a, b) => {
        const sa = a[1].reduce((n, x) => n + x.marketCapEURm, 0);
        const sb = b[1].reduce((n, x) => n + x.marketCapEURm, 0);
        return sb - sa;
      })
      .map(([sector, list]) => ({
        name: sector,
        children: list
          .slice()
          .sort((a, b) => b.marketCapEURm - a.marketCapEURm)
          .map((stock) => ({
            name: stock.ticker,
            stock,
            value: Math.max(stock.marketCapEURm, 1),
          })),
      })),
  };

  const root = hierarchy(data)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap<HierDatum>()
    .tile(treemapSquarify.ratio(1.1))
    .size([width, height])
    .paddingOuter(3)
    .paddingInner(2)
    .paddingTop((d) => (d.depth === 1 ? 22 : 2))(root);

  const nodes: TileNode[] = [];
  root.each((node) => {
    const n = node as HierarchyRectangularNode<HierDatum>;
    if (n.depth === 1) {
      nodes.push({
        kind: "sector",
        name: n.data.name,
        x0: n.x0,
        y0: n.y0,
        x1: n.x1,
        y1: n.y1,
      });
    } else if (n.depth === 2 && n.data.stock) {
      nodes.push({
        kind: "stock",
        name: n.data.name,
        stock: n.data.stock,
        x0: n.x0,
        y0: n.y0,
        x1: n.x1,
        y1: n.y1,
      });
    }
  });
  return nodes;
}

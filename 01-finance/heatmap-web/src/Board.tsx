import { useEffect, useMemo, useState } from "react";
import { changeColor, formatChange } from "./colors";
import { layoutBoard } from "./layout";
import type { Stock } from "./types";

type Props = {
  stocks: Stock[];
  selectedSector: string | null;
  onSelectSector: (sector: string | null) => void;
};

function Logo({ stock, size }: { stock: Stock; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!stock.logoUrl || failed) {
    return (
      <span className="logo-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {stock.ticker.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      className="logo"
      src={stock.logoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Board({ stocks, selectedSector, onSelectSector }: Props) {
  const [size, setSize] = useState({ w: 1200, h: 720 });

  useEffect(() => {
    const el = document.getElementById("board-host");
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 40 && height > 40) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo(
    () => layoutBoard(stocks, size.w, size.h),
    [stocks, size.w, size.h]
  );

  const drilled = Boolean(selectedSector);

  return (
    <div id="board-host" className="board-host">
      <svg
        className="board-svg"
        viewBox={`0 0 ${size.w} ${size.h}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={
          drilled
            ? `Nordic equity heatmap — ${selectedSector} only`
            : "Nordic equity heatmap by sector and market cap"
        }
      >
        {nodes.map((n) => {
          if (n.kind === "sector") {
            const w = n.x1 - n.x0;
            const h = n.y1 - n.y0;
            if (w < 8 || h < 8) return null;
            const canDrill = !drilled;
            return (
              <g
                key={`s-${n.name}`}
                className={canDrill ? "sector sector-clickable" : "sector"}
                onClick={
                  canDrill
                    ? (e) => {
                        e.stopPropagation();
                        onSelectSector(n.name);
                      }
                    : undefined
                }
                style={canDrill ? { cursor: "pointer" } : undefined}
              >
                <title>
                  {canDrill
                    ? `Open ${n.name} (show tickers in this sector only)`
                    : n.name}
                </title>
                <rect
                  x={n.x0}
                  y={n.y0}
                  width={w}
                  height={h}
                  className="sector-frame"
                  rx={4}
                />
                {/* Hit target for sector header bar (TradingView-style “Sector ›”) */}
                <rect
                  x={n.x0}
                  y={n.y0}
                  width={w}
                  height={Math.min(22, h)}
                  className="sector-hit"
                  rx={4}
                />
                <text x={n.x0 + 8} y={n.y0 + 15} className="sector-label">
                  {canDrill ? `${n.name.toUpperCase()} ›` : n.name.toUpperCase()}
                </text>
              </g>
            );
          }

          const s = n.stock!;
          const w = n.x1 - n.x0;
          const h = n.y1 - n.y0;
          if (w < 6 || h < 6) return null;
          const fill = changeColor(s.changePct);
          const showLogo = w >= 52 && h >= 48;
          const showPct = w >= 44 && h >= 36;
          const logoSize = Math.min(28, Math.floor(Math.min(w, h) * 0.28));
          const fontTicker = Math.max(9, Math.min(15, w / 7));
          const fontPct = Math.max(9, Math.min(14, w / 8));

          return (
            <g key={s.ticker} className="tile">
              <title>{`${s.name} (${s.ticker}) · ${formatChange(s.changePct)} · €${Math.round(s.marketCapEURm)}m · ${s.sector}`}</title>
              <rect
                x={n.x0}
                y={n.y0}
                width={w}
                height={h}
                fill={fill}
                rx={3}
                className="tile-rect"
              />
              <foreignObject x={n.x0} y={n.y0} width={w} height={h}>
                <div className="tile-inner" style={{ width: w, height: h }}>
                  {showLogo && <Logo stock={s} size={logoSize} />}
                  <span className="tile-ticker" style={{ fontSize: fontTicker }}>
                    {s.ticker}
                  </span>
                  {showPct && (
                    <span className="tile-pct" style={{ fontSize: fontPct }}>
                      {formatChange(s.changePct)}
                    </span>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

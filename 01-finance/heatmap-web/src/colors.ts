/** Day-change % → TradingView-style red / slate / green. */
export function changeColor(changePct: number | null): string {
  if (changePct == null || Number.isNaN(changePct)) return "#3D4A55";
  const t = Math.max(-1, Math.min(1, changePct / 4));
  if (t >= 0) {
    return lerpHex("#455A64", "#00C853", t);
  }
  return lerpHex("#455A64", "#FF1744", -t);
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function formatChange(changePct: number | null): string {
  if (changePct == null || Number.isNaN(changePct)) return "—";
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

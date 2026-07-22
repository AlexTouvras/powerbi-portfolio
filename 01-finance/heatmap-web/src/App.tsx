import { useEffect, useMemo, useState } from "react";
import { Board } from "./Board";
import type { Board as BoardData } from "./types";
import "./App.css";

export default function App() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  useEffect(() => {
    fetch("/board.json")
      .then((r) => {
        if (!r.ok) throw new Error(`board.json ${r.status}`);
        return r.json();
      })
      .then(setBoard)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const visible = useMemo(() => {
    if (!board) return [];
    if (!selectedSector) return board.stocks;
    return board.stocks.filter((s) => s.sector === selectedSector);
  }, [board, selectedSector]);

  const sectors = useMemo(() => {
    if (!board) return [];
    const counts = new Map<string, number>();
    for (const s of board.stocks) {
      counts.set(s.sector, (counts.get(s.sector) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [board]);

  const adv = visible.filter((s) => (s.changePct ?? 0) > 0).length;
  const dec = visible.filter((s) => (s.changePct ?? 0) < 0).length;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand-block">
          <p className="eyebrow">Nordic Equity · Live board</p>
          <h1>Sector heatmap</h1>
          <p className="lede">
            Size = market cap · Color = day change % · Click a sector header (›) to zoom in · All to reset
          </p>
        </div>
        <div className="meta">
          {board && (
            <>
              <div className="pill">
                <span className="pill-k">As of</span>
                <span className="pill-v">{board.asOf}</span>
              </div>
              <div className="pill">
                <span className="pill-k">Showing</span>
                <span className="pill-v">
                  {visible.length}/{board.count}
                </span>
              </div>
              <div className="pill up">
                <span className="pill-k">Adv</span>
                <span className="pill-v">{adv}</span>
              </div>
              <div className="pill down">
                <span className="pill-k">Dec</span>
                <span className="pill-v">{dec}</span>
              </div>
            </>
          )}
        </div>
      </header>

      {board && (
        <nav className="crumb" aria-label="Heatmap scope">
          <button
            type="button"
            className={selectedSector ? "crumb-btn" : "crumb-btn active"}
            onClick={() => setSelectedSector(null)}
          >
            All
          </button>
          {selectedSector && (
            <>
              <span className="crumb-sep" aria-hidden>
                ›
              </span>
              <span className="crumb-current">{selectedSector}</span>
            </>
          )}
          <div className="sector-chips" role="list">
            {sectors.map(({ name, count }) => (
              <button
                key={name}
                type="button"
                role="listitem"
                className={
                  selectedSector === name ? "chip active" : "chip"
                }
                onClick={() =>
                  setSelectedSector((cur) => (cur === name ? null : name))
                }
              >
                {name}
                <span className="chip-n">{count}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="stage">
        {error && <p className="error">Could not load board: {error}</p>}
        {!board && !error && <p className="loading">Loading board…</p>}
        {board && (
          <Board
            stocks={visible}
            selectedSector={selectedSector}
            onSelectSector={setSelectedSector}
          />
        )}
      </main>

      <footer className="foot">
        Yahoo Finance delayed quotes · Equal snapshot from PBIP gold · Not investment advice
      </footer>
    </div>
  );
}

import React from "react";
import { FINGERS } from "./engine.js";

/* Per-finger accuracy for one test. Each bar is hits on that finger's keys; the number shows misses. */
export function FingerBars({ fingers }) {
  const rows = fingers.map((f, i) => ({
    label: FINGERS[i],
    n: f.n,
    pct: f.n ? Math.round((100 * (f.n - f.err)) / f.n) : null,
    err: f.err,
  }));
  return (
    <div style={{ display: "grid", gap: 7 }} role="table" aria-label="Accuracy per finger">
      {rows.map((r) => (
        <div key={r.label} role="row" style={{ display: "grid", gridTemplateColumns: "92px 1fr 150px", alignItems: "center", gap: 10, fontSize: 13 }}>
          <span role="cell" style={{ color: "var(--mid)" }}>{r.label}</span>
          <div role="cell" style={{ background: "var(--bg)", borderRadius: 4, height: 10, overflow: "hidden" }}>
            {r.pct !== null && (
              <div style={{ width: `${r.pct}%`, height: "100%", background: "var(--s1)", borderRadius: 4 }} />
            )}
          </div>
          <span role="cell" className="mono" style={{ color: "var(--mid)", textAlign: "right" }}>
            {r.n === 0 ? "no keys" : (
              <>
                <b style={{ color: "var(--fg)" }}>{r.pct}%</b> · {r.n} keys · <span style={{ color: r.err ? "var(--err)" : "var(--mid)" }}>{r.err} missed</span>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Letter pairs (bigrams) that were slowest or missed most in this test. */
export function PairList({ pairs }) {
  if (!pairs.length) {
    return <p style={{ color: "var(--mid)", fontSize: 13.5, margin: 0 }}>Not enough letter pairs in this test to rank. Type a little longer.</p>;
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {pairs.map((p) => (
        <span key={p.b} className="mono" style={{ border: "1px solid var(--dim)", borderRadius: 8, padding: "6px 10px", fontSize: 13.5, color: "var(--mid)" }}>
          <b style={{ color: "var(--fg)", fontSize: 15 }}>{p.b === " " ? "␣" : p.b}</b>{" "}
          {p.err > 0 ? <span style={{ color: "var(--err)" }}>{p.err} missed</span> : null}
          {p.err > 0 && p.ms ? " · " : null}
          {p.ms ? `${p.ms} ms avg` : null}
        </span>
      ))}
    </div>
  );
}

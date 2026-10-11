import React, { useRef, useState } from "react";

/* ───────────── settings & history storage (all in the visitor's browser) ───────────── */

const KEY_CFG = "ttw:cfg";
const KEY_HIST = "ttw:history";
const MAX_HIST = 300;

export const AMOUNTS = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] };
export const THEMES = ["night", "paper", "violet"];
export const DEF = { mode: "time", amount: 30, punct: false, nums: false, bs: "word", theme: "night" };

export function loadCfg() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_CFG) || "null") || {};
    const mode = s.mode === "words" ? "words" : "time";
    // "fast"/"classic" were the first names for "word"/"letter"
    const bs = s.bs === "letter" || s.bs === "classic" ? "letter" : "word";
    return {
      mode,
      amount: AMOUNTS[mode].includes(s.amount) ? s.amount : AMOUNTS[mode][1],
      punct: !!s.punct,
      nums: !!s.nums,
      bs,
      theme: THEMES.includes(s.theme) ? s.theme : DEF.theme,
    };
  } catch (e) {
    return { ...DEF };
  }
}
export function saveCfg(c) {
  try { localStorage.setItem(KEY_CFG, JSON.stringify(c)); } catch (e) { /* private mode */ }
}
export function loadHist() {
  try {
    const h = JSON.parse(localStorage.getItem(KEY_HIST) || "[]");
    return Array.isArray(h) ? h.filter((r) => r && typeof r.wpm === "number" && typeof r.t === "number") : [];
  } catch (e) {
    return [];
  }
}
export function saveHist(h) {
  try { localStorage.setItem(KEY_HIST, JSON.stringify(h.slice(-MAX_HIST))); } catch (e) { /* private mode */ }
}
export function clearHist() {
  try { localStorage.removeItem(KEY_HIST); } catch (e) { /* private mode */ }
}

export const sameSetting = (a, b) =>
  a.mode === b.mode && a.amount === b.amount && !!a.punct === !!b.punct && !!a.nums === !!b.nums;
export const settingLabel = (r) =>
  (r.mode === "time" ? `time ${r.amount}s` : `words ${r.amount}`) + (r.punct ? ", punctuation" : "") + (r.nums ? ", numbers" : "");

/* ───────────── small helpers ───────────── */

const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 3, 5, 10].map((m) => m * p).find((m) => m >= v * 1.05) || v * 1.1;
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const fmtDate = (t) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtTime = (s) => (s < 90 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`);

/* One tooltip per chart. Content is rendered as React text (never as HTML). */
function useTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (cx, cy, lines, head) => {
    const r = ref.current.getBoundingClientRect();
    setTip({ x: cx - r.left, y: cy - r.top, w: r.width, lines, head });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      className="tip"
      style={{
        left: tip.x,
        top: tip.y,
        transform: tip.x > tip.w * 0.6 ? "translate(calc(-100% - 12px),-110%)" : "translate(12px,-110%)",
      }}
    >
      {tip.head && <div style={{ color: "var(--mid)", fontSize: 11.5, marginBottom: 3 }}>{tip.head}</div>}
      {tip.lines.map((l, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {l.color && <span style={{ width: 10, height: 2, background: l.color, display: "inline-block" }} />}
          <b className="mono" style={{ fontSize: 14 }}>{l.value}</b>
          <span style={{ color: "var(--mid)", fontSize: 12 }}>{l.label}</span>
        </div>
      ))}
    </div>
  );
  return { ref, show, hide, node };
}

function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--mid)", marginBottom: 10 }}>
      {items.map((i) => (
        <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: i.color, display: "inline-block" }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function DataTable({ cap, head, rows }) {
  return (
    <div style={{ overflow: "auto", maxHeight: 240, marginTop: 12 }}>
      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <caption style={{ textAlign: "left", color: "var(--mid)", fontFamily: "Manrope,system-ui,sans-serif", fontSize: 12, paddingBottom: 6 }}>
          {cap}
        </caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", color: "var(--mid)", fontWeight: 400, padding: "4px 14px 4px 0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "4px 14px 4px 0", borderTop: "1px solid var(--grid)" }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── line chart: crosshair + one tooltip, direct label on the last point ───────────── */

function LineChart({ data, yMin = 0, yMax, unit = "", h = 150, errs = false, all = false, label, color = "var(--s1)" }) {
  const { ref, show, hide, node } = useTip();
  const sv = useRef(null);
  const [hv, setHv] = useState(-1);
  const n = data.length;
  if (!n) return null;
  const W = 640, L = 38, R = 22, T = 20, B = 24;
  const pw = W - L - R, ph = h - T - B;
  const top = yMax ?? niceMax(Math.max(...data.map((d) => d.y)));
  const X = (i) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const Y = (v) => T + ph - ((v - yMin) / (top - yMin || 1)) * ph;
  const P = data.map((d, i) => [X(i), Y(d.y)]);
  const ticks = [...new Set([0, 1, 2, 3].map((k) => Math.round(yMin + ((top - yMin) * k) / 3)))];
  const line = P.map((p) => p.join(",")).join(" ");
  const last = P[n - 1];

  const move = (e) => {
    const r = sv.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((x - L) / pw) * (n - 1))));
    setHv(i);
    show(r.left + (X(i) / W) * r.width, e.clientY, data[i].lines, data[i].head || data[i].x);
  };
  const leave = () => { setHv(-1); hide(); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg ref={sv} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--mid)" className="mono">{t}</text>
          </g>
        ))}
        {n > 1 && <polygon points={`${P[0][0]},${T + ph} ${line} ${last[0]},${T + ph}`} fill={color} opacity=".1" />}
        {n > 1 && <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => {
          const bad = errs && d.e > 0 && i !== n - 1;
          if (!(all || i === n - 1 || bad)) return null;
          return (
            <circle key={i} cx={P[i][0]} cy={P[i][1]} r={bad ? 4 + Math.min(2, d.e - 1) : 5}
              fill={bad ? "var(--err)" : color} stroke="var(--panel)" strokeWidth="2" />
          );
        })}
        {hv >= 0 && (
          <g>
            <line x1={P[hv][0]} x2={P[hv][0]} y1={T} y2={T + ph} stroke="var(--mid)" strokeWidth="1" />
            <circle cx={P[hv][0]} cy={P[hv][1]} r="5" fill={color} stroke="var(--panel)" strokeWidth="2" />
          </g>
        )}
        <text x={last[0]} y={Math.max(12, last[1] - 10)} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--fg)" className="mono">
          {data[n - 1].y}{unit}
        </text>
        <text x={L} y={h - 6} fontSize="11" fill="var(--mid)">{data[0].x}</text>
        {n > 1 && <text x={W - R} y={h - 6} textAnchor="end" fontSize="11" fill="var(--mid)">{data[n - 1].x}</text>}
        <rect x={L} y={T - 6} width={pw} height={ph + 12} fill="transparent" onPointerMove={move} onPointerLeave={leave} />
      </svg>
      {node}
    </div>
  );
}

/* chart 1: speed during the test just finished */
export function SecondChart({ series, errs }) {
  const data = series.map((v, i) => ({
    y: v,
    e: errs[i],
    x: `${i + 1}s`,
    head: `second ${i + 1}`,
    lines: [
      { value: v, label: "wpm", color: "var(--s1)" },
      ...(errs[i] ? [{ value: errs[i], label: errs[i] === 1 ? "mistake" : "mistakes" }] : []),
    ],
  }));
  return <LineChart data={data} errs label="Speed per second of this test, in words per minute" />;
}

/* ───────────── chart 2: progress over many tests (one chart per measure, never a dual axis) ───────────── */

export function ProgressPanel({ history, cfg, scope, setScope, showTable }) {
  const all = scope === "all";
  const pool = all ? history : history.filter((r) => sameSetting(r, cfg));
  const recs = pool.slice(-30);
  const n = pool.length;
  const offset = n - recs.length;

  const chips = (
    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 12 }}>
      <button className={"b" + (!all ? " on" : "")} aria-pressed={!all} onClick={() => setScope("setting")}>{settingLabel(cfg)}</button>
      <button className={"b" + (all ? " on" : "")} aria-pressed={all} onClick={() => setScope("all")}>all tests</button>
    </div>
  );

  if (n < 2) {
    return (
      <div>
        {chips}
        <p style={{ color: "var(--mid)", fontSize: 14, margin: "8px 0" }}>
          {n === 0
            ? "No saved tests yet for this view. Finish a few tests and your progress will appear here."
            : "One test saved so far. Finish another to see how you are improving."}
        </p>
      </div>
    );
  }

  const wpmData = recs.map((r, i) => ({
    y: r.wpm, x: `#${offset + i + 1}`, head: fmtDate(r.t) + (all ? ` · ${settingLabel(r)}` : ""),
    lines: [{ value: r.wpm, label: "wpm", color: "var(--s1)" }, { value: `${r.acc}%`, label: "accuracy" }],
  }));
  const accData = recs.map((r, i) => ({
    y: r.acc, x: `#${offset + i + 1}`, head: fmtDate(r.t) + (all ? ` · ${settingLabel(r)}` : ""),
    lines: [{ value: `${r.acc}%`, label: "accuracy", color: "var(--s1)" }, { value: r.wpm, label: "wpm" }],
  }));
  const accMin = Math.max(0, Math.floor((Math.min(...recs.map((r) => r.acc)) - 5) / 5) * 5);
  const best = Math.max(...pool.map((r) => r.wpm));
  const avg = Math.round(mean(pool.map((r) => r.wpm)));
  const delta = pool[n - 1].wpm - pool[0].wpm;

  return (
    <div>
      {chips}
      <p style={{ color: "var(--mid)", fontSize: 13.5, margin: "0 0 12px" }}>
        {n} tests · best {best} wpm · average {avg} wpm ·{" "}
        {delta === 0 ? "same as your first test" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} wpm since your first test`}
        {offset > 0 && ` · chart shows the latest ${recs.length}`}
      </p>
      <div style={{ fontSize: 12.5, color: "var(--mid)", marginBottom: 4 }}>speed per test (wpm)</div>
      <LineChart data={wpmData} all h={150} label={`Speed per test, ${recs.length} tests, from ${recs[0].wpm} to ${recs[recs.length - 1].wpm} words per minute`} />
      <div style={{ fontSize: 12.5, color: "var(--mid)", margin: "14px 0 4px" }}>accuracy per test (%)</div>
      <LineChart data={accData} all yMin={accMin} yMax={100} unit="%" h={130} label={`Accuracy per test, ${recs.length} tests, from ${recs[0].acc} to ${recs[recs.length - 1].acc} percent`} />
      {showTable && (
        <DataTable
          cap="Saved tests, oldest first"
          head={["#", "when", ...(all ? ["setting"] : []), "wpm", "accuracy", "raw", "consistency"]}
          rows={recs.map((r, i) => [offset + i + 1, fmtDate(r.t), ...(all ? [settingLabel(r)] : []), r.wpm, `${r.acc}%`, r.raw, `${r.cons}%`])}
        />
      )}
    </div>
  );
}

/* ───────────── chart 3: this test against your own average and best ───────────── */

function MiniBars({ title, unit, max, items }) {
  const { ref, show, hide, node } = useTip();
  const [hv, setHv] = useState(-1);
  const W = 150, H = 140, T = 22, B = 24, base = H - B, ph = base - T, slot = W / items.length, bw = 24;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ fontSize: 12.5, color: "var(--mid)", marginBottom: 2 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${title}: ` + items.map((i) => `${i.label} ${i.v}${unit}`).join(", ")}
        style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--grid)" strokeWidth="1" />
        {items.map((it, i) => {
          const hgt = Math.max(0, (it.v / max) * ph), x = slot * i + (slot - bw) / 2, y = base - hgt, r = Math.min(4, hgt / 2);
          const d = `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`;
          return (
            <g key={it.k}>
              <path d={d} fill={it.color} style={{ filter: hv === i ? "brightness(1.15)" : "none" }} />
              <text x={x + bw / 2} y={Math.max(12, y - 6)} textAnchor="middle" fontSize="11.5" fill="var(--fg)" className="mono">{it.v}{unit}</text>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--mid)">{it.short}</text>
              <rect x={slot * i} y={0} width={slot} height={H} fill="transparent"
                onPointerMove={(e) => { setHv(i); show(e.clientX, e.clientY, [{ value: `${it.v}${unit}`, label: it.label, color: it.color }], title); }}
                onPointerLeave={() => { setHv(-1); hide(); }} />
            </g>
          );
        })}
      </svg>
      {node}
    </div>
  );
}

export function ComparePanel({ history, result, showTable }) {
  const cur = result.rec;
  const prior = history.filter((r) => r.t !== cur.t && sameSetting(r, cur));
  if (!prior.length) {
    return (
      <p style={{ color: "var(--mid)", fontSize: 14, margin: "8px 0" }}>
        No earlier tests with these settings yet ({settingLabel(cur)}). Finish another one and you can compare it here with your average and your previous best.
      </p>
    );
  }
  const series = [
    { k: "this", short: "this", label: "This test", color: "var(--s1)" },
    { k: "avg", short: "avg", label: `Average of ${prior.length} earlier`, color: "var(--s2)" },
    { k: "best", short: "best", label: "Previous best", color: "var(--s3)" },
  ];
  const metrics = [
    { key: "wpm", title: "speed (wpm)", unit: "" },
    { key: "raw", title: "raw speed (wpm)", unit: "" },
    { key: "acc", title: "accuracy (%)", unit: "%" },
    { key: "cons", title: "consistency (%)", unit: "%" },
  ];
  const vals = (m) => [cur[m], Math.round(mean(prior.map((r) => r[m]))), Math.max(...prior.map((r) => r[m]))];

  return (
    <div>
      <p style={{ color: "var(--mid)", fontSize: 13.5, margin: "0 0 10px" }}>
        Compared with your {prior.length} earlier {prior.length === 1 ? "test" : "tests"} on {settingLabel(cur)}.
      </p>
      <Legend items={series} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        {metrics.map((m) => {
          const v = vals(m.key);
          return (
            <MiniBars key={m.key} title={m.title} unit={m.unit}
              max={m.unit === "%" ? 100 : niceMax(Math.max(...v))}
              items={series.map((s, i) => ({ ...s, v: v[i] }))} />
          );
        })}
      </div>
      {showTable && (
        <DataTable cap="This test against your earlier tests" head={["measure", "this test", "average", "previous best"]}
          rows={metrics.map((m) => [m.title, ...vals(m.key).map((x) => `${x}${m.unit}`)])} />
      )}
    </div>
  );
}

/* ───────────── history page ───────────── */

export function HistoryView({ history, cfg, scope, setScope, showTable, setShowTable, onClear, onBack }) {
  const [confirm, setConfirm] = useState(false);
  const pool = scope === "all" ? history : history.filter((r) => sameSetting(r, cfg));
  const recent = pool.slice(-10).reverse();
  const tiles = [
    ["tests", pool.length],
    ["best wpm", pool.length ? Math.max(...pool.map((r) => r.wpm)) : "–"],
    ["average wpm", pool.length ? Math.round(mean(pool.map((r) => r.wpm))) : "–"],
    ["time typed", pool.length ? fmtTime(pool.reduce((s, r) => s + (r.el || 0), 0)) : "–"],
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 18 }}>Your history</div>
        <button className="b on" onClick={onBack}>back to test · esc</button>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {tiles.map(([l, v]) => (
          <div key={l} className="card" style={{ minWidth: 120 }}>
            <div style={{ fontSize: 12, color: "var(--mid)" }}>{l}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button className={"b" + (showTable ? " on" : "")} aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>table</button>
        </div>
        <ProgressPanel history={history} cfg={cfg} scope={scope} setScope={setScope} showTable={showTable} />
      </div>
      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <DataTable cap="Latest tests, newest first" head={["when", "setting", "wpm", "accuracy", "raw", "consistency"]}
            rows={recent.map((r) => [fmtDate(r.t), settingLabel(r), r.wpm, `${r.acc}%`, r.raw, `${r.cons}%`])} />
        </div>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: 22, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!confirm ? (
            <button className="b" onClick={() => setConfirm(true)}>clear history</button>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "var(--mid)" }}>Delete all {history.length} saved tests on this device?</span>
              <button className="b on" onClick={() => { onClear(); setConfirm(false); }}>yes, delete</button>
              <button className="b" onClick={() => setConfirm(false)}>cancel</button>
            </>
          )}
        </div>
      )}
      <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--dim)" }}>
        History is stored only in this browser. It is not uploaded anywhere and is lost if you clear your site data.
      </p>
    </div>
  );
}

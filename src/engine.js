// Pure typing logic: text generation, scoring, keystroke analysis and practice selection.
// No React and no browser APIs, so it can be unit-tested with `npm test`.
import { WB } from "./words.js";
import { CODE_TOKENS } from "./code.js";

export const MAX_TEXT_WORDS = 400;
const MAX_GAP_MS = 2000; // gaps longer than this are pauses, not typing speed

export const rnd = (a) => a[Math.floor(Math.random() * a.length)];

/* ───────────── text generation ───────────── */

// Random English words, with optional numbers and punctuation (time and words modes).
export function gen(n, o) {
  const out = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let w;
    if (o.nums && Math.random() < 0.12) w = String(Math.floor(Math.random() * (Math.random() < 0.5 ? 100 : 10000)));
    else {
      do w = rnd(WB); while (w === last);
    }
    last = w;
    if (o.punct && !/^\d/.test(w)) {
      if (Math.random() < 0.15) w = w[0].toUpperCase() + w.slice(1);
      const r = Math.random();
      if (r < 0.1) w += ",";
      else if (r < 0.16) w += ".";
      else if (r < 0.18) w += "?";
    }
    out.push(w);
  }
  return out;
}

// Code tokens for one language, no immediate repeats.
export function codeWords(n, lang) {
  const pool = CODE_TOKENS[lang] || CODE_TOKENS.python;
  const out = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let w;
    do w = rnd(pool); while (w === last && pool.length > 1);
    last = w;
    out.push(w);
  }
  return out;
}

// Custom text: split on whitespace, capped so very long pastes stay fast.
export function textWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).slice(0, MAX_TEXT_WORDS);
}

/* ───────────── scoring ───────────── */

// `log` is one entry per counted keystroke: { t: ms since start, ok: boolean, a: expected char, b: expected bigram }.
// `typed` is the typed text per word, `words` the target words, `seconds` the test length.
export function scoreTest({ typed, words, seconds, log }) {
  let good = 0;
  const all = typed.reduce((s, t) => s + t.length, 0) + typed.length - 1;
  typed.forEach((t, i) => {
    const w = words[i] || "";
    if (t === w) good += t.length + (i < typed.length - 1 ? 1 : 0);
    else if (i === typed.length - 1) for (let j = 0; j < t.length; j++) if (t[j] === w[j]) good++;
  });

  const el = Math.max(1, seconds);
  const n = Math.ceil(el);
  const raw = Array(n).fill(0);
  const errs = Array(n).fill(0);
  log.forEach((k) => {
    const s = Math.min(n - 1, Math.floor(k.t / 1000));
    raw[s]++;
    if (!k.ok) errs[s]++;
  });
  const series = raw.map((v) => v * 12);
  const mean = series.reduce((a, b) => a + b, 0) / n || 1;
  const sd = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

  let ok = 0;
  let bad = 0;
  log.forEach((k) => (k.ok ? ok++ : bad++));

  return {
    good,
    all,
    el,
    wpm: Math.round(good / 5 / (el / 60)),
    raw: Math.round(all / 5 / (el / 60)),
    acc: Math.round((100 * ok) / Math.max(1, ok + bad)),
    cons: Math.max(0, Math.round(100 - (100 * sd) / mean)),
    series,
    errs,
    ok,
    bad,
  };
}

/* ───────────── keystroke analysis: fingers and letter pairs ───────────── */

export const FINGERS = ["L pinky", "L ring", "L middle", "L index", "R index", "R middle", "R ring", "R pinky"];
const FINGER_KEYS = ["qaz1`", "wsx2", "edc3", "rfvtgb45", "yhnujm67", "ik,8", "ol.9", "p;/0-=[]'"];
const FINGER_OF = {};
FINGER_KEYS.forEach((keys, f) => [...keys].forEach((ch) => (FINGER_OF[ch] = f)));

export function fingerOf(ch) {
  const f = FINGER_OF[String(ch || "").toLowerCase()];
  return f === undefined ? -1 : f;
}

// Per-finger hits and misses, and per-letter-pair counts and timings, for one test.
export function analyseLog(log) {
  const fingers = FINGERS.map(() => ({ n: 0, err: 0 }));
  const pairs = {};
  let prev = null;
  let gapSum = 0;
  let gapN = 0;
  log.forEach((e) => {
    const f = fingerOf(e.a);
    if (f >= 0) {
      fingers[f].n++;
      if (!e.ok) fingers[f].err++;
    }
    const gap = prev === null ? null : e.t - prev;
    prev = e.t;
    const p = (pairs[e.b] = pairs[e.b] || { n: 0, err: 0, ms: 0, msN: 0 });
    p.n++;
    if (!e.ok) p.err++;
    if (gap !== null && gap < MAX_GAP_MS) {
      p.ms += gap;
      p.msN++;
      gapSum += gap;
      gapN++;
    }
  });
  return { fingers, pairs, avgMs: gapN ? gapSum / gapN : 0 };
}

// Higher = worse. Mostly error rate, plus how much slower than average the pair is.
export function weakness(p, avgMs) {
  const errRate = (p.err + 0.5) / (p.n + 1);
  const slow = p.msN && avgMs ? Math.max(0, p.ms / p.msN / avgMs - 1) : 0;
  return errRate * 3 + slow;
}

// Merge one test into a long-running profile. Older tests fade (decay), so the profile follows recent form.
const DECAY = 0.85;
const MIN_COUNT = 0.5;
export function mergeProfile(profile, analysis) {
  const out = { pairs: {}, avgMs: 0 };
  Object.entries((profile && profile.pairs) || {}).forEach(([b, p]) => {
    out.pairs[b] = { n: p.n * DECAY, err: p.err * DECAY, ms: p.ms * DECAY, msN: p.msN * DECAY };
  });
  Object.entries(analysis.pairs).forEach(([b, p]) => {
    const q = (out.pairs[b] = out.pairs[b] || { n: 0, err: 0, ms: 0, msN: 0 });
    q.n += p.n;
    q.err += p.err;
    q.ms += p.ms;
    q.msN += p.msN;
  });
  Object.keys(out.pairs).forEach((b) => out.pairs[b].n < MIN_COUNT && delete out.pairs[b]);
  // Global average gap, kept as a decayed running figure so weakness uses one scale.
  const prevAvg = (profile && profile.avgMs) || 0;
  out.avgMs = analysis.avgMs ? (prevAvg ? prevAvg * DECAY + analysis.avgMs * (1 - DECAY) : analysis.avgMs) : prevAvg;
  return out;
}

const MIN_SAMPLES = 3; // a pair needs this many recent keystrokes before we call it weak

// The worst letter pairs in a profile, for display and for practice.
export function weakPairs(profile, limit = 5) {
  const pairs = (profile && profile.pairs) || {};
  const avg = (profile && profile.avgMs) || 0;
  return Object.entries(pairs)
    .filter(([, p]) => p.n >= MIN_SAMPLES)
    .map(([b, p]) => ({ b, score: weakness(p, avg), n: Math.round(p.n), err: Math.round(p.err) }))
    .filter((x) => x.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ───────────── adaptive practice ───────────── */

// Words that contain the weakest letter pairs, most-targeted first. Fills the rest with random words.
export function practiceWords(profile, n) {
  const weak = Object.fromEntries(weakPairs(profile, 60).map((x) => [x.b, x.score]));
  const scored = [];
  WB.forEach((w) => {
    let s = 0;
    for (let i = 1; i < w.length; i++) s += weak[(w[i - 1] + w[i]).toLowerCase()] || 0;
    if (s > 0) scored.push({ w, s });
  });
  if (scored.length < 5) return gen(n, {});
  scored.sort((a, b) => b.s - a.s);
  const pool = scored.slice(0, 60).map((x) => x.w);
  const out = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let w;
    do w = rnd(pool); while (w === last && pool.length > 1);
    last = w;
    out.push(w);
  }
  return out;
}

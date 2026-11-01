import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreTest, analyseLog, fingerOf, mergeProfile, weakPairs, practiceWords, codeWords, textWords, gen, textFor, FINGERS,
} from "./engine.js";
import { WB } from "./words.js";
import { CODE_TOKENS } from "./code.js";
import { SENTENCES } from "./sentences.js";

test("WPM: 24 correct characters in one minute is 5 WPM", () => {
  const words = ["aaaa", "aaaa", "aaaa", "aaaa", "aaaa"];
  const log = words.flatMap((w, i) => [...w].map((c, j) => ({ t: (i * 5 + j) * 500, ok: true, a: c, b: "aa" })));
  const r = scoreTest({ typed: [...words], words, seconds: 60, log });
  assert.equal(r.good, 24);
  assert.equal(r.wpm, 5);
  assert.equal(r.acc, 100);
});

test("accuracy counts a mistake even when it is later fixed", () => {
  const log = [
    { t: 100, ok: true, a: "a", b: "xa" },
    { t: 200, ok: false, a: "b", b: "ab" },
    { t: 300, ok: true, a: "b", b: "ab" },
    { t: 400, ok: true, a: "c", b: "bc" },
  ];
  const r = scoreTest({ typed: ["abc"], words: ["abc"], seconds: 60, log });
  assert.equal(r.ok, 3);
  assert.equal(r.bad, 1);
  assert.equal(r.acc, 75);
  assert.equal(r.errs[0], 1);
});

test("consistency is 100 for a perfectly even pace and lower for bursts", () => {
  const even = Array.from({ length: 10 }, (_, s) => ({ t: s * 1000 + 100, ok: true, a: "a", b: "aa" }));
  const bursty = Array.from({ length: 20 }, (_, i) => ({ t: 500 + i * 10, ok: true, a: "a", b: "aa" }));
  assert.equal(scoreTest({ typed: [], words: [], seconds: 10, log: even }).cons, 100);
  assert.ok(scoreTest({ typed: [], words: [], seconds: 10, log: bursty }).cons < 100);
});

test("finger map knows the home row and the top row", () => {
  assert.equal(FINGERS[fingerOf("f")], "L index");
  assert.equal(FINGERS[fingerOf("j")], "R index");
  assert.equal(FINGERS[fingerOf("a")], "L pinky");
  assert.equal(FINGERS[fingerOf(";")], "R pinky");
  assert.equal(fingerOf(" "), -1);
});

test("analyseLog attributes misses to the finger of the expected key", () => {
  const log = [
    { t: 0, ok: false, a: "f", b: "af" },
    { t: 100, ok: true, a: "f", b: "ff" },
    { t: 180, ok: true, a: "j", b: "fj" },
  ];
  const { fingers, pairs, avgMs } = analyseLog(log);
  assert.deepEqual(fingers[3], { n: 2, err: 1 }); // L index
  assert.equal(fingers[4].n, 1); // R index
  assert.equal(pairs.af.err, 1);
  assert.equal(avgMs, 90); // gaps of 100 ms and 80 ms
});

test("profile decays old tests and drops empty pairs", () => {
  const first = mergeProfile(null, analyseLog([{ t: 0, ok: false, a: "e", b: "te" }]));
  assert.equal(first.pairs.te.err, 1);
  const second = mergeProfile(first, analyseLog([{ t: 0, ok: true, a: "x", b: "xy" }]));
  assert.ok(second.pairs.te.err < 1 && second.pairs.te.err > 0.8);
  assert.ok(second.pairs.xy);
});

test("weak pairs need enough samples before they count", () => {
  const sparse = mergeProfile(null, analyseLog([{ t: 0, ok: false, a: "q", b: "zq" }]));
  assert.deepEqual(weakPairs(sparse), []);
});

test("practice words all contain the weakest letter pair", () => {
  const log = Array.from({ length: 6 }, (_, i) => ({ t: i * 200, ok: false, a: "h", b: "th" }));
  const profile = mergeProfile(null, analyseLog(log));
  assert.equal(weakPairs(profile)[0].b, "th");
  const words = practiceWords(profile, 40);
  assert.equal(words.length, 40);
  assert.ok(words.every((w) => w.includes("th")), words.find((w) => !w.includes("th")));
});

test("practice falls back to random words without a profile", () => {
  const words = practiceWords(null, 12);
  assert.equal(words.length, 12);
  assert.ok(words.every((w) => WB.includes(w.toLowerCase()) || /^\d+$/.test(w)));
});

test("gen respects the numbers and punctuation options", () => {
  const plain = gen(200, { nums: false, punct: false });
  assert.ok(plain.every((w) => /^(I|[a-z]+)$/.test(w)));
  assert.equal(gen(30, { nums: true, punct: true }).length, 30);
});

test("gen follows basic grammar: I is capital, sentences start with a capital", () => {
  const words = gen(2000, { nums: true, punct: true });
  assert.ok(words.every((w) => w !== "i" && !/^i[.,?]$/.test(w)));
  assert.ok(/^[A-Z]/.test(words[0]) || /^\d/.test(words[0]));
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (i > 0 && /[.?!]$/.test(prev) && /^[a-z]/i.test(w)) {
      assert.equal(w[0], w[0].toUpperCase(), `word after "${prev}" should be capitalised: ${w}`);
    }
    // no random capitals in the middle of a sentence
    if (i > 0 && !/[.?!]$/.test(prev) && /^[A-Z][a-z]/.test(w)) {
      assert.fail(`mid-sentence capital: ${w}`);
    }
  });
  // a batch appended after an unfinished sentence does not start with a capital
  const tail = gen(200, { punct: true }, "word");
  tail.forEach((w, i) => {
    if (i === 0 && !/^I$/.test(w)) assert.equal(w, w.toLowerCase());
  });
});

test("code tokens come from the chosen language", () => {
  const py = codeWords(50, "python");
  assert.equal(py.length, 50);
  assert.ok(py.every((t) => CODE_TOKENS.python.includes(t)));
  assert.ok(codeWords(5, "js").every((t) => CODE_TOKENS.js.includes(t)));
});

test("custom text splits on whitespace and is capped", () => {
  assert.deepEqual(textWords("  one\ntwo   three  "), ["one", "two", "three"]);
  assert.equal(textWords("a ".repeat(1000)).length, 400);
  assert.deepEqual(textWords(""), []);
});

test("every sentence in the bank starts with a capital and ends with punctuation", () => {
  SENTENCES.forEach((s) => {
    assert.match(s, /^["A-Z]/, s);
    assert.match(s, /[.?!"]$/, s);
    assert.doesNotMatch(s, /[^\x20-\x7E]/, "ASCII only: " + s);
  });
});

test("sentence text follows grammar and respects the numbers option", () => {
  const words = textFor(300, { punct: true, nums: false });
  assert.equal(words.length, 300);
  assert.ok(words.every((w) => !/\d/.test(w)), "no digits when numbers are off");
  assert.ok(words.every((w) => w !== "i" && !/^i[.,?!]?$/.test(w)), "I is always capital");
  words.forEach((w, i) => {
    if (i > 0 && /[.?!]$/.test(words[i - 1])) assert.match(w, /^["A-Z]/, `after "${words[i - 1]}": ${w}`);
  });
  assert.ok(textFor(400, { punct: true, nums: true }).some((w) => /\d/.test(w)), "digits appear when numbers are on");
});

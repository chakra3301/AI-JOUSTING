import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractJson,
  repairJson,
  parseHeraldJson,
  normalizeScore,
  countHits,
  declareWinner,
} from "../src/core/herald.js";
import { passScoreSchema } from "../src/config/schema.js";
import type { JoustConfig, PassRecord } from "../src/types/index.js";

// A clean, well-formed flat Herald response (the shape we now prompt for).
const FLAT_JSON = JSON.stringify({
  pass: 1,
  a_hit: "direct",
  a_reasoning: "Strong opening.",
  b_hit: "glancing",
  b_reasoning: "Partial counter.",
  unseat: false,
  unseated_agent: null,
  commentary: "A spirited exchange.",
});

// --- extractJson -----------------------------------------------------------

test("extractJson strips ```json code fences", () => {
  const wrapped = "```json\n" + FLAT_JSON + "\n```";
  assert.deepEqual(JSON.parse(extractJson(wrapped)), JSON.parse(FLAT_JSON));
});

test("extractJson strips bare ``` fences", () => {
  const wrapped = "```\n" + FLAT_JSON + "\n```";
  assert.deepEqual(JSON.parse(extractJson(wrapped)), JSON.parse(FLAT_JSON));
});

test("extractJson tolerates preamble/trailing prose", () => {
  const noisy = "Here is my score:\n" + FLAT_JSON + "\nThanks!";
  assert.deepEqual(JSON.parse(extractJson(noisy)), JSON.parse(FLAT_JSON));
});

test("extractJson throws when no object present", () => {
  assert.throws(() => extractJson("no json here"));
});

// --- repairJson ------------------------------------------------------------

test("repairJson balances a missing closing brace", () => {
  const broken = '{"a": {"hit": "direct", "reasoning": "x"}';
  const fixed = repairJson(broken);
  assert.doesNotThrow(() => JSON.parse(fixed));
});

test("repairJson removes a trailing comma", () => {
  const broken = '{"a": 1, "b": 2,}';
  assert.deepEqual(JSON.parse(repairJson(broken)), { a: 1, b: 2 });
});

test("repairJson leaves valid JSON unchanged in meaning", () => {
  assert.deepEqual(JSON.parse(repairJson(FLAT_JSON)), JSON.parse(FLAT_JSON));
});

test("repairJson ignores braces inside strings", () => {
  const s = '{"msg": "a } { weird string"}';
  assert.deepEqual(JSON.parse(repairJson(s)), { msg: "a } { weird string" });
});

// --- parseHeraldJson (fence + repair integration) --------------------------

test("parseHeraldJson recovers a fenced, brace-truncated response", () => {
  const broken =
    "```json\n" + '{"pass": 1, "a_hit": "direct", "a_reasoning": "x"' + "\n```";
  const parsed = parseHeraldJson(broken) as any;
  assert.equal(parsed.a_hit, "direct");
});

// --- normalizeScore --------------------------------------------------------

test("normalizeScore converts flat shape into nested PassScore", () => {
  const nested = normalizeScore(JSON.parse(FLAT_JSON)) as any;
  const result = passScoreSchema.safeParse(nested);
  assert.ok(result.success, JSON.stringify(result, null, 2));
  assert.equal(nested.scores.a.hit, "direct");
  assert.equal(nested.scores.b.hit, "glancing");
  assert.equal(nested.commentary, "A spirited exchange.");
});

test("normalizeScore passes through legacy nested shape untouched", () => {
  const legacy = {
    pass: 2,
    scores: {
      a: { hit: "miss", reasoning: "weak" },
      b: { hit: "unseat", reasoning: "fatal" },
    },
    unseat: true,
    unseated_agent: "Lancer",
    commentary: "Unhorsed.",
  };
  const out = normalizeScore(legacy) as any;
  assert.deepEqual(out, legacy);
  assert.ok(passScoreSchema.safeParse(out).success);
});

test("normalize'd flat output reproduces the real-world bug fixture", () => {
  // The exact failure mode seen in testing: model emits flat keys; we must
  // produce a schema-valid nested score with top-level unseat/commentary.
  const flat = {
    pass: 1,
    a_hit: "glancing",
    a_reasoning: "ok",
    b_hit: "glancing",
    b_reasoning: "ok",
    unseat: false,
    unseated_agent: null,
    commentary: "even",
  };
  const out = normalizeScore(flat) as any;
  assert.ok(passScoreSchema.safeParse(out).success);
  assert.equal(out.unseat, false);
});

// --- countHits / declareWinner ---------------------------------------------

function mkPass(aHit: string, bHit: string, extra: Partial<any> = {}): PassRecord {
  return {
    payloads: [] as any,
    score: {
      pass: 1,
      scores: {
        a: { hit: aHit, reasoning: "" },
        b: { hit: bHit, reasoning: "" },
      },
      unseat: false,
      unseated_agent: null,
      commentary: "",
      ...extra,
    },
  } as unknown as PassRecord;
}

const CONFIG = {
  agent_a: { name: "Lancer" },
  agent_b: { name: "Paladin" },
} as unknown as JoustConfig;

test("countHits weights unseat>direct>glancing>miss", () => {
  const passes = [mkPass("direct", "glancing"), mkPass("miss", "unseat")];
  assert.deepEqual(countHits(passes), { a: 2, b: 4 });
});

test("declareWinner picks the higher hit total", () => {
  const passes = [mkPass("direct", "miss"), mkPass("glancing", "miss")];
  assert.equal(declareWinner(CONFIG, passes, countHits(passes)), "Lancer");
});

test("declareWinner returns Draw on a tie", () => {
  const passes = [mkPass("direct", "direct")];
  assert.equal(declareWinner(CONFIG, passes, countHits(passes)), "Draw");
});

test("declareWinner: an unseat is decisive regardless of totals", () => {
  // B unseats A in pass 1; A piles on points later, but the unseat wins.
  const passes = [
    mkPass("miss", "unseat", { unseat: true, unseated_agent: "Lancer" }),
    mkPass("direct", "miss"),
    mkPass("direct", "miss"),
  ];
  assert.equal(declareWinner(CONFIG, passes, countHits(passes)), "Paladin");
});

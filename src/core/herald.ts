import { getAdapter } from "../adapters/index.js";
import { getMode } from "../modes/index.js";
import { formatPassHistory } from "../modes/shared.js";
import { passScoreSchema } from "../config/schema.js";
import type {
  JoustConfig,
  JoustResult,
  PassRecord,
  PassScore,
  Payload,
} from "../types/index.js";

// Extracts the first JSON object from a model response, tolerating any stray
// preamble or markdown fences the model may have added.
export function extractJson(raw: string): string {
  let text = raw.trim();
  // Strip markdown code fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence && fence[1]) text = fence[1].trim();

  const start = text.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in Herald response.");
  }
  const end = text.lastIndexOf("}");
  // If the closing brace is missing or precedes the opener, take everything
  // from the first `{` onward and let repairJson() balance it.
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

// Best-effort repair for the most common LLM JSON defects: unbalanced braces
// (a missing closing `}`) and a trailing comma before the final brace. Returns
// the original string unchanged if it is already balanced.
export function repairJson(json: string): string {
  let text = json.trim().replace(/,\s*([}\]])/g, "$1");
  // Count braces outside of strings to know how many are missing.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    else if (!inString && ch === "{") depth++;
    else if (!inString && ch === "}") depth--;
  }
  if (depth > 0) text += "}".repeat(depth);
  return text;
}

// Parse a Herald JSON response, attempting a repair pass before giving up.
export function parseHeraldJson(raw: string): unknown {
  const extracted = extractJson(raw);
  try {
    return JSON.parse(extracted);
  } catch {
    return JSON.parse(repairJson(extracted));
  }
}

// Normalize the parsed Herald object into the nested PassScore shape the rest
// of the codebase expects. Accepts both the flat wire format
// (a_hit/a_reasoning/...) and the legacy nested format (scores.a.hit/...), so
// older .joust files and either model behavior keep working.
export function normalizeScore(parsed: any): unknown {
  if (parsed && typeof parsed === "object" && !parsed.scores) {
    return {
      pass: parsed.pass,
      scores: {
        a: { hit: parsed.a_hit, reasoning: parsed.a_reasoning },
        b: { hit: parsed.b_hit, reasoning: parsed.b_reasoning },
      },
      unseat: parsed.unseat,
      unseated_agent: parsed.unseated_agent,
      commentary: parsed.commentary,
    };
  }
  return parsed;
}

export class Herald {
  private config: JoustConfig;

  constructor(config: JoustConfig) {
    this.config = config;
  }

  async score(
    passHistory: PassRecord[],
    payloadA: Payload,
    payloadB: Payload,
  ): Promise<PassScore> {
    const mode = getMode(this.config.tiltyard.mode);
    const adapter = getAdapter(this.config.herald.provider, "Herald");

    // Build a history that includes the current (unscored) exchange.
    const currentPassNumber = passHistory.length + 1;
    const currentExchange = [
      `── CURRENT PASS ${currentPassNumber} (score this) ──`,
      `${payloadA.agent} (A): ${payloadA.payload}`,
      `${payloadB.agent} (B): ${payloadB.payload}`,
    ].join("\n");

    const prompt = [
      mode.heraldPrompt(this.config, passHistory),
      "",
      currentExchange,
    ].join("\n");

    // The Herald's output is stochastic and occasionally emits malformed JSON
    // or a schema-invalid score. Retry a few times before failing the joust;
    // a re-roll (often combined with brace repair) almost always recovers.
    const MAX_ATTEMPTS = 3;
    let lastError = "";
    let lastRaw = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await adapter.complete({
        model: this.config.herald.model,
        system:
          "You are an impartial Herald scoring a joust. Output ONLY a single " +
          "valid JSON object — no markdown fences, no prose before or after.",
        messages: [{ role: "user", content: prompt }],
        // Vary temperature across retries so a re-roll actually differs
        // (temp 0 would deterministically reproduce the same bad output).
        temperature: [0.2, 0.5, 0.8][attempt - 1] ?? 0.5,
      });
      lastRaw = raw;

      let parsed: unknown;
      try {
        parsed = normalizeScore(parseHeraldJson(raw));
      } catch (err) {
        lastError = `unparseable JSON: ${String(err)}`;
        continue;
      }

      const result = passScoreSchema.safeParse(parsed);
      if (!result.success) {
        lastError =
          "failed validation: " +
          result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        continue;
      }

      // Force the pass number to be authoritative on our side.
      const score = result.data as PassScore;
      score.pass = currentPassNumber;
      return score;
    }

    throw new Error(
      `Herald ${lastError} after ${MAX_ATTEMPTS} attempts.\n--- raw ---\n${lastRaw}`,
    );
  }

  // Produce the final synthesis + winner declaration from the full history.
  async synthesize(passHistory: PassRecord[]): Promise<JoustResult> {
    const totals = countHits(passHistory);
    const winner = declareWinner(this.config, passHistory, totals);

    if (!this.config.herald.synthesize) {
      return {
        winner,
        synthesis: "",
        total_hits: totals,
      };
    }

    const adapter = getAdapter(this.config.herald.provider, "Herald");
    const mode = getMode(this.config.tiltyard.mode);

    const prompt = [
      `The joust on "${this.config.tiltyard.topic}" (mode: ${mode.name}) is complete.`,
      "",
      "FULL JOUST:",
      formatPassHistory(passHistory),
      "",
      `Hit tally — ${this.config.agent_a.name} (A): ${totals.a}, ${this.config.agent_b.name} (B): ${totals.b}.`,
      `Provisional winner by hits: ${winner}.`,
      "",
      "As the Herald, write a final synthesis (3-6 sentences). Distill what was actually established by the strongest points from BOTH sides into a balanced, useful takeaway. Then confirm the winner and why. Plain prose, no JSON.",
    ].join("\n");

    const synthesis = await adapter.complete({
      model: this.config.herald.model,
      system:
        "You are the Herald delivering the closing synthesis of a joust. Be balanced, concrete, and decisive.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    return { winner, synthesis, total_hits: totals };
  }
}

const HIT_WEIGHT: Record<string, number> = {
  unseat: 3,
  direct: 2,
  glancing: 1,
  miss: 0,
};

export function countHits(passHistory: PassRecord[]): {
  a: number;
  b: number;
} {
  let a = 0;
  let b = 0;
  for (const p of passHistory) {
    a += HIT_WEIGHT[p.score.scores.a.hit] ?? 0;
    b += HIT_WEIGHT[p.score.scores.b.hit] ?? 0;
  }
  return { a, b };
}

export function declareWinner(
  config: JoustConfig,
  passHistory: PassRecord[],
  totals: { a: number; b: number },
): string {
  // An unseat is decisive — whoever unseated wins immediately.
  for (const p of passHistory) {
    if (p.score.unseat && p.score.unseated_agent) {
      const unseated = p.score.unseated_agent;
      return unseated === config.agent_a.name
        ? config.agent_b.name
        : config.agent_a.name;
    }
  }

  if (totals.a > totals.b) return config.agent_a.name;
  if (totals.b > totals.a) return config.agent_b.name;
  return "Draw";
}

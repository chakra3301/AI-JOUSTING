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
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in Herald response.");
  }
  return text.slice(start, end + 1);
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

    const raw = await adapter.complete({
      model: this.config.herald.model,
      system:
        "You are an impartial Herald scoring a joust. You output only valid JSON.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (err) {
      throw new Error(
        `Herald returned unparseable JSON: ${String(err)}\n--- raw ---\n${raw}`,
      );
    }

    const result = passScoreSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Herald score failed validation: ${issues}`);
    }

    // Force the pass number to be authoritative on our side.
    const score = result.data as PassScore;
    score.pass = currentPassNumber;
    return score;
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

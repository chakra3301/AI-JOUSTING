import { z } from "zod";

export const providerSchema = z.enum([
  "anthropic",
  "openai",
  "gemini",
  "groq",
  "openrouter",
  "ollama",
]);
export const modeSchema = z.enum([
  "debate",
  "redteam",
  "review",
  "synthesis",
  "plan",
]);
export const lanceStyleSchema = z.enum([
  "aggressive",
  "methodical",
  "socratic",
]);
export const scoringSchema = z.enum(["strict", "lenient", "narrative"]);
export const tournamentFormatSchema = z.enum(["elimination", "roundrobin"]);

export const tiltyardSchema = z.object({
  topic: z.string().min(1, "tiltyard.topic must not be empty"),
  passes: z.number().int().min(1).max(50),
  mode: modeSchema,
  save: z.boolean(),
});

export const agentSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  provider: providerSchema,
  lance_style: lanceStyleSchema,
  persona: z.string().default(""),
});

export const heraldSchema = z.object({
  model: z.string().min(1),
  provider: providerSchema,
  scoring: scoringSchema,
  synthesize: z.boolean(),
});

export const tournamentSchema = z.object({
  format: tournamentFormatSchema,
  agents: z.array(agentSchema).min(2, "tournament needs at least 2 agents"),
});

export const configSchema = z.object({
  tiltyard: tiltyardSchema,
  agent_a: agentSchema,
  agent_b: agentSchema,
  herald: heraldSchema,
  tournament: tournamentSchema.optional(),
});

export type ParsedConfig = z.infer<typeof configSchema>;

// Herald score validation — the JSON returned by the model.
export const sideScoreSchema = z.object({
  hit: z.enum(["direct", "glancing", "miss", "unseat"]),
  reasoning: z.string(),
});

export const passScoreSchema = z.object({
  pass: z.number().int(),
  scores: z.object({
    a: sideScoreSchema,
    b: sideScoreSchema,
  }),
  unseat: z.boolean(),
  unseated_agent: z.string().nullable(),
  commentary: z.string(),
});

import type { JoustConfig, Mode } from "../types/index.js";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_PROVIDER = "anthropic" as const;

export function defaultConfig(
  topic = "Should we rewrite this in Rust?",
  mode: Mode = "debate",
): JoustConfig {
  return {
    tiltyard: {
      topic,
      passes: 5,
      mode,
      save: true,
    },
    agent_a: {
      name: "Lancer",
      model: DEFAULT_MODEL,
      provider: DEFAULT_PROVIDER,
      lance_style: "aggressive",
      persona: "senior engineer who loves Rust",
    },
    agent_b: {
      name: "Paladin",
      model: DEFAULT_MODEL,
      provider: DEFAULT_PROVIDER,
      lance_style: "methodical",
      persona: "pragmatic CTO who ships in Go",
    },
    herald: {
      model: DEFAULT_MODEL,
      provider: DEFAULT_PROVIDER,
      scoring: "strict",
      synthesize: true,
    },
  };
}

// A TOML template string for `joustx init`.
export function defaultTomlTemplate(
  topic = "Should we rewrite this in Rust?",
  mode: Mode = "debate",
): string {
  return `[tiltyard]
topic     = ${JSON.stringify(topic)}
passes    = 5
mode      = ${JSON.stringify(mode)}            # debate|redteam|review|synthesis|plan
save      = true

[agent_a]
name        = "Lancer"
model       = "${DEFAULT_MODEL}"
provider    = "anthropic"          # anthropic|openai|gemini|groq|openrouter|ollama
lance_style = "aggressive"         # aggressive|methodical|socratic
persona     = "senior engineer who loves Rust"

[agent_b]
name        = "Paladin"
model       = "${DEFAULT_MODEL}"
provider    = "anthropic"
lance_style = "methodical"
persona     = "pragmatic CTO who ships in Go"

[herald]
model      = "${DEFAULT_MODEL}"
provider   = "anthropic"
scoring    = "strict"              # strict|lenient|narrative
synthesize = true
`;
}

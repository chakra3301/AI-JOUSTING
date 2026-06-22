import type { LLMAdapter, Provider } from "../types/index.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAIAdapter } from "./openai.js";
import { OpenRouterAdapter } from "./openrouter.js";
import { GeminiAdapter } from "./gemini.js";
import { GroqAdapter } from "./groq.js";
import { OllamaAdapter } from "./ollama.js";
import { MissingKeyError, MissingSdkError } from "./shared.js";

interface ProviderMeta {
  // The env var that holds the API key. Undefined means no key is required.
  keyEnv?: string;
  // Builds the adapter. `key` is the resolved API key (empty for keyless).
  create(key: string): LLMAdapter;
}

const REGISTRY: Record<Provider, ProviderMeta> = {
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    create: (key) => new AnthropicAdapter(key),
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    create: (key) => new OpenAIAdapter({ apiKey: key, provider: "openai" }),
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    create: (key) => new GeminiAdapter(key),
  },
  groq: {
    keyEnv: "GROQ_API_KEY",
    create: (key) => new GroqAdapter(key),
  },
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    create: (key) => new OpenRouterAdapter(key),
  },
  ollama: {
    // No key required.
    create: () => new OllamaAdapter(),
  },
};

const cache = new Map<Provider, LLMAdapter>();

// Returns a (cached) adapter for the given provider. Validates that the
// required API key is present, attributing the error to the given agent.
export function getAdapter(provider: Provider, agentName?: string): LLMAdapter {
  const meta = REGISTRY[provider];
  if (!meta) {
    throw new Error(
      `Unknown provider: ${provider}. Valid providers: ${Object.keys(
        REGISTRY,
      ).join(", ")}`,
    );
  }

  let key = "";
  if (meta.keyEnv) {
    key = process.env[meta.keyEnv] ?? "";
    if (!key) {
      const who = agentName ? `Agent '${agentName}'` : "This agent";
      throw new MissingKeyError(
        provider,
        meta.keyEnv,
        `${who} uses ${provider} but ${meta.keyEnv} is not set.`,
      );
    }
  }

  const cached = cache.get(provider);
  if (cached) return cached;

  const adapter = meta.create(key);
  cache.set(provider, adapter);
  return adapter;
}

// True if a provider needs no API key (currently only ollama).
export function isKeylessProvider(provider: Provider): boolean {
  return !REGISTRY[provider]?.keyEnv;
}

export function providerKeyEnv(provider: Provider): string | undefined {
  return REGISTRY[provider]?.keyEnv;
}

export {
  AnthropicAdapter,
  OpenAIAdapter,
  OpenRouterAdapter,
  GeminiAdapter,
  GroqAdapter,
  OllamaAdapter,
  MissingKeyError,
  MissingSdkError,
};

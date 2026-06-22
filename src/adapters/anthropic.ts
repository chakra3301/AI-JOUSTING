import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";
import { loadSdk } from "./shared.js";
import {
  type AnthropicAuth,
  CLAUDE_CODE_SPOOF,
  OAUTH_BETA,
} from "./anthropic-auth.js";

export class AnthropicAdapter implements LLMAdapter {
  readonly provider: Provider = "anthropic";
  private auth: AnthropicAuth;
  private clientPromise?: Promise<any>;

  // Accepts either a resolved auth descriptor or a bare API-key string
  // (back-compat with the original constructor signature).
  constructor(auth: AnthropicAuth | string) {
    this.auth =
      typeof auth === "string" ? { mode: "apikey", token: auth } : auth;
  }

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { default: Anthropic } = await loadSdk(
          "anthropic",
          "@anthropic-ai/sdk",
        );
        if (this.auth.mode === "oauth") {
          // Subscription auth: Bearer token + beta header, no x-api-key.
          return new Anthropic({
            authToken: this.auth.token,
            apiKey: null,
            defaultHeaders: { "anthropic-beta": OAUTH_BETA },
          });
        }
        return new Anthropic({ apiKey: this.auth.token });
      })();
    }
    return this.clientPromise;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const client = await this.getClient();

    const messages = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // OAuth requires the Claude Code identity as the first system block;
    // the joust's real system prompt follows it.
    const system =
      this.auth.mode === "oauth"
        ? [
            { type: "text" as const, text: CLAUDE_CODE_SPOOF },
            ...(req.system ? [{ type: "text" as const, text: req.system }] : []),
          ]
        : req.system;

    const response = await client.messages.create({
      model: req.model,
      system,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      messages,
    });

    return response.content
      .map((block: any) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  }
}

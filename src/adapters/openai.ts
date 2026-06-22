import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";
import { loadSdk } from "./shared.js";

export interface OpenAIAdapterOptions {
  apiKey: string;
  provider?: Provider;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
}

// Works for any OpenAI-compatible Chat Completions endpoint. OpenRouter reuses
// this with a baseURL override.
export class OpenAIAdapter implements LLMAdapter {
  readonly provider: Provider;
  private opts: OpenAIAdapterOptions;
  private clientPromise?: Promise<any>;

  constructor(opts: OpenAIAdapterOptions) {
    this.opts = opts;
    this.provider = opts.provider ?? "openai";
  }

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { default: OpenAI } = await loadSdk(this.provider, "openai");
        return new OpenAI({
          apiKey: this.opts.apiKey,
          baseURL: this.opts.baseURL,
          defaultHeaders: this.opts.defaultHeaders,
        });
      })();
    }
    return this.clientPromise;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const client = await this.getClient();

    const messages = [
      { role: "system", content: req.system },
      ...req.messages.filter((m) => m.role !== "system"),
    ];

    const response = await client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      messages,
    });

    return (response.choices?.[0]?.message?.content ?? "").trim();
  }
}

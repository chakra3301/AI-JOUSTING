import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";
import { loadSdk } from "./shared.js";

export class AnthropicAdapter implements LLMAdapter {
  readonly provider: Provider = "anthropic";
  private apiKey: string;
  private clientPromise?: Promise<any>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { default: Anthropic } = await loadSdk(
          "anthropic",
          "@anthropic-ai/sdk",
        );
        return new Anthropic({ apiKey: this.apiKey });
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

    const response = await client.messages.create({
      model: req.model,
      system: req.system,
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

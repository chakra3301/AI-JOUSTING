import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";
import { loadSdk } from "./shared.js";

// Groq's SDK mirrors the OpenAI Chat Completions shape.
export class GroqAdapter implements LLMAdapter {
  readonly provider: Provider = "groq";
  private apiKey: string;
  private clientPromise?: Promise<any>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { default: Groq } = await loadSdk("groq", "groq-sdk");
        return new Groq({ apiKey: this.apiKey });
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

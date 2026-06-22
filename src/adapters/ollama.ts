import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";

// Local Ollama server. No API key, no SDK — just fetch against /api/chat.
export class OllamaAdapter implements LLMAdapter {
  readonly provider: Provider = "ollama";
  private host: string;

  constructor() {
    this.host = normalizeHost(
      process.env.OLLAMA_HOST ?? "http://localhost:11434",
    );
  }

  async complete(req: CompletionRequest): Promise<string> {
    const messages = [
      { role: "system", content: req.system },
      ...req.messages.filter((m) => m.role !== "system"),
    ];

    let res: Response;
    try {
      res = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: req.model,
          messages,
          stream: false,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: req.maxTokens ?? 2048,
          },
        }),
      });
    } catch {
      throw new Error(
        `Jousting couldn't reach Ollama at ${this.host}. Is it running?`,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(
        `Ollama at ${this.host} returned ${res.status}: ${detail}`,
      );
    }

    const data = (await res.json()) as { message?: { content?: string } };
    return (data.message?.content ?? "").trim();
  }
}

function normalizeHost(host: string): string {
  const trimmed = host.replace(/\/+$/, "");
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

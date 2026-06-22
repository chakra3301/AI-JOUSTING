import { OpenAIAdapter } from "./openai.js";

// OpenRouter is OpenAI-compatible: reuse the OpenAI adapter with a baseURL
// override. Model strings pass through as-is (e.g. "meta-llama/llama-3-70b").
export class OpenRouterAdapter extends OpenAIAdapter {
  constructor(apiKey: string) {
    super({
      apiKey,
      provider: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/jousting/jousting",
        "X-Title": "Jousting",
      },
    });
  }
}

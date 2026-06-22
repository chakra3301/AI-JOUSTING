import type {
  CompletionRequest,
  LLMAdapter,
  Provider,
} from "../types/index.js";
import { loadSdk } from "./shared.js";

export class GeminiAdapter implements LLMAdapter {
  readonly provider: Provider = "gemini";
  private apiKey: string;
  private sdkPromise?: Promise<any>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getSdk(): Promise<any> {
    if (!this.sdkPromise) {
      this.sdkPromise = loadSdk("gemini", "@google/generative-ai");
    }
    return this.sdkPromise;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const { GoogleGenerativeAI } = await this.getSdk();
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: req.model,
      systemInstruction: req.system,
    });

    // Gemini uses "user" / "model" roles in a contents array.
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const result = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.7,
      },
    });

    return (result.response.text() ?? "").trim();
  }
}

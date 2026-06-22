import { getAdapter } from "../adapters/index.js";
import { getMode } from "../modes/index.js";
import { formatPassHistory } from "../modes/shared.js";
import type {
  AgentConfig,
  JoustConfig,
  LLMAdapter,
  PassRecord,
  Payload,
} from "../types/index.js";

export type Side = "a" | "b";

export class Agent {
  readonly side: Side;
  readonly config: AgentConfig;
  private joust: JoustConfig;
  private adapter: LLMAdapter;
  private systemPrompt: string;

  constructor(side: Side, joust: JoustConfig) {
    this.side = side;
    this.joust = joust;
    this.config = side === "a" ? joust.agent_a : joust.agent_b;
    this.adapter = getAdapter(this.config.provider, this.config.name);

    const mode = getMode(joust.tiltyard.mode);
    this.systemPrompt =
      side === "a" ? mode.systemPromptA(joust) : mode.systemPromptB(joust);
  }

  // Agent A opens each pass.
  async charge(passHistory: PassRecord[]): Promise<Payload> {
    const mode = getMode(this.joust.tiltyard.mode);
    const history = formatPassHistory(passHistory);

    const instruction =
      passHistory.length === 0
        ? mode.firstMoverInstructions
        : "Make your next pass. Advance your case and respond to the latest exchange.";

    const userContent = [
      `JOUST SO FAR:\n${history}`,
      "",
      `YOUR MOVE (${this.config.name}): ${instruction}`,
    ].join("\n");

    const payload = await this.adapter.complete({
      model: this.config.model,
      system: this.systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    return { agent: this.config.name, payload };
  }

  // Agent B counters A's payload within the same pass.
  async counter(
    passHistory: PassRecord[],
    opponentPayload: Payload,
  ): Promise<Payload> {
    const history = formatPassHistory(passHistory);

    const userContent = [
      `JOUST SO FAR:\n${history}`,
      "",
      `Your opponent ${opponentPayload.agent} just charged with:`,
      `"${opponentPayload.payload}"`,
      "",
      `YOUR COUNTER (${this.config.name}): Counter directly, then press your own case.`,
    ].join("\n");

    const payload = await this.adapter.complete({
      model: this.config.model,
      system: this.systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    return { agent: this.config.name, payload };
  }
}

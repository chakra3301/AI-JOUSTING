import type { JoustConfig, ModeModule, PassRecord } from "../types/index.js";
import {
  agentPreamble,
  formatPassHistory,
  heraldInstructions,
} from "./shared.js";

const debate: ModeModule = {
  name: "debate",

  systemPromptA(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_a),
      "",
      `MODE: DEBATE. The topic is: "${config.tiltyard.topic}".`,
      "You argue FOR the topic. Make the strongest possible affirmative case.",
      "Engage directly with your opponent's points. Rebut, then advance. Keep each pass focused and under 220 words.",
    ].join("\n");
  },

  systemPromptB(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_b),
      "",
      `MODE: DEBATE. The topic is: "${config.tiltyard.topic}".`,
      "You argue AGAINST the topic. Make the strongest possible negative case.",
      "Counter your opponent's argument directly, then press your own. Keep each pass focused and under 220 words.",
    ].join("\n");
  },

  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string {
    const context = `This is a DEBATE on "${config.tiltyard.topic}". Agent A argues FOR; Agent B argues AGAINST. Reward direct rebuttals and well-evidenced claims; penalize dodging and unsupported assertions.`;
    return [
      heraldInstructions(config, passHistory, context),
      "",
      "JOUST SO FAR:",
      formatPassHistory(passHistory),
    ].join("\n");
  },

  firstMoverInstructions:
    "Open the debate. State your affirmative case for the topic with your single strongest argument.",
};

export default debate;

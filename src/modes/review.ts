import type { JoustConfig, ModeModule, PassRecord } from "../types/index.js";
import {
  agentPreamble,
  formatPassHistory,
  heraldInstructions,
} from "./shared.js";

const review: ModeModule = {
  name: "review",

  systemPromptA(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_a),
      "",
      `MODE: REVIEW. The work under review is: "${config.tiltyard.topic}".`,
      "You are the AUTHOR. Defend your work's design choices, justify trade-offs, and respond to critiques with substance — not stubbornness.",
      "Each pass: address the critic's latest point directly, conceding what's fair and defending what's sound. Under 220 words.",
    ].join("\n");
  },

  systemPromptB(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_b),
      "",
      `MODE: REVIEW. The work under review is: "${config.tiltyard.topic}".`,
      "You are the CRITIC. Find real flaws: bugs, design smells, missed edge cases, weak assumptions. Be specific and constructive but uncompromising.",
      "Each pass: raise or press your strongest concrete critique. Under 220 words.",
    ].join("\n");
  },

  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string {
    const context = `This is a REVIEW of "${config.tiltyard.topic}". Agent A is the author defending the work; Agent B is the critic finding flaws. Reward specific, well-grounded critiques and substantive defenses. Penalize nitpicking and defensive deflection.`;
    return [
      heraldInstructions(config, passHistory, context),
      "",
      "JOUST SO FAR:",
      formatPassHistory(passHistory),
    ].join("\n");
  },

  firstMoverInstructions:
    "Present your work. Briefly state its core design and the key choices you stand behind.",
};

export default review;

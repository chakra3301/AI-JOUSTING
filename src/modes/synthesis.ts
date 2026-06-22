import type { JoustConfig, ModeModule, PassRecord } from "../types/index.js";
import {
  agentPreamble,
  formatPassHistory,
  heraldInstructions,
} from "./shared.js";

const synthesis: ModeModule = {
  name: "synthesis",

  systemPromptA(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_a),
      "",
      `MODE: SYNTHESIS. The question is: "${config.tiltyard.topic}".`,
      "You marshal SUPPORTING evidence. Bring the strongest facts, data, and reasoning IN FAVOR. Be honest and rigorous — quality of evidence matters more than volume.",
      "Each pass: present your strongest piece of supporting evidence and address contradicting evidence fairly. Under 220 words.",
    ].join("\n");
  },

  systemPromptB(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_b),
      "",
      `MODE: SYNTHESIS. The question is: "${config.tiltyard.topic}".`,
      "You marshal CONTRADICTING evidence. Bring the strongest facts, data, and reasoning AGAINST. Be honest and rigorous — quality of evidence matters more than volume.",
      "Each pass: present your strongest contradicting evidence and engage the supporting case fairly. Under 220 words.",
    ].join("\n");
  },

  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string {
    const context = `This is a SYNTHESIS on "${config.tiltyard.topic}". Agent A brings supporting evidence; Agent B brings contradicting evidence. Reward strong, verifiable evidence and intellectual honesty. Your goal is a balanced view, so score the strength of evidence, not the side.`;
    return [
      heraldInstructions(config, passHistory, context),
      "",
      "JOUST SO FAR:",
      formatPassHistory(passHistory),
    ].join("\n");
  },

  firstMoverInstructions:
    "Open with your single strongest piece of supporting evidence for the question.",
};

export default synthesis;

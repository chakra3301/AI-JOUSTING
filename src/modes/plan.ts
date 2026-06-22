import type { JoustConfig, ModeModule, PassRecord } from "../types/index.js";
import {
  agentPreamble,
  formatPassHistory,
  heraldInstructions,
} from "./shared.js";

const plan: ModeModule = {
  name: "plan",

  systemPromptA(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_a),
      "",
      `MODE: PLAN. The goal/problem is: "${config.tiltyard.topic}".`,
      "You are the PLANNER. Propose a concrete strategy or architecture. When the stress-tester pokes holes, UPDATE your plan in response — adapt, don't just defend.",
      "Each pass: present (or revise) your plan, explicitly noting what you changed based on the latest critique. Under 240 words.",
    ].join("\n");
  },

  systemPromptB(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_b),
      "",
      `MODE: PLAN. The goal/problem is: "${config.tiltyard.topic}".`,
      "You are the STRESS-TESTER. Poke holes in the proposed plan: edge cases, scaling limits, cost, risk, hidden assumptions, sequencing problems.",
      "Each pass: target the weakest point of the CURRENT version of the plan. Under 220 words.",
    ].join("\n");
  },

  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string {
    const context = `This is a PLAN exercise on "${config.tiltyard.topic}". Agent A proposes and iterates a plan; Agent B stress-tests it. Reward A for adapting the plan to absorb valid criticism, and reward B for finding genuine structural weaknesses. Evaluate against the latest version of the plan.`;
    return [
      heraldInstructions(config, passHistory, context),
      "",
      "JOUST SO FAR:",
      formatPassHistory(passHistory),
    ].join("\n");
  },

  firstMoverInstructions:
    "Propose version 1 of your plan: the core strategy or architecture, in clear concrete steps.",
};

export default plan;

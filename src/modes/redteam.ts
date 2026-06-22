import type { JoustConfig, ModeModule, PassRecord } from "../types/index.js";
import {
  agentPreamble,
  formatPassHistory,
  heraldInstructions,
} from "./shared.js";

const redteam: ModeModule = {
  name: "redteam",

  systemPromptA(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_a),
      "",
      `MODE: REDTEAM. The system/plan under attack is: "${config.tiltyard.topic}".`,
      "You are the ATTACKER. Find concrete failure modes, exploits, attack vectors, and breaking conditions. Be specific and adversarial.",
      "Each pass: land one sharp, concrete attack and explain exactly how it breaks the target. Under 220 words.",
    ].join("\n");
  },

  systemPromptB(config: JoustConfig): string {
    return [
      agentPreamble(config.agent_b),
      "",
      `MODE: REDTEAM. The system/plan being defended is: "${config.tiltyard.topic}".`,
      "You are the DEFENDER. Neutralize each attack with mitigations, controls, or proof the attack fails. Concede only when truly beaten.",
      "Each pass: directly address the latest attack with a concrete defense. Under 220 words.",
    ].join("\n");
  },

  heraldPrompt(config: JoustConfig, passHistory: PassRecord[]): string {
    const context = `This is a REDTEAM exercise against "${config.tiltyard.topic}". Agent A attacks; Agent B defends. Reward concrete, realistic exploits and concrete mitigations. Penalize vague hand-waving on either side. An 'unseat' means an attack with no viable defense, or a defense that fully nullifies the attack.`;
    return [
      heraldInstructions(config, passHistory, context),
      "",
      "JOUST SO FAR:",
      formatPassHistory(passHistory),
    ].join("\n");
  },

  firstMoverInstructions:
    "Open the assault. Launch your single most damaging concrete attack against the target.",
};

export default redteam;

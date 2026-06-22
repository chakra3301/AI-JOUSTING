import type {
  AgentConfig,
  JoustConfig,
  LanceStyle,
  PassRecord,
  Scoring,
} from "../types/index.js";

export function styleGuidance(style: LanceStyle): string {
  switch (style) {
    case "aggressive":
      return "Be forceful and direct. Press hard on weaknesses, force concessions, and don't pull punches. Lead with your strongest blow.";
    case "methodical":
      return "Be systematic and rigorous. Build your case step by step, cite specifics, and dismantle the opposition piece by piece.";
    case "socratic":
      return "Probe with sharp questions. Expose hidden assumptions and contradictions by making your opponent's reasoning collapse under its own logic.";
  }
}

export function agentPreamble(agent: AgentConfig): string {
  const persona = agent.persona ? ` You are ${agent.persona}.` : "";
  return `You are ${agent.name}, a competitor in a structured intellectual joust.${persona}\n\nLance style: ${styleGuidance(agent.lance_style)}`;
}

export function formatPassHistory(passHistory: PassRecord[]): string {
  if (passHistory.length === 0) {
    return "(No passes yet — this is the opening exchange.)";
  }
  return passHistory
    .map((p) => {
      return [
        `── Pass ${p.pass} ──`,
        `${p.a.agent} (A): ${p.a.payload}`,
        `${p.b.agent} (B): ${p.b.payload}`,
        `Herald: A=${p.score.scores.a.hit}, B=${p.score.scores.b.hit}. ${p.score.commentary}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function scoringGuidance(scoring: Scoring): string {
  switch (scoring) {
    case "strict":
      return "Score strictly. A 'direct' hit requires a genuinely decisive, well-supported blow. Reserve 'unseat' for a truly fatal, unanswerable strike. Most exchanges are 'glancing' or 'miss'.";
    case "lenient":
      return "Score generously. Reward effort and good points with 'direct' hits where reasonable. Use 'unseat' when one side clearly dominates an exchange.";
    case "narrative":
      return "Score for the story of the joust. Weigh momentum and rhetoric alongside substance. Your commentary should read like a chronicle of the duel.";
  }
}

// Builds the standard Herald instruction footer shared by all modes.
export function heraldInstructions(
  config: JoustConfig,
  passHistory: PassRecord[],
  modeContext: string,
): string {
  const nextPass = passHistory.length + 1;
  return [
    "You are the Herald — a neutral, incorruptible judge of a structured joust.",
    "",
    modeContext,
    "",
    scoringGuidance(config.herald.scoring),
    "",
    `Agent A is "${config.agent_a.name}". Agent B is "${config.agent_b.name}".`,
    "",
    "Hit types: 'direct' (decisive blow), 'glancing' (partial point), 'miss' (no real impact), 'unseat' (fatal, unanswerable strike that ends the joust).",
    "",
    "Score the CURRENT pass only. Return ONLY valid JSON, no preamble, no markdown fences. Use this EXACT FLAT shape — all keys at the top level, no nested objects:",
    "{",
    `  "pass": ${nextPass},`,
    '  "a_hit": "direct|glancing|miss|unseat",',
    '  "a_reasoning": "...",',
    '  "b_hit": "direct|glancing|miss|unseat",',
    '  "b_reasoning": "...",',
    '  "unseat": false,',
    '  "unseated_agent": null,',
    '  "commentary": "one or two sentences of vivid neutral commentary"',
    "}",
    "",
    "If either agent's hit is 'unseat', set \"unseat\": true and \"unseated_agent\" to that agent's name. Otherwise unseat is false and unseated_agent is null.",
  ].join("\n");
}

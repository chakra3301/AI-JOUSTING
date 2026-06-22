import chalk from "chalk";
import { color, cols, wrap } from "./theme.js";
import type { JoustConfig, JoustResult } from "../types/index.js";

export function renderSummary(
  config: JoustConfig,
  result: JoustResult,
): string {
  const width = Math.min(cols(), 92);
  const lines: string[] = [];

  lines.push("");
  if (result.winner === "Draw") {
    lines.push(chalk.bold.white("   ⚑  The joust ends in a DRAW."));
  } else {
    lines.push(
      chalk.bold.white("   🏆  WINNER: ") + chalk.bold.green(result.winner),
    );
  }
  lines.push(
    color.ui(
      `   Hits — ${config.agent_a.name}: ${result.total_hits.a}   ·   ${config.agent_b.name}: ${result.total_hits.b}`,
    ),
  );

  if (result.synthesis) {
    lines.push("");
    lines.push(color.herald.bold("⚖  Herald's synthesis"));
    lines.push(color.herald(wrap(result.synthesis, width, "   ")));
  }

  return lines.join("\n");
}

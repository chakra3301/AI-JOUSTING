import chalk from "chalk";
import { color, cols, hitLabel, wrap } from "./theme.js";
import { countHits } from "../core/herald.js";
import type { JoustConfig, PassRecord, PassScore } from "../types/index.js";

// Pip track: ● = hit weight scored, ○ = empty slot.
export function pipTrack(name: string, hits: number, slots: number): string {
  const filled = Math.min(hits, slots);
  const pips =
    chalk.bold.green("●".repeat(filled)) +
    color.ui("○".repeat(Math.max(0, slots - filled)));
  return `${name} ${pips}`;
}

// Renders the Herald's score for a pass, plus the running pip track.
export function renderScore(
  config: JoustConfig,
  score: PassScore,
  history: PassRecord[],
): string {
  const width = Math.min(cols(), 92);
  const lines: string[] = [];

  lines.push(color.herald.bold("⚖  Herald scores the pass"));
  lines.push(
    `   ${config.agent_a.name}: ${hitLabel(score.scores.a.hit)} — ${color.ui(
      score.scores.a.reasoning,
    )}`,
  );
  lines.push(
    `   ${config.agent_b.name}: ${hitLabel(score.scores.b.hit)} — ${color.ui(
      score.scores.b.reasoning,
    )}`,
  );
  lines.push("");
  lines.push(color.herald(wrap(score.commentary, width, "   ")));

  // Running pip track based on cumulative hit weight.
  const totals = countHits(history);
  const slots = config.tiltyard.passes * 2; // max weight roughly per side
  lines.push("");
  lines.push(
    "   " +
      pipTrack(config.agent_a.name, totals.a, slots) +
      color.ui("   vs   ") +
      pipTrack(config.agent_b.name, totals.b, slots),
  );

  return lines.join("\n");
}

export function renderUnseat(score: PassScore): string {
  const banner = [
    "",
    chalk.bold.red("   ╔══════════════════════════════════╗"),
    chalk.bold.red("   ║   ⚡  U N S E A T E D !  ⚡        ║"),
    chalk.bold.red("   ╚══════════════════════════════════╝"),
    chalk.bold.yellow(`   ${score.unseated_agent} is thrown from the saddle!`),
    "",
  ];
  return banner.join("\n");
}

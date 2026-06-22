import { readJoustFile } from "../core/joustFile.js";
import { renderPass, renderPassHeader } from "../display/passView.js";
import { renderScore, renderUnseat } from "../display/scoreView.js";
import { renderSummary } from "../display/summaryView.js";
import { printSplash } from "../display/splash.js";
import { color, separator } from "../display/theme.js";

export interface ReplayOptions {
  speed?: string; // "1" | "2" | "3"
}

const SPEED_DELAY: Record<string, number> = {
  "1": 1200, // slow
  "2": 600, // medium
  "3": 0, // instant
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function replayCommand(
  version: string,
  file: string,
  options: ReplayOptions,
): Promise<void> {
  printSplash(version);

  const joust = readJoustFile(file);
  const config = joust.config;
  const delay = SPEED_DELAY[options.speed ?? "2"] ?? 600;
  const w = (s: string) => process.stdout.write(s + "\n");

  w(
    color.ui(`Replaying ${joust.id} · ${config.tiltyard.mode} · `) +
      color.agentA(config.agent_a.name) +
      color.ui(" vs ") +
      color.agentB(config.agent_b.name),
  );
  w(color.ui(`Topic: ${config.tiltyard.topic}`));
  w(separator());

  const total = config.tiltyard.passes;
  const history: typeof joust.passes = [];

  for (const p of joust.passes) {
    w(renderPassHeader(p.pass, total));
    await sleep(delay);

    w(renderPass("a", p.a));
    w("");
    await sleep(delay);

    w(renderPass("b", p.b));
    w("");
    await sleep(delay);

    history.push(p);
    w(renderScore(config, p.score, history));
    w(separator());
    await sleep(delay);

    if (p.score.unseat) {
      w(renderUnseat(p.score));
      break;
    }
  }

  w(renderSummary(config, joust.result));
  w("");
}

import { loadConfig, ConfigError } from "../config/loader.js";
import { runJoust } from "../core/orchestrator.js";
import { writeJoustFile } from "../core/joustFile.js";
import { getMode } from "../modes/index.js";
import { createRenderer } from "../display/renderer.js";
import { printSplash } from "../display/splash.js";
import { color, separator } from "../display/theme.js";
import type { Mode } from "../types/index.js";

export interface JoustOptions {
  config?: string;
  topic?: string;
  passes?: string;
  mode?: Mode;
  dryRun?: boolean;
  save?: boolean;
}

export async function joustCommand(
  version: string,
  options: JoustOptions,
): Promise<void> {
  printSplash(version);

  const config = loadConfig(options.config, {
    topic: options.topic,
    passes: options.passes ? Number(options.passes) : undefined,
    mode: options.mode,
  });

  if (options.save === false) config.tiltyard.save = false;

  // Header line describing the matchup.
  process.stdout.write(
    color.ui(
      `${config.tiltyard.mode.toUpperCase()} · ${config.tiltyard.passes} passes\n`,
    ) +
      color.agentA(config.agent_a.name) +
      color.ui("  vs  ") +
      color.agentB(config.agent_b.name) +
      color.ui(`\nTopic: ${config.tiltyard.topic}\n`),
  );
  process.stdout.write(separator() + "\n");

  if (options.dryRun) {
    renderDryRun(config);
    return;
  }

  const renderer = createRenderer(config);
  const { passes, result } = await runJoust(config, renderer);

  if (config.tiltyard.save) {
    const { path } = writeJoustFile(config, passes, result);
    process.stdout.write(color.ui(`Saved replay → ${path}\n`));
  }
}

function renderDryRun(config: ReturnType<typeof loadConfig>): void {
  const mode = getMode(config.tiltyard.mode);
  const w = (s: string) => process.stdout.write(s + "\n");

  w(color.ui("\n[dry run] No API calls will be made.\n"));
  w(color.ui("Resolved config:"));
  w(JSON.stringify(config, null, 2));
  w("");
  w(color.agentA(`── System prompt: ${config.agent_a.name} (A) ──`));
  w(mode.systemPromptA(config));
  w("");
  w(color.agentB(`── System prompt: ${config.agent_b.name} (B) ──`));
  w(mode.systemPromptB(config));
  w("");
  w(color.herald("── First mover instructions ──"));
  w(mode.firstMoverInstructions);
}

export { ConfigError };

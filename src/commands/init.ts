import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { defaultTomlTemplate } from "../config/defaults.js";
import { DEFAULT_CONFIG_FILENAME } from "../config/loader.js";
import { color } from "../display/theme.js";
import { printSplash } from "../display/splash.js";
import type { Mode } from "../types/index.js";

export interface InitOptions {
  topic?: string;
  mode?: Mode;
  force?: boolean;
}

const VALID_MODES: Mode[] = [
  "debate",
  "redteam",
  "review",
  "synthesis",
  "plan",
];

export async function initCommand(
  version: string,
  options: InitOptions,
): Promise<void> {
  printSplash(version);

  const target = resolve(DEFAULT_CONFIG_FILENAME);
  if (existsSync(target) && !options.force) {
    process.stdout.write(
      color.ui(
        `jousting.toml already exists at ${target}. Use --force to overwrite.\n`,
      ),
    );
    return;
  }

  let topic = options.topic;
  let mode: Mode = options.mode ?? "debate";

  // Interactive prompt for topic if not provided and we have a TTY.
  if (!topic && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question(
        color.ui("What should the agents joust over? "),
      );
      topic = answer.trim() || undefined;
      if (!options.mode) {
        const m = (
          await rl.question(
            color.ui(`Mode [${VALID_MODES.join("|")}] (debate): `),
          )
        ).trim();
        if (m && VALID_MODES.includes(m as Mode)) mode = m as Mode;
      }
    } finally {
      rl.close();
    }
  }

  const toml = defaultTomlTemplate(
    topic ?? "Should we rewrite this in Rust?",
    mode,
  );
  writeFileSync(target, toml, "utf8");

  process.stdout.write(
    color.ui(`\nScaffolded `) +
      color.herald(DEFAULT_CONFIG_FILENAME) +
      color.ui(` at ${target}\n`) +
      color.ui(`Run `) +
      color.agentA("joustx joust") +
      color.ui(` to begin.\n`),
  );
}

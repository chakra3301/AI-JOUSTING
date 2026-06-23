import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { color } from "../display/theme.js";
import { ConfigError } from "../config/loader.js";
import { initCommand } from "../commands/init.js";
import { joustCommand } from "../commands/joust.js";
import { tournamentCommand } from "../commands/tournament.js";
import { replayCommand } from "../commands/replay.js";
import { heraldCommand } from "../commands/herald.js";
import type { Mode, Scoring } from "../types/index.js";

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/cli/index.js -> ../../package.json ; src/cli/index.ts -> ../../package.json
    const pkg = JSON.parse(
      readFileSync(join(here, "..", "..", "package.json"), "utf8"),
    );
    return pkg.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(color.agentB(`\n✖ ${msg}\n`));
  process.exit(1);
}

async function main(): Promise<void> {
  const version = readVersion();
  const program = new Command();

  program
    .name("joustx")
    .description(
      "AI agents charge at each other in structured passes. One winner.",
    )
    .version(version, "-v, --version")
    .option("--no-splash", "skip the startup splash screen")
    .option(
      "--use-subscription",
      "authenticate with your Claude Pro/Max subscription (Claude Code OAuth) " +
        "instead of ANTHROPIC_API_KEY — personal use only, may violate Anthropic's ToS",
    );

  // Opt-in to subscription auth. Surfaced as an env var so the adapter layer
  // (which has no CLI context) can pick it up, and gated behind a clear warning.
  program.hook("preAction", (thisCommand) => {
    if (thisCommand.opts().useSubscription) {
      process.env.JOUSTING_USE_CLAUDE_SUB = "1";
      process.stderr.write(
        color.agentB(
          "\n⚠  Using your Claude subscription (OAuth) for inference.\n" +
            "   This is for personal use and may violate Anthropic's Terms of Service.\n\n",
        ),
      );
    }
  });

  program
    .command("init")
    .description("scaffold a jousting.toml in the current directory")
    .option("--topic <topic>", "the topic to joust over")
    .option("--mode <mode>", "debate|redteam|review|synthesis|plan")
    .option("--force", "overwrite an existing jousting.toml")
    .action(async (opts) => {
      await initCommand(version, {
        topic: opts.topic,
        mode: opts.mode as Mode | undefined,
        force: opts.force,
      });
    });

  program
    .command("joust")
    .description("run a single joust")
    .option("--config <path>", "path to a config file")
    .option("--topic <topic>", "override the topic")
    .option("--passes <n>", "override the number of passes")
    .option("--mode <mode>", "override the mode")
    .option("--dry-run", "print resolved config and prompts, no API calls")
    .option("--no-save", "do not write a .joust replay file")
    .action(async (opts) => {
      await joustCommand(version, {
        config: opts.config,
        topic: opts.topic,
        passes: opts.passes,
        mode: opts.mode as Mode | undefined,
        dryRun: opts.dryRun,
        save: opts.save,
      });
    });

  program
    .command("tournament")
    .description("run a bracket of agents from a [tournament] config block")
    .option("--config <path>", "path to a config file")
    .option("--topic <topic>", "override the topic")
    .option("--passes <n>", "override the passes per match")
    .option("--mode <mode>", "override the mode")
    .action(async (opts) => {
      await tournamentCommand(version, {
        config: opts.config,
        topic: opts.topic,
        passes: opts.passes,
        mode: opts.mode as Mode | undefined,
      });
    });

  program
    .command("replay")
    .description("replay a saved .joust file to the terminal")
    .argument("<file>", "path to a .joust file")
    .option("--speed <1|2|3>", "replay pace (1 slow, 2 medium, 3 instant)", "2")
    .action(async (file, opts) => {
      await replayCommand(version, file, { speed: opts.speed });
    });

  program
    .command("herald")
    .description("re-run Herald scoring on a saved .joust file")
    .argument("<file>", "path to a .joust file")
    .option("--model <model>", "score with a different model")
    .option("--scoring <mode>", "strict|lenient|narrative")
    .option("--save", "write a new .joust file with the re-scored result")
    .action(async (file, opts) => {
      await heraldCommand(version, file, {
        model: opts.model,
        scoring: opts.scoring as Scoring | undefined,
        save: opts.save,
      });
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  if (err instanceof ConfigError) fail(err);
  fail(err);
});

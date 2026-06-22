import { loadConfig } from "../config/loader.js";
import { runTournament } from "../core/tournament.js";
import { createRenderer } from "../display/renderer.js";
import { printSplash } from "../display/splash.js";
import { color, separator } from "../display/theme.js";
import type { AgentConfig, JoustConfig, Mode } from "../types/index.js";

export interface TournamentOptions {
  config?: string;
  topic?: string;
  passes?: string;
  mode?: Mode;
}

export async function tournamentCommand(
  version: string,
  options: TournamentOptions,
): Promise<void> {
  printSplash(version);

  const config = loadConfig(options.config, {
    topic: options.topic,
    passes: options.passes ? Number(options.passes) : undefined,
    mode: options.mode,
  });

  if (!config.tournament) {
    process.stdout.write(
      color.ui(
        "No [tournament] block found in config. Add one with a list of agents:\n\n",
      ) +
        color.ui(
          "[tournament]\nformat = \"roundrobin\"\n\n[[tournament.agents]]\nname = \"Lancer\"\n...\n",
        ),
    );
    process.exitCode = 1;
    return;
  }

  const w = (s: string) => process.stdout.write(s + "\n");
  w(
    color.ui(
      `TOURNAMENT · ${config.tournament.format} · ${config.tournament.agents.length} agents · ${config.tiltyard.passes} passes`,
    ),
  );
  w(color.ui(`Topic: ${config.tiltyard.topic}`));
  w(separator());

  const result = await runTournament(config, {
    onMatchStart(a: AgentConfig, b: AgentConfig, round: number) {
      w("");
      w(
        color.ui(`▣ Round ${round}: `) +
          color.agentA(a.name) +
          color.ui(" vs ") +
          color.agentB(b.name),
      );
      w(separator());
    },
    onMatchEnd(match) {
      w(
        color.ui("   → winner: ") +
          color.herald(match.winner) +
          color.ui(
            `  (${match.result.total_hits.a}–${match.result.total_hits.b})`,
          ),
      );
    },
    joustReporter(a: AgentConfig, b: AgentConfig) {
      const matchConfig: JoustConfig = {
        ...config,
        agent_a: a,
        agent_b: b,
      };
      return createRenderer(matchConfig);
    },
  });

  // Final standings.
  w("");
  w(separator());
  w(color.herald.bold(`🏆 CHAMPION: ${result.champion}`));
  w("");
  w(color.ui("Standings:"));
  for (const s of result.standings) {
    w(
      color.ui(
        `   ${s.agent.name.padEnd(16)}  ${s.wins}W  ${s.losses}L  ${s.draws}D`,
      ),
    );
  }
}

import { runJoust, type JoustReporter } from "./orchestrator.js";
import type {
  AgentConfig,
  JoustConfig,
  PassRecord,
  JoustResult,
} from "../types/index.js";

export interface Matchup {
  a: AgentConfig;
  b: AgentConfig;
}

export interface MatchResult {
  a: AgentConfig;
  b: AgentConfig;
  winner: string;
  passes: PassRecord[];
  result: JoustResult;
}

export interface Standing {
  agent: AgentConfig;
  wins: number;
  losses: number;
  draws: number;
}

export interface TournamentResult {
  format: "elimination" | "roundrobin";
  matches: MatchResult[];
  standings: Standing[];
  champion: string;
}

export interface TournamentReporter {
  onMatchStart?(a: AgentConfig, b: AgentConfig, round: number): void;
  onMatchEnd?(match: MatchResult): void;
  joustReporter?(a: AgentConfig, b: AgentConfig): JoustReporter;
}

// Builds a single-joust config for one matchup, inheriting tiltyard + herald.
function matchConfig(
  base: JoustConfig,
  a: AgentConfig,
  b: AgentConfig,
): JoustConfig {
  return {
    tiltyard: { ...base.tiltyard },
    agent_a: a,
    agent_b: b,
    herald: { ...base.herald },
  };
}

async function playMatch(
  base: JoustConfig,
  a: AgentConfig,
  b: AgentConfig,
  reporter: TournamentReporter,
  round: number,
): Promise<MatchResult> {
  reporter.onMatchStart?.(a, b, round);
  const cfg = matchConfig(base, a, b);
  const jr = reporter.joustReporter?.(a, b) ?? {};
  const { passes, result } = await runJoust(cfg, jr);
  const match: MatchResult = { a, b, winner: result.winner, passes, result };
  reporter.onMatchEnd?.(match);
  return match;
}

function emptyStanding(agent: AgentConfig): Standing {
  return { agent, wins: 0, losses: 0, draws: 0 };
}

function recordResult(
  standings: Map<string, Standing>,
  match: MatchResult,
): void {
  const sa = standings.get(match.a.name)!;
  const sb = standings.get(match.b.name)!;
  if (match.winner === match.a.name) {
    sa.wins++;
    sb.losses++;
  } else if (match.winner === match.b.name) {
    sb.wins++;
    sa.losses++;
  } else {
    sa.draws++;
    sb.draws++;
  }
}

export async function runTournament(
  config: JoustConfig,
  reporter: TournamentReporter = {},
): Promise<TournamentResult> {
  const tournament = config.tournament;
  if (!tournament) {
    throw new Error(
      "Tournament mode requires a [tournament] block with an agents list in your config.",
    );
  }

  const agents = tournament.agents;
  const standings = new Map<string, Standing>();
  for (const agent of agents) standings.set(agent.name, emptyStanding(agent));

  const matches: MatchResult[] =
    tournament.format === "roundrobin"
      ? await runRoundRobin(config, agents, reporter, standings)
      : await runElimination(config, agents, reporter, standings);

  const sorted = [...standings.values()].sort(
    (x, y) => y.wins - x.wins || x.losses - y.losses,
  );

  const champion =
    tournament.format === "elimination"
      ? (matches[matches.length - 1]?.winner ?? "Draw")
      : (sorted[0]?.agent.name ?? "Draw");

  return {
    format: tournament.format,
    matches,
    standings: sorted,
    champion,
  };
}

async function runRoundRobin(
  config: JoustConfig,
  agents: AgentConfig[],
  reporter: TournamentReporter,
  standings: Map<string, Standing>,
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  let round = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      round++;
      const match = await playMatch(
        config,
        agents[i]!,
        agents[j]!,
        reporter,
        round,
      );
      matches.push(match);
      recordResult(standings, match);
    }
  }
  return matches;
}

async function runElimination(
  config: JoustConfig,
  agents: AgentConfig[],
  reporter: TournamentReporter,
  standings: Map<string, Standing>,
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  let round = 0;
  let bracket = [...agents];

  while (bracket.length > 1) {
    round++;
    const next: AgentConfig[] = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i]!;
      const b = bracket[i + 1];
      if (!b) {
        // Odd one out gets a bye.
        next.push(a);
        continue;
      }
      const match = await playMatch(config, a, b, reporter, round);
      matches.push(match);
      recordResult(standings, match);
      // Winner advances; a draw advances agent A by convention.
      next.push(match.winner === b.name ? b : a);
    }
    bracket = next;
  }

  return matches;
}

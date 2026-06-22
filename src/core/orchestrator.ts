import { Agent } from "./agent.js";
import { Herald, countHits, declareWinner } from "./herald.js";
import type {
  JoustConfig,
  JoustResult,
  PassRecord,
  PassScore,
  Payload,
} from "../types/index.js";

// Event hooks the orchestrator calls so the display layer can render live.
// All are optional and synchronous.
export interface JoustReporter {
  onPassStart?(pass: number, total: number): void;
  onCharge?(payload: Payload): void;
  onCounter?(payload: Payload): void;
  onScore?(score: PassScore, history: PassRecord[]): void;
  onUnseat?(score: PassScore): void;
  onSynthesisStart?(): void;
  onResult?(result: JoustResult, history: PassRecord[]): void;
  // status spinner hooks
  thinking?(label: string): void;
  thinkingDone?(): void;
}

export interface JoustRunResult {
  passes: PassRecord[];
  result: JoustResult;
}

export async function runJoust(
  config: JoustConfig,
  reporter: JoustReporter = {},
): Promise<JoustRunResult> {
  const agentA = new Agent("a", config);
  const agentB = new Agent("b", config);
  const herald = new Herald(config);

  const passHistory: PassRecord[] = [];
  const total = config.tiltyard.passes;

  for (let i = 1; i <= total; i++) {
    reporter.onPassStart?.(i, total);

    reporter.thinking?.(`${config.agent_a.name} charges…`);
    const a = await agentA.charge(passHistory);
    reporter.thinkingDone?.();
    reporter.onCharge?.(a);

    reporter.thinking?.(`${config.agent_b.name} counters…`);
    const b = await agentB.counter(passHistory, a);
    reporter.thinkingDone?.();
    reporter.onCounter?.(b);

    reporter.thinking?.("The Herald scores the pass…");
    const score = await herald.score(passHistory, a, b);
    reporter.thinkingDone?.();
    reporter.onScore?.(score, [...passHistory, { pass: i, a, b, score }]);

    passHistory.push({ pass: i, a, b, score });

    if (score.unseat) {
      reporter.onUnseat?.(score);
      break;
    }
  }

  let result: JoustResult;
  if (config.herald.synthesize) {
    reporter.onSynthesisStart?.();
    reporter.thinking?.("The Herald delivers the verdict…");
    result = await herald.synthesize(passHistory);
    reporter.thinkingDone?.();
  } else {
    const totals = countHits(passHistory);
    result = {
      winner: declareWinner(config, passHistory, totals),
      synthesis: "",
      total_hits: totals,
    };
  }

  reporter.onResult?.(result, passHistory);

  return { passes: passHistory, result };
}

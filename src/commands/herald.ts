import { readJoustFile, writeJoustFile } from "../core/joustFile.js";
import { Herald } from "../core/herald.js";
import { renderScore } from "../display/scoreView.js";
import { renderSummary } from "../display/summaryView.js";
import { printSplash } from "../display/splash.js";
import { color, separator } from "../display/theme.js";
import type { JoustConfig, PassRecord, Scoring } from "../types/index.js";

export interface HeraldOptions {
  model?: string;
  scoring?: Scoring;
  save?: boolean;
}

// Re-runs Herald scoring on a saved joust, optionally with a different model
// or scoring mode. Useful for re-evaluating an old joust.
export async function heraldCommand(
  version: string,
  file: string,
  options: HeraldOptions,
): Promise<void> {
  printSplash(version);

  const joust = readJoustFile(file);

  // Build a config with optional herald overrides.
  const config: JoustConfig = {
    ...joust.config,
    herald: {
      ...joust.config.herald,
      model: options.model ?? joust.config.herald.model,
      scoring: options.scoring ?? joust.config.herald.scoring,
    },
  };

  const herald = new Herald(config);
  const w = (s: string) => process.stdout.write(s + "\n");

  w(
    color.ui(
      `Re-scoring ${joust.id} with ${config.herald.model} (${config.herald.scoring})`,
    ),
  );
  w(separator());

  const rescored: PassRecord[] = [];
  for (const p of joust.passes) {
    const score = await herald.score(rescored, p.a, p.b);
    const record: PassRecord = { pass: p.pass, a: p.a, b: p.b, score };
    rescored.push(record);
    w(renderScore(config, score, rescored));
    w(separator());
    if (score.unseat) break;
  }

  const result = await herald.synthesize(rescored);
  w(renderSummary(config, result));
  w("");

  if (options.save) {
    const { path } = writeJoustFile(config, rescored, result);
    w(color.ui(`Saved re-scored joust → ${path}`));
  }
}

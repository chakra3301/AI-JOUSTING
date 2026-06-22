import ora, { type Ora } from "ora";
import { separator, color } from "./theme.js";
import { renderPass, renderPassHeader } from "./passView.js";
import { renderScore, renderUnseat } from "./scoreView.js";
import { renderSummary } from "./summaryView.js";
import type { JoustReporter } from "../core/orchestrator.js";
import type { JoustConfig } from "../types/index.js";

function out(s: string): void {
  process.stdout.write(s + "\n");
}

// Builds a live TTY reporter for a single joust.
export function createRenderer(config: JoustConfig): JoustReporter {
  let spinner: Ora | null = null;
  const interactive = process.stdout.isTTY === true;

  return {
    onPassStart(pass, total) {
      out(renderPassHeader(pass, total));
    },
    onCharge(payload) {
      out(renderPass("a", payload));
      out("");
    },
    onCounter(payload) {
      out(renderPass("b", payload));
      out("");
    },
    onScore(score, history) {
      out(renderScore(config, score, history));
      out(separator());
    },
    onUnseat(score) {
      out(renderUnseat(score));
    },
    onSynthesisStart() {
      out("");
    },
    onResult(result) {
      out(renderSummary(config, result));
      out("");
    },
    thinking(label) {
      if (interactive) {
        spinner = ora({ text: color.ui(label), color: "gray" }).start();
      } else {
        out(color.ui(`… ${label}`));
      }
    },
    thinkingDone() {
      if (spinner) {
        spinner.stop();
        spinner = null;
      }
    },
  };
}

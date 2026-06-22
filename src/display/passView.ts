import { color, cols, wrap } from "./theme.js";
import type { Payload } from "../types/index.js";
import type { Side } from "../core/agent.js";

// Renders a single agent's payload within a pass.
export function renderPass(side: Side, payload: Payload): string {
  const c = side === "a" ? color.agentA : color.agentB;
  const marker = side === "a" ? "⚔" : "🛡";
  const lance = side === "a" ? "charges" : "counters";
  const width = Math.min(cols(), 92);

  const header = c.bold(`${marker} ${payload.agent} ${lance}`);
  const body = wrap(payload.payload, width, "   ");
  return `${header}\n${c(body)}`;
}

export function renderPassHeader(pass: number, total: number): string {
  const width = cols();
  const label = ` ⚔  PASS ${pass} OF ${total}  ⚔ `;
  const pad = Math.max(0, Math.floor((Math.min(width, 60) - label.length) / 2));
  const line = " ".repeat(pad) + label;
  return "\n" + color.ui.bold(line) + "\n";
}

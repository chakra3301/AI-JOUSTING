import chalk from "chalk";
import type { HitType } from "../types/index.js";

export const color = {
  agentA: chalk.hex("#7C3AED"), // purple
  agentB: chalk.hex("#DC2626"), // red
  herald: chalk.hex("#D97706"), // amber
  ui: chalk.hex("#6B7280"), // muted gray
  rule: chalk.hex("#374151"),
};

export function cols(): number {
  return process.stdout.columns || 60;
}

export function separator(): string {
  return color.rule("━".repeat(cols()));
}

export function hitLabel(hit: HitType): string {
  switch (hit) {
    case "direct":
      return chalk.bold.green("DIRECT HIT");
    case "glancing":
      return chalk.yellow("glancing");
    case "miss":
      return chalk.gray("miss");
    case "unseat":
      return chalk.bold.red("⚡ UNSEAT ⚡");
  }
}

export function hitColor(hit: HitType): (s: string) => string {
  switch (hit) {
    case "direct":
      return chalk.bold.green;
    case "glancing":
      return chalk.yellow;
    case "miss":
      return chalk.gray;
    case "unseat":
      return chalk.bold.red;
  }
}

// Word-wrap a block of text to the given width with an indent prefix.
export function wrap(text: string, width: number, indent = ""): string {
  const max = Math.max(20, width - indent.length);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line.length + word.length + 1 > max) {
        lines.push(indent + line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(indent + line);
  }
  return lines.join("\n");
}

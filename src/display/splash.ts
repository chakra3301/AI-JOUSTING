import chalk from "chalk";

// Splash palette — BLUE AND WHITE ONLY. The combat colours (amber/purple/red)
// are deliberately absent here; they belong to the joust itself.
const primary = chalk.hex("#2563EB"); // electric blue
const secondary = chalk.hex("#93C5FD"); // light blue
const bright = chalk.bold.white;
const navy = chalk.hex("#1E3A5F"); // deep navy, near-invisible
const meta = chalk.hex("#60A5FA"); // mid blue
const dim = chalk.hex("#1D4ED8");

// Mirror a half-row of dot art into its facing counterpart.
const MIRROR: Record<string, string> = {
  "▟": "▙",
  "▙": "▟",
  "▜": "▛",
  "▛": "▜",
  "▖": "▗",
  "▗": "▖",
  "▘": "▝",
  "▝": "▘",
  "/": "\\",
  "\\": "/",
  "(": ")",
  ")": "(",
  "<": ">",
  ">": "<",
  "[": "]",
  "]": "[",
};

function mirror(half: string): string {
  return [...half].reverse().map((c) => MIRROR[c] ?? c).join("");
}

// Left knight on horseback, facing RIGHT. Lance extends toward the centre on
// the lance row. Each row is a 28-column half; the right knight is its mirror.
// The dots that read as "dots" (· ░ ▪) are the secondary blue; blocks are primary.
const LEFT: string[] = [
  "             ▟▙             ",
  "            ▟██▙            ",
  "      ·     ████     ·      ",
  "     ░░    ▟████▙           ",
  "    ░███████████▙           ",
  "  ░████████████████▄▄▄▄▄▄▄▄▄",
  "    ░███████████▛           ",
  "       ▟██▛▜██▙             ",
  "      ▟██▛  ▜██▙            ",
  "   ▗▄████████████▄▖         ",
  "  ▟██████████████████▄      ",
  " ▟████████████████████▙▖    ",
  " ▜███▛▘        ▝▜███▛       ",
  "  ▀▀              ▀▀        ",
];

// Which row carries the lance crosspoint (0-indexed).
const LANCE_ROW = 5;

function colourHalf(half: string, isLeft: boolean): string {
  // Blocks → knight colour; dots → the lighter shade. Left knight blue,
  // right knight bright white.
  const block = isLeft ? primary : bright;
  const dot = isLeft ? secondary : chalk.white;
  return [...half]
    .map((ch) => {
      if (ch === " ") return " ";
      if (ch === "·" || ch === "░" || ch === "▪") return dot(ch);
      if (ch === "▄" || ch === "▀") return dot(ch);
      return block(ch);
    })
    .join("");
}

function buildArt(): string {
  const rows: string[] = [];
  for (let i = 0; i < LEFT.length; i++) {
    const left = colourHalf(LEFT[i]!, true);
    const right = colourHalf(mirror(LEFT[i]!), false);
    const centre = i === LANCE_ROW ? bright("✕") : navy("┊");
    rows.push("  " + left + centre + right);
  }
  return rows.join("\n");
}

function shouldSkip(): boolean {
  if (process.env.JOUSTING_NO_SPLASH === "1") return true;
  if (process.argv.includes("--no-splash")) return true;
  return false;
}

export function printSplash(version: string): void {
  if (shouldSkip()) return;

  const lines: string[] = [];
  lines.push("");
  lines.push(buildArt());
  lines.push("");
  lines.push(bright("        J O U S T I N G"));
  lines.push(meta("        AI agents. Structured combat. One winner."));
  lines.push(dim(`        v${version}  ·  npx jousting init`));
  lines.push("");
  lines.push(navy("━".repeat(process.stdout.columns || 60)));

  process.stdout.write(lines.join("\n") + "\n");
}

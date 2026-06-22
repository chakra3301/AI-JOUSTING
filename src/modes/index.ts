import type { Mode, ModeModule } from "../types/index.js";
import debate from "./debate.js";
import redteam from "./redteam.js";
import review from "./review.js";
import synthesis from "./synthesis.js";
import plan from "./plan.js";

export const modes: Record<Mode, ModeModule> = {
  debate,
  redteam,
  review,
  synthesis,
  plan,
};

export function getMode(mode: Mode): ModeModule {
  const mod = modes[mode];
  if (!mod) {
    throw new Error(
      `Unknown mode: ${mode}. Valid modes: ${Object.keys(modes).join(", ")}`,
    );
  }
  return mod;
}

export { debate, redteam, review, synthesis, plan };

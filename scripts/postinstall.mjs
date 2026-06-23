#!/usr/bin/env node
// Auto-link the `jousting` CLI globally after `npm install` in a cloned repo.
//
// Guards:
//  - Skips when jousting is installed as a dependency (inside node_modules).
//  - Skips in CI or when JOUSTING_NO_LINK=1 is set.
//  - Skips recursive invocation (npm link itself triggers lifecycle scripts).
//  - Never fails the install: link errors are warnings, not hard errors.

import { execSync } from "node:child_process";
import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// 1) Installed as a dependency of another project -> do nothing.
if (here.includes(`${sep}node_modules${sep}`)) process.exit(0);

// 2) Opt-outs and CI.
if (process.env.CI || process.env.JOUSTING_NO_LINK === "1") process.exit(0);

// 3) Prevent recursion: `npm link` re-runs lifecycle scripts.
if (process.env.JOUSTING_LINKING === "1") process.exit(0);

try {
  execSync("npm link", {
    stdio: "inherit",
    env: { ...process.env, JOUSTING_LINKING: "1" },
  });
  process.stdout.write(
    "\n✔ `jousting` linked globally. Try:  jousting init\n\n",
  );
} catch {
  process.stdout.write(
    "\n⚠ Could not auto-link `jousting` globally (likely a permissions issue).\n" +
      "  Run it manually:   npm link\n" +
      "  Or skip linking:   node dist/cli/index.js init\n\n",
  );
}

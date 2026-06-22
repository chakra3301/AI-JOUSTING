import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// How the Anthropic client should authenticate.
//  - "apikey": standard x-api-key billing (ANTHROPIC_API_KEY).
//  - "oauth": a Claude Pro/Max subscription OAuth token (Claude Code login).
export interface AnthropicAuth {
  mode: "apikey" | "oauth";
  token: string;
}

// First system block required for OAuth (subscription) requests. Without it the
// API rejects sk-ant-oat tokens. This mirrors how the official CLI authenticates.
export const CLAUDE_CODE_SPOOF =
  "You are Claude Code, Anthropic's official CLI for Claude.";

// Beta header that unlocks OAuth-token auth on the Messages API.
export const OAUTH_BETA = "oauth-2025-04-20";

interface OauthCreds {
  accessToken: string;
  expiresAt?: number;
}

// Pull the Claude Code OAuth token from wherever the CLI stored it:
// macOS keychain, then ~/.claude/.credentials.json (Linux/headless).
function readClaudeCodeOauth(): OauthCreds | null {
  // Explicit override wins.
  const envTok = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (envTok) return { accessToken: envTok };

  // macOS keychain.
  if (process.platform === "darwin") {
    try {
      const raw = execFileSync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const parsed = JSON.parse(raw)?.claudeAiOauth;
      if (parsed?.accessToken) {
        return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
      }
    } catch {
      // fall through to file
    }
  }

  // ~/.claude/.credentials.json
  try {
    const raw = readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8");
    const parsed = JSON.parse(raw)?.claudeAiOauth;
    if (parsed?.accessToken) {
      return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
    }
  } catch {
    // not present
  }

  return null;
}

// Resolve how to talk to Anthropic.
//   - By default, only ANTHROPIC_API_KEY (standard, metered billing) is used.
//   - Subscription OAuth is OPT-IN via `--use-subscription` (which sets
//     JOUSTING_USE_CLAUDE_SUB=1). It is never used silently because driving a
//     Pro/Max subscription outside the official client may violate the ToS.
// Returns null if no usable credentials are available.
export function resolveAnthropicAuth(): AnthropicAuth | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const preferSub = process.env.JOUSTING_USE_CLAUDE_SUB === "1";

  if (preferSub) {
    const oauth = readClaudeCodeOauth();
    if (oauth) {
      if (oauth.expiresAt && Date.now() > oauth.expiresAt) {
        throw new Error(
          "Claude subscription token has expired. Run any `claude` command " +
            "(or `claude /login`) to refresh it, then retry.",
        );
      }
      return { mode: "oauth", token: oauth.accessToken };
    }
    if (!apiKey) {
      throw new Error(
        "--use-subscription was set but no Claude Code login was found. " +
          "Run `claude /login` first, or set ANTHROPIC_API_KEY.",
      );
    }
  }

  if (apiKey) return { mode: "apikey", token: apiKey };
  return null;
}

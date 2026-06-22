import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
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

// Claude Code's public OAuth client id and token endpoints (it migrated from
// console.anthropic.com to platform.claude.com in Claude Code v2.1.81+).
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const TOKEN_ENDPOINTS = [
  "https://platform.claude.com/v1/oauth/token",
  "https://console.anthropic.com/v1/oauth/token",
];

// Refresh when the access token is within this window of expiring, so a long
// joust never expires mid-run.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const KEYCHAIN_SERVICE = "Claude Code-credentials";

// The full credential record as stored by Claude Code, plus where we read it
// from so we can write a refreshed token back to the same place.
export interface StoredOauth {
  record: Record<string, unknown>; // the { claudeAiOauth: {...} } wrapper
  oauth: Record<string, unknown>; // the inner claudeAiOauth object
  source: "keychain" | "file" | "env";
}

// Discover the keychain account name for the Claude Code item (defaults to the
// current user, which is what the CLI uses).
function keychainAccount(): string {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", KEYCHAIN_SERVICE],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const m = out.match(/"acct"<blob>="([^"]+)"/);
    if (m?.[1]) return m[1];
  } catch {
    // fall through
  }
  return userInfo().username;
}

const CRED_FILE = () => join(homedir(), ".claude", ".credentials.json");

// Pull the Claude Code OAuth record from wherever the CLI stored it.
function readStoredOauth(): StoredOauth | null {
  const envTok = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (envTok) {
    return {
      record: { claudeAiOauth: { accessToken: envTok } },
      oauth: { accessToken: envTok },
      source: "env",
    };
  }

  if (process.platform === "darwin") {
    try {
      const raw = execFileSync(
        "security",
        ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const record = JSON.parse(raw);
      if (record?.claudeAiOauth?.accessToken) {
        return { record, oauth: record.claudeAiOauth, source: "keychain" };
      }
    } catch {
      // fall through to file
    }
  }

  try {
    const record = JSON.parse(readFileSync(CRED_FILE(), "utf8"));
    if (record?.claudeAiOauth?.accessToken) {
      return { record, oauth: record.claudeAiOauth, source: "file" };
    }
  } catch {
    // not present
  }

  return null;
}

export interface RefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

// Synchronously exchange a refresh token for a fresh access token. Uses curl so
// it fits the existing synchronous auth-resolution path; the secret is passed on
// stdin (never argv) to keep it out of the process list. Tries the new endpoint
// first, falling back to the legacy one for older tokens.
function refreshTokenSync(refreshToken: string): RefreshResult {
  const body = JSON.stringify({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: OAUTH_CLIENT_ID,
  });

  let lastErr = "";
  for (const endpoint of TOKEN_ENDPOINTS) {
    try {
      const out = execFileSync(
        "curl",
        [
          "-sS",
          "-X",
          "POST",
          endpoint,
          "-H",
          "Content-Type: application/json",
          "-H",
          "Accept: application/json",
          "--max-time",
          "20",
          "--data-binary",
          "@-",
        ],
        { input: body, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
      const parsed = JSON.parse(out) as RefreshResult & { error?: string };
      if (parsed.access_token) return parsed;
      lastErr = parsed.error ? String(parsed.error) : out.slice(0, 200);
    } catch (err) {
      lastErr = String(err);
    }
  }
  throw new Error(`OAuth token refresh failed: ${lastErr}`);
}

// Re-read just the persisted refresh token straight from a given store, so we
// can confirm a write-back actually landed where Claude Code will look.
function readbackRefreshToken(source: StoredOauth["source"]): string | null {
  try {
    if (source === "keychain") {
      const raw = execFileSync(
        "security",
        ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const rt = JSON.parse(raw)?.claudeAiOauth?.refreshToken;
      return typeof rt === "string" ? rt : null;
    }
    if (source === "file") {
      const rt = JSON.parse(readFileSync(CRED_FILE(), "utf8"))?.claudeAiOauth
        ?.refreshToken;
      return typeof rt === "string" ? rt : null;
    }
  } catch {
    return null;
  }
  return null;
}

// Write an updated credential record back to its origin so the rotated refresh
// token survives and Claude Code itself keeps working.
//
// SAFETY: Anthropic rotates the refresh token on every refresh — the old one is
// dead the instant we call the endpoint. So if we can't durably persist the new
// one where Claude Code reads it, Claude Code is now broken. We therefore write,
// then READ BACK and verify, and THROW on any failure so the caller can warn the
// user loudly (instead of silently leaving them logged out everywhere).
function persistOauth(stored: StoredOauth): void {
  if (stored.source === "env") return; // nothing to write
  const serialized = JSON.stringify(stored.record);
  const expected =
    typeof stored.oauth.refreshToken === "string"
      ? stored.oauth.refreshToken
      : null;

  if (stored.source === "keychain") {
    execFileSync(
      "security",
      [
        "add-generic-password",
        "-U",
        "-a",
        keychainAccount(),
        "-s",
        KEYCHAIN_SERVICE,
        "-w",
        serialized,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } else {
    writeFileSync(CRED_FILE(), serialized + "\n", { mode: 0o600 });
  }

  // Verify the rotated refresh token is actually retrievable from the store.
  if (expected !== null && readbackRefreshToken(stored.source) !== expected) {
    throw new Error(
      `wrote credential to ${stored.source} but read-back did not match`,
    );
  }
}

// Resolve how to talk to Anthropic.
//   - By default, only ANTHROPIC_API_KEY (standard, metered billing) is used.
//   - Subscription OAuth is OPT-IN via `--use-subscription` (which sets
//     JOUSTING_USE_CLAUDE_SUB=1). It is never used silently because driving a
//     Pro/Max subscription outside the official client may violate the ToS.
// When using OAuth, an expired (or soon-to-expire) access token is refreshed
// automatically using the stored refresh token, and the rotated credential is
// written back so the next run — and Claude Code itself — stay logged in.
// Returns null if no usable credentials are available.
export function resolveAnthropicAuth(): AnthropicAuth | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const preferSub = process.env.JOUSTING_USE_CLAUDE_SUB === "1";

  if (preferSub) {
    const stored = readStoredOauth();
    if (stored) {
      const token = ensureFreshToken(stored);
      return { mode: "oauth", token };
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

// Injectable side-effects so the refresh orchestration can be unit-tested
// without touching the network, keychain, or filesystem.
export interface RefreshDeps {
  refresh: (refreshToken: string) => RefreshResult;
  persist: (stored: StoredOauth) => void;
  now: () => number;
}

const defaultRefreshDeps: RefreshDeps = {
  refresh: refreshTokenSync,
  persist: persistOauth,
  now: Date.now,
};

// True when the access token is missing an expiry, or is within the refresh-skew
// window of expiring (or already expired).
export function tokenNeedsRefresh(
  oauth: Record<string, unknown>,
  now: number = Date.now(),
): boolean {
  const expiresAt = typeof oauth.expiresAt === "number" ? oauth.expiresAt : 0;
  return expiresAt > 0 && now > expiresAt - REFRESH_SKEW_MS;
}

// Mutate the stored oauth object in place with a refreshed token response,
// preserving any unrelated fields (subscriptionType, etc.).
export function applyRefreshedToken(
  oauth: Record<string, unknown>,
  refreshed: RefreshResult,
  now: number = Date.now(),
): void {
  oauth.accessToken = refreshed.access_token;
  if (refreshed.refresh_token) oauth.refreshToken = refreshed.refresh_token;
  if (typeof refreshed.expires_in === "number") {
    oauth.expiresAt = now + refreshed.expires_in * 1000;
  }
  if (refreshed.scope) oauth.scopes = refreshed.scope.split(" ");
}

// Return a valid access token for the stored credential, refreshing in place if
// it is expired or within the refresh-skew window.
export function ensureFreshToken(
  stored: StoredOauth,
  deps: RefreshDeps = defaultRefreshDeps,
): string {
  const oauth = stored.oauth;
  const accessToken = String(oauth.accessToken ?? "");
  const expiresAt = typeof oauth.expiresAt === "number" ? oauth.expiresAt : 0;
  const refreshToken =
    typeof oauth.refreshToken === "string" ? oauth.refreshToken : "";
  const now = deps.now();

  if (!tokenNeedsRefresh(oauth, now)) return accessToken;

  if (!refreshToken) {
    if (now > expiresAt) {
      throw new Error(
        "Claude subscription token has expired and no refresh token is " +
          "available. Run any `claude` command (or `claude /login`) to refresh.",
      );
    }
    return accessToken;
  }

  let refreshed: RefreshResult;
  try {
    refreshed = deps.refresh(refreshToken);
  } catch (err) {
    if (now > expiresAt) throw err; // expired and can't refresh → fatal
    return accessToken; // still valid for now; proceed
  }

  // The server has now rotated the refresh token: `refreshToken` above is dead
  // and `refreshed.refresh_token` is the only valid one. Update the record in
  // place (preserving scopes/subscriptionType/etc.) and persist it.
  applyRefreshedToken(oauth, refreshed, now);
  try {
    deps.persist(stored);
  } catch (err) {
    // We consumed a one-time refresh token but couldn't store the replacement.
    // Claude Code now holds a dead token. Fail loudly with recovery steps
    // rather than letting the user silently get logged out everywhere.
    throw new Error(
      "Refreshed your Claude subscription token but FAILED to save the new " +
        "one back to the Claude Code credential store " +
        `(${stored.source}): ${err instanceof Error ? err.message : String(err)}.\n` +
        "To avoid being logged out, run `claude /login` to re-authenticate. " +
        "You can also use ANTHROPIC_API_KEY instead of --use-subscription.",
    );
  }

  return refreshed.access_token;
}

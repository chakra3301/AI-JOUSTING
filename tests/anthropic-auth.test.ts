import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureFreshToken,
  tokenNeedsRefresh,
  applyRefreshedToken,
  type StoredOauth,
  type RefreshResult,
  type RefreshDeps,
} from "../src/adapters/anthropic-auth.js";

const MINUTE = 60 * 1000;
const NOW = 1_000_000_000_000; // fixed clock for deterministic tests

// Build a StoredOauth fixture around an inner oauth object.
function stored(oauth: Record<string, unknown>): StoredOauth {
  return {
    record: { claudeAiOauth: oauth },
    oauth,
    source: "file",
  };
}

// Assemble injectable deps with a fixed clock and recording spies.
function deps(
  overrides: Partial<RefreshDeps> & { refreshResult?: RefreshResult } = {},
): RefreshDeps & { calls: { refreshed: string[]; persisted: number } } {
  const calls = { refreshed: [] as string[], persisted: 0 };
  return {
    now: overrides.now ?? (() => NOW),
    refresh:
      overrides.refresh ??
      ((rt: string) => {
        calls.refreshed.push(rt);
        return (
          overrides.refreshResult ?? {
            access_token: "fresh-access",
            refresh_token: "rotated-refresh",
            expires_in: 3600,
            scope: "user:inference user:profile",
          }
        );
      }),
    persist:
      overrides.persist ??
      (() => {
        calls.persisted += 1;
      }),
    calls,
  };
}

// --- tokenNeedsRefresh -----------------------------------------------------

test("tokenNeedsRefresh: false when comfortably valid", () => {
  assert.equal(tokenNeedsRefresh({ expiresAt: NOW + 60 * MINUTE }, NOW), false);
});

test("tokenNeedsRefresh: true within the 5-min skew window", () => {
  assert.equal(tokenNeedsRefresh({ expiresAt: NOW + 2 * MINUTE }, NOW), true);
});

test("tokenNeedsRefresh: true when already expired", () => {
  assert.equal(tokenNeedsRefresh({ expiresAt: NOW - MINUTE }, NOW), true);
});

test("tokenNeedsRefresh: false when no expiry is known", () => {
  assert.equal(tokenNeedsRefresh({}, NOW), false);
});

// --- applyRefreshedToken ---------------------------------------------------

test("applyRefreshedToken rotates token, expiry and scopes in place", () => {
  const oauth: Record<string, unknown> = {
    accessToken: "old",
    refreshToken: "old-refresh",
    expiresAt: NOW,
    subscriptionType: "max", // unrelated field must be preserved
  };
  applyRefreshedToken(
    oauth,
    {
      access_token: "new",
      refresh_token: "new-refresh",
      expires_in: 3600,
      scope: "a b",
    },
    NOW,
  );
  assert.equal(oauth.accessToken, "new");
  assert.equal(oauth.refreshToken, "new-refresh");
  assert.equal(oauth.expiresAt, NOW + 3600 * 1000);
  assert.deepEqual(oauth.scopes, ["a", "b"]);
  assert.equal(oauth.subscriptionType, "max");
});

test("applyRefreshedToken keeps old refresh token when none returned", () => {
  const oauth: Record<string, unknown> = { refreshToken: "keep-me" };
  applyRefreshedToken(oauth, { access_token: "new" }, NOW);
  assert.equal(oauth.refreshToken, "keep-me");
});

// --- ensureFreshToken ------------------------------------------------------

test("ensureFreshToken returns existing token without refreshing when valid", () => {
  const d = deps();
  const s = stored({ accessToken: "still-good", expiresAt: NOW + 60 * MINUTE });
  assert.equal(ensureFreshToken(s, d), "still-good");
  assert.equal(d.calls.refreshed.length, 0);
  assert.equal(d.calls.persisted, 0);
});

test("ensureFreshToken refreshes, mutates record, and persists when near expiry", () => {
  const d = deps();
  const s = stored({
    accessToken: "old",
    refreshToken: "old-refresh",
    expiresAt: NOW + 2 * MINUTE, // inside skew window
  });
  const token = ensureFreshToken(s, d);
  assert.equal(token, "fresh-access");
  assert.deepEqual(d.calls.refreshed, ["old-refresh"]);
  assert.equal(d.calls.persisted, 1);
  assert.equal(s.oauth.accessToken, "fresh-access");
  assert.equal(s.oauth.refreshToken, "rotated-refresh");
  assert.equal(s.oauth.expiresAt, NOW + 3600 * 1000);
});

test("ensureFreshToken throws when expired and no refresh token exists", () => {
  const d = deps();
  const s = stored({ accessToken: "dead", expiresAt: NOW - MINUTE });
  assert.throws(() => ensureFreshToken(s, d), /expired and no refresh token/);
  assert.equal(d.calls.refreshed.length, 0);
});

test("ensureFreshToken falls back to current token if refresh fails but token still valid", () => {
  const d = deps({
    refresh: () => {
      throw new Error("network down");
    },
  });
  const s = stored({
    accessToken: "still-valid",
    refreshToken: "rt",
    expiresAt: NOW + 2 * MINUTE, // within skew but not yet expired
  });
  assert.equal(ensureFreshToken(s, d), "still-valid");
});

test("ensureFreshToken rethrows if refresh fails and token already expired", () => {
  const d = deps({
    now: () => NOW,
    refresh: () => {
      throw new Error("network down");
    },
  });
  const s = stored({
    accessToken: "dead",
    refreshToken: "rt",
    expiresAt: NOW - MINUTE, // already expired
  });
  assert.throws(() => ensureFreshToken(s, d), /network down/);
});

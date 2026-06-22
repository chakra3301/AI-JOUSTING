import type { Provider } from "../types/index.js";

// Thrown when a provider's API key env var is not set. Carries enough context
// to be re-wrapped with the offending agent's name.
export class MissingKeyError extends Error {
  constructor(
    readonly provider: Provider,
    readonly keyEnv: string,
    message: string,
  ) {
    super(message);
    this.name = "MissingKeyError";
  }
}

// Thrown when a provider's optional SDK peer dependency is not installed.
export class MissingSdkError extends Error {
  constructor(
    readonly provider: Provider,
    readonly pkg: string,
  ) {
    super(`Install the ${provider} adapter: npm install ${pkg}`);
    this.name = "MissingSdkError";
  }
}

// Lazily import an optional peer-dependency SDK, throwing an actionable error
// if it isn't installed.
export async function loadSdk<T = any>(
  provider: Provider,
  pkg: string,
): Promise<T> {
  try {
    return (await import(/* @vite-ignore */ pkg)) as T;
  } catch {
    throw new MissingSdkError(provider, pkg);
  }
}

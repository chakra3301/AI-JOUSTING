import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { configSchema } from "./schema.js";
import type { JoustConfig, Mode } from "../types/index.js";

export const DEFAULT_CONFIG_FILENAME = "jousting.toml";

export interface LoadOverrides {
  topic?: string;
  passes?: number;
  mode?: Mode;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function resolveConfigPath(configPath?: string): string {
  const path = resolve(configPath ?? DEFAULT_CONFIG_FILENAME);
  if (!existsSync(path)) {
    throw new ConfigError(
      `No config found at ${path}. Run \`jousting init\` to create one.`,
    );
  }
  return path;
}

export function loadConfig(
  configPath?: string,
  overrides: LoadOverrides = {},
): JoustConfig {
  const path = resolveConfigPath(configPath);

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new ConfigError(`Could not read config at ${path}: ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = parseToml(raw);
  } catch (err) {
    throw new ConfigError(`Invalid TOML in ${path}: ${String(err)}`);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Config validation failed in ${path}:\n${issues}`);
  }

  const config = result.data as JoustConfig;
  return applyOverrides(config, overrides);
}

export function applyOverrides(
  config: JoustConfig,
  overrides: LoadOverrides,
): JoustConfig {
  const next: JoustConfig = {
    ...config,
    tiltyard: { ...config.tiltyard },
  };
  if (overrides.topic !== undefined) next.tiltyard.topic = overrides.topic;
  if (overrides.passes !== undefined) next.tiltyard.passes = overrides.passes;
  if (overrides.mode !== undefined) next.tiltyard.mode = overrides.mode;
  return next;
}

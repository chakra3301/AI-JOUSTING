import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nanoid } from "nanoid";
import type {
  JoustConfig,
  JoustFile,
  JoustResult,
  PassRecord,
} from "../types/index.js";

export const JOUST_FILE_VERSION = "1.0";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "joust"
  );
}

export function buildJoustFile(
  config: JoustConfig,
  passes: PassRecord[],
  result: JoustResult,
): JoustFile {
  return {
    id: nanoid(10),
    version: JOUST_FILE_VERSION,
    created_at: new Date().toISOString(),
    config,
    passes,
    result,
  };
}

// Writes a .joust file and returns its absolute path.
export function writeJoustFile(
  config: JoustConfig,
  passes: PassRecord[],
  result: JoustResult,
  dir = process.cwd(),
): { path: string; file: JoustFile } {
  const file = buildJoustFile(config, passes, result);
  const filename = `${slugify(config.tiltyard.topic)}-${file.id}.joust`;
  const path = resolve(dir, filename);
  writeFileSync(path, JSON.stringify(file, null, 2), "utf8");
  return { path, file };
}

export function readJoustFile(path: string): JoustFile {
  const abs = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (err) {
    throw new Error(`Could not read joust file at ${abs}: ${String(err)}`);
  }
  let parsed: JoustFile;
  try {
    parsed = JSON.parse(raw) as JoustFile;
  } catch (err) {
    throw new Error(`Invalid .joust file (not valid JSON): ${String(err)}`);
  }
  if (!parsed.version || !Array.isArray(parsed.passes)) {
    throw new Error(`File at ${abs} does not look like a .joust file.`);
  }
  return parsed;
}

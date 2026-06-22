import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "cli/index": "src/cli/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

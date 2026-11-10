import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  // No source maps in the published package.
  sourcemap: false,
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
});

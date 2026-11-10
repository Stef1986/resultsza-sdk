import { execSync } from "node:child_process";

/** Build dist/ once before any test file runs (tests spawn dist/index.js). */
export default function setup(): void {
  execSync("npm run build", { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
}

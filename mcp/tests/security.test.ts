import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const ROOT = new URL("..", import.meta.url).pathname;

beforeAll(() => {
  execSync("npm run build", { cwd: ROOT, stdio: "ignore" });
}, 120_000);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("security", () => {
  it("stderr_never_contains_key", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/index.js"],
      cwd: ROOT,
      env: { ...getDefaultEnvironment(), RESULTSZA_API_KEY: "SECRETKEY" },
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    const client = new Client({ name: "security-test", version: "1.0.0" });
    await client.connect(transport);
    let output = "";
    try {
      await client.listTools();
      const res: any = await client.callTool({ name: "get_lottery_results", arguments: { game: "Lotto", date: "not-a-date" } });
      output = JSON.stringify(res);
      expect(res.isError).toBe(true);
    } finally {
      await client.close();
    }
    expect(stderr).not.toContain("SECRETKEY");
    expect(output).not.toContain("SECRETKEY");
  });

  it("source_has_no_dangerous_apis", () => {
    const files = [...filesUnder(join(ROOT, "src")), join(ROOT, "dist", "index.js")];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const banned of ["child_process", "node:fs", 'from "fs"', "require(\"fs\")", "eval(", "new Function"]) {
        expect(text.includes(banned), `${banned} in ${f}`).toBe(false);
      }
    }
  });

  it("packed_files_are_allowlisted", () => {
    const out = execSync("npm pack --dry-run --json", { cwd: ROOT, encoding: "utf8" });
    const files: string[] = JSON.parse(out)[0].files.map((f: { path: string }) => f.path).sort();
    expect(files).toEqual(["LICENSE", "README.md", "dist/index.js", "package.json", "server.json"]);
  });
});

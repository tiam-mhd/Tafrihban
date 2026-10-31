import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

test("server TypeScript CLI resolves the server-only marker", () => {
  const output = execFileSync(
    process.execPath,
    [
      resolve(process.cwd(), "scripts/run-server-tsx.cjs"),
      "--eval",
      "import 'server-only'; console.log('server-only-ok')",
    ],
    { encoding: "utf8" },
  );

  assert.equal(output.trim(), "server-only-ok");
});

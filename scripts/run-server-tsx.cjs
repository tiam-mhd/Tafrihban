/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const condition = "--conditions=react-server";
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() || "";
const nodeOptions = existingNodeOptions.includes(condition)
  ? existingNodeOptions
  : [existingNodeOptions, condition].filter(Boolean).join(" ");
const child = spawnSync(
  process.execPath,
  [
    "-r",
    resolve(process.cwd(), "scripts/tsx-os-shim.cjs"),
    resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
    ...process.argv.slice(2),
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: "inherit",
  },
);

if (child.error) {
  console.error(`Could not start the TypeScript CLI: ${child.error.message}`);
  process.exit(1);
}

process.exit(child.status ?? 1);

/* eslint-disable @typescript-eslint/no-require-imports */
const os = require("node:os");
const path = require("node:path");
const { syncBuiltinESMExports } = require("node:module");

if (process.platform === "win32") {
  try {
    os.userInfo();
  } catch (error) {
    if (error?.code !== "ERR_SYSTEM_ERROR" || error?.syscall !== "uv_os_get_passwd") throw error;

    Object.defineProperty(os, "userInfo", {
      configurable: true,
      value: () => ({
        username: process.env.USERNAME || `tafrihban-${process.pid}`,
        uid: -1,
        gid: -1,
        shell: null,
        homedir: process.cwd(),
      }),
    });
    syncBuiltinESMExports();

    const nodeOptions = process.env.NODE_OPTIONS || "";
    if (!nodeOptions.includes("tsx-os-shim.cjs")) {
      const preload = `--require="${path.resolve(__filename).replaceAll("\\", "/")}"`;
      process.env.NODE_OPTIONS = [nodeOptions, preload].filter(Boolean).join(" ");
    }
  }
}

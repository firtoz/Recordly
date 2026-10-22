import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const executable = require("electron");
const expected = require("../package-lock.json").packages["node_modules/electron"].version;
const result = spawnSync(executable, ["-e", `
  const assert = require("node:assert/strict");
  assert.equal(typeof require("uiohook-napi").uIOhook.start, "function");
  console.log(JSON.stringify(process.versions));
`], { encoding: "utf8", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
assert.equal(result.status, 0, result.stderr);
const versions = JSON.parse(result.stdout.trim());
assert.equal(versions.electron, expected);
console.log("Native module loads under Electron:", JSON.stringify({
  electron: versions.electron, node: versions.node, chrome: versions.chrome,
}));

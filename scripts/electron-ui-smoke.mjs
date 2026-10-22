import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron } from "playwright";
const require = createRequire(import.meta.url);
const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "recordly-security-smoke-"));
await mkdir(path.join(temporaryHome, "Videos"));
const fixture = path.join(temporaryHome, "fixture.mp4");
const generated = spawnSync(require("ffmpeg-static"), [
  "-nostdin", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
  "-i", "color=c=blue:s=640x360:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixture,
], { encoding: "utf8" });
assert.equal(generated.status, 0, generated.stderr);
const app = await _electron.launch({
  executablePath: require("electron"),
  // Only this isolated test opts into software rendering under Xvfb.
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", process.cwd()],
  env: { ...process.env, HOME: temporaryHome, XDG_CONFIG_HOME: path.join(temporaryHome, ".config"), ELECTRON_RUN_AS_NODE: undefined },
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const record = page.getByRole("button", { name: "Record", exact: true });
  await record.waitFor();
  assert.equal(await page.locator("button").count(), 8);
  assert.equal(await record.evaluate((button) => Math.round(button.getBoundingClientRect().width)), 46);
  const selected = await page.evaluate((file) => window.electronAPI.setCurrentVideoPath(file), fixture);
  assert.equal(selected.success, true);
  await page.goto(new URL("../dist/index.html?windowType=editor", import.meta.url).href);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
  await page.getByRole("button", { name: "Export", exact: true }).waitFor();
  await page.locator("canvas").first().waitFor();
  assert.ok((await page.locator("body").innerText()).includes("0:01"));
  assert.deepEqual(errors, []);
  console.log("Electron HUD and editor load synthetic video with controls and canvas intact");
} finally {
  await app.close();
  await rm(temporaryHome, { recursive: true, force: true });
}

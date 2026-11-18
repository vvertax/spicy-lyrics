import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { parseHotfix } from "../builds/main/release-hotfix.mjs";

test("hosted hotfixes preserve the baseline and require a new immutable revision for a rollback", () => {
  const temp = realpathSync(tmpdir());
  const root = realpathSync(mkdtempSync(join(temp, "spicy-hotfix-")));
  assert.ok(dirname(root) === temp && basename(root).startsWith("spicy-hotfix-"));
  const host = "preview.example";
  const stage = () => spawnSync(process.execPath, [join(root, "project/prepare-hosting.mjs"), "--host=" + host], { encoding: "utf8" });
  const write = (file, text) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  const deployed = file => readFileSync(join(root, "deploy", host, file), "utf8");
  try {
    for (const path of ["project/prepare-hosting.mjs", "project/hosting-target.mjs", "builds/main/release-hotfix.mjs",
      "builds/main/entrypoint.mjs", "hosting/spicy-lyrics-sl.mjs", "hosting/index.html", "hosting/preview-host.js", "hosting/preview-host.css"]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      cpSync(path, join(root, path));
    }
    write("dist/preview/index.html", "<title>Preview</title>");
    write("dist/version", "1.12.0");
    write("dist/spicy-lyrics@1.12.0.mjs", "baseline");
    assert.equal(stage().status, 0);
    assert.equal(deployed("hotfix"), "0\n");
    write("dist/hotfix", "1");
    write("dist/spicy-lyrics@1.12.0-r1.mjs", "new code");
    assert.equal(stage().status, 0);
    assert.equal(deployed("version"), "1.12.0\n");
    assert.equal(deployed("hotfix"), "1\n");
    assert.equal(deployed("spicy-lyrics@1.12.0.mjs"), "baseline");
    assert.equal(deployed("spicy-lyrics@1.12.0-r1.mjs"), "new code");
    write("dist/spicy-lyrics@1.12.0-r1.mjs", "different code");
    assert.match(stage().stderr, /already contains a different bundle/);
    write("dist/hotfix", "0");
    assert.match(stage().stderr, /Cannot lower/);
    write("dist/hotfix", "2");
    write("dist/spicy-lyrics@1.12.0-r2.mjs", "baseline");
    assert.equal(stage().status, 0);
    assert.equal(deployed("hotfix"), "2\n");
    assert.equal(deployed("spicy-lyrics@1.12.0-r2.mjs"), "baseline");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("only safe, non-negative integer counters are accepted", () => {
  assert.equal(parseHotfix("0\n"), 0);
  assert.equal(parseHotfix("1\n"), 1);
  for (const value of ["-1", "0.1", "1e8", "01", "9007199254740992", "1/other", null]) {
    assert.throws(() => parseHotfix(value), /Invalid hotfix counter/);
  }
});

test("the update checker announces each hotfix once and keeps the public version number", async () => {
  const notices = [];
  globalThis.hotfixTestNotices = notices;
  globalThis.Spicetify = { LocalStorage: { get: () => null } };
  globalThis.window = { setTimeout, clearTimeout, _spicy_lyrics_metadata: { LoadedHotfix: 0, LoadedApiHost: "lrc.vvrtx.lol" } };
  let remoteVersion = "1.12.0", counter = "0", counterExists = true;
  globalThis.fetch = async url => url.endsWith("/hotfix")
    ? (counterExists ? new Response(counter) : new Response(null, { status: 404 }))
    : new Response(remoteVersion);
  const stubs = {
    react: "export default {};",
    sonner: "export const toast = (title, {description}) => globalThis.hotfixTestNotices.push({title,description});",
    "Defaults.ts": "export const isDev = false;",
    "stores.ts": 'export const $spicyLyricsVersion = { get: () => "1.12.0" };',
    "Global.ts": "export default {};",
    "NoticeDialog.tsx": "export const NoticeLink = () => {}, showNotice = () => {};",
    "UpdateDialog.tsx": "export const releaseNotesUrl = () => {};",
  };
  const { outputFiles } = await build({
    entryPoints: ["src/utils/version/CheckForUpdates.tsx"], bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "hotfix-checker-fixture", setup(b) {
      b.onResolve({ filter: /(^react$|^sonner$|\/(Defaults|stores|Global)\.ts$|\/(NoticeDialog|UpdateDialog)\.tsx$)/ },
        ({ path }) => ({ path: path.split("/").at(-1), namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({ contents: stubs[path] }));
    } }],
  });
  const { CheckForUpdates } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
  await CheckForUpdates();
  assert.deepEqual(notices, []);
  counter = "1";
  await CheckForUpdates();
  await CheckForUpdates();
  assert.deepEqual(notices, [{ title: "Update available for 1.12.0", description: "Fix #1" }]);
  counter = "2";
  await CheckForUpdates();
  assert.deepEqual(notices.at(-1), { title: "Update available for 1.12.0", description: "Fix #2" });
  window._spicy_lyrics_metadata.LoadedHotfix = 2;
  await CheckForUpdates(true);
  assert.equal(notices.length, 2);
  remoteVersion = "1.13.0";
  counterExists = false;
  await CheckForUpdates();
  assert.equal(notices.at(-1).title, "Spicy Lyrics 1.13.0 is out");
});

test("startup confirms a newly installed fix once and preserves the normal version notice", async () => {
  const notices = globalThis.installedUpdateNotices = [];
  const { outputFiles } = await build({
    entryPoints: ["src/components/ReactComponents/UpdateDialog.tsx"], bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "installed-update-fixture", setup(b) {
      b.onResolve({ filter: /\/NoticeDialog\.tsx$/ }, ({ path }) => ({ path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export const NoticeLink = () => {}, showNotice = notice => globalThis.installedUpdateNotices.push(notice);",
      }));
    } }],
  });
  const { showInstalledUpdate } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
  const installed = { version: "1.12.0", hotfix: 2, host: "preview.example" };
  showInstalledUpdate("", null, installed);
  showInstalledUpdate(installed.version, installed, installed);
  showInstalledUpdate(installed.version, { ...installed, hotfix: 3 }, installed);
  showInstalledUpdate(installed.version, { ...installed, hotfix: 0, host: "other.example" }, installed);
  assert.deepEqual(notices, []);
  showInstalledUpdate(installed.version, { ...installed, hotfix: 1 }, installed);
  assert.equal(notices[0].title, "Update installed");
  assert.equal(notices[0].content[0].props.children, "Fix #2 for 1.12.0 is now installed.");
  showInstalledUpdate(installed.version, null, installed);
  assert.equal(notices.at(-1).title, "Update installed");
  showInstalledUpdate("1.11.3", null, installed);
  assert.equal(notices.at(-1).title, "Updated to 1.12.0");
});

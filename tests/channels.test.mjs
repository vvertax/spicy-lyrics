import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { test } from "node:test";

const source = readFileSync(new URL("../src/utils/version/ChannelVersion.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { fetchSelectedChannelVersion } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const values = new Map();
globalThis.Spicetify = { LocalStorage: { get: key => values.get(key) ?? null } };
globalThis.window = { setTimeout, clearTimeout };
let requests = [];
let reply = "100.10.54-sl.2";
globalThis.fetch = async url => { requests.push(url); return new Response(reply); };
function select(name, custom = {}) {
  values.clear(); requests = []; reply = "100.10.54-sl.2";
  if (name) values.set("SpicyLyrics-buildChannel", name);
  values.set("SpicyLyrics-customChannels", JSON.stringify(custom));
}

test("default and built-in SL check the release host", async () => {
  for (const name of [null, "SL", "vvertax Edition"]) {
    select(name); assert.equal(await fetchSelectedChannelVersion(), "100.10.54-sl.2");
    assert.deepEqual(requests, ["https://lrc.vvrtx.lol/version"]);
  }
});
test("official channels keep the official version endpoint", async () => {
  for (const name of ["Stable", "Beta"]) {
    select(name); await fetchSelectedChannelVersion();
    assert.deepEqual(requests, ["https://api.spicylyrics.org/version"]);
  }
});
test("custom channels use their configured version host", async () => {
  select("Custom", { Custom: ["custom.example", "storage.example"] });
  await fetchSelectedChannelVersion(); assert.deepEqual(requests, ["https://custom.example/version"]);
});
test("pinned channels never check a newer version", async () => {
  select("Pinned", { Pinned: ["custom.example", "storage.example", "100.10.54-sl.1"] });
  assert.equal(await fetchSelectedChannelVersion(), undefined); assert.deepEqual(requests, []);
});
test("unknown channels fall back to SL", async () => {
  select("Missing"); await fetchSelectedChannelVersion();
  assert.deepEqual(requests, ["https://lrc.vvrtx.lol/version"]);
});
test("HTML from a misconfigured host is rejected", async () => {
  select("SL"); reply = "<html>not a version</html>";
  await assert.rejects(fetchSelectedChannelVersion(), /Unexpected version/);
});

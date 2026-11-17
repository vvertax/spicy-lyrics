import assert from "node:assert/strict";
import { build } from "esbuild";
import { test } from "node:test";

const { outputFiles } = await build({entryPoints:['src/utils/version/ChannelVersion.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const code = outputFiles[0].text;
const { fetchSelectedChannelVersion } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const values = new Map();
globalThis.Spicetify = { LocalStorage: { get: key => values.get(key) ?? null } };
globalThis.window = { setTimeout, clearTimeout };
let requests = [];
let reply = "100.10.54-sl.2";
let officialReply;
globalThis.fetch = async url => { requests.push(url); return new Response(url.endsWith('/grabClientInfo') ? JSON.stringify(officialReply) : reply); };
function select(name, custom = {}) {
  values.clear(); requests = []; reply = "100.10.54-sl.2";
  officialReply = { branches: [{ tag: 'inDev', version: 'restricted' }, { tag: 'public', version: '6.5.10' }] };
  if (name) values.set("SpicyLyrics-buildChannel", name);
  values.set("SpicyLyrics-customChannels", JSON.stringify(custom));
  delete window._spicy_lyrics_metadata;
}

test("default and built-in SL check the release host", async () => {
  for (const name of [null, "SL", "vvertax Edition"]) {
    select(name); assert.equal(await fetchSelectedChannelVersion(), "100.10.54-sl.2");
    assert.deepEqual(requests, ["https://lrc.vvrtx.lol/version"]);
  }
});
test("official channels read the public release from the upstream loader", async () => {
  for (const name of ["Stable", "Beta"]) {
    select(name); assert.equal(await fetchSelectedChannelVersion(), '6.5.10');
    assert.deepEqual(requests, ["https://api.spicylyrics.org/bp/loader/grabClientInfo"]);
  }
});
test('official release discovery rejects missing or malformed public branches', async () => {
  for (const body of [{branches:[]}, {branches:{tag:'public'}}, {branches:[{tag:'public',version:'<html>'}]}]) {
    select('Stable'); officialReply=body;
    await assert.rejects(fetchSelectedChannelVersion(), /Unexpected version/);
  }
});
test('custom storage keeps its version endpoint even when the API host is official', async () => {
  select('Mixed', {Mixed:['api.spicylyrics.org','storage.example']});
  await fetchSelectedChannelVersion();assert.deepEqual(requests,['https://api.spicylyrics.org/version']);
});
test("custom channels use their configured version host", async () => {
  select("Custom", { Custom: ["custom.example", "storage.example"] });
  await fetchSelectedChannelVersion(); assert.deepEqual(requests, ["https://custom.example/version"]);
});
test('production channels ignore an alternate loader host', async () => {
  for (const name of ['SL','vvertax Edition']) {
    select(name);window._spicy_lyrics_metadata={ForkReleaseHost:'preview.example'};
    await fetchSelectedChannelVersion();assert.deepEqual(requests,['https://lrc.vvrtx.lol/version']);
  }
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

test('custom alternate release checks its own host while reserved names ignore stored overrides',async()=>{
 select('Preview',{Preview:['preview.example','preview.example']});
 await fetchSelectedChannelVersion();assert.deepEqual(requests,['https://preview.example/version']);
 select('vvertax Edition',{'vvertax Edition':['preview.example','preview.example']});
 await fetchSelectedChannelVersion();assert.deepEqual(requests,['https://lrc.vvrtx.lol/version']);
});

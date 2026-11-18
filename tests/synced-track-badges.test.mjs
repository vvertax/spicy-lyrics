import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const fixture = {
  "experiments.ts": "export const $experiment = () => null;",
  "stores.ts": "export const $uiLanguage = null;",
};
const { outputFiles } = await build({
  stdin: {
    contents: "export {getTracklistRowId} from './src/components/Utils/SyncedTrackBadges.ts'; export {getSpicyLyricsAvailability, isSyncedSpicyLyrics, rememberSpicyLyricsAvailability} from './src/utils/Lyrics/SyncedTrackAvailability.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "badge-host", setup(b) {
    b.onResolve({ filter: /\/(experiments|stores)\.ts$/ }, args => ({
      path: args.path.split("/").at(-1), namespace: "stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, args => ({ contents: fixture[args.path] }));
  } }],
});
const { getTracklistRowId, getSpicyLyricsAvailability, isSyncedSpicyLyrics, rememberSpicyLyricsAvailability } = await import(
  "data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);

test("a reused row resolves its current track ID without accepting non-track items", () => {
  const a = "abcdefghijklmnopqrstuv";
  const b = "0123456789012345678901";
  let value = "spotify:track:" + a;
  const row = { getAttribute: name => name === "data-uri" ? value : null, querySelector: () => null };
  assert.equal(getTracklistRowId(row), a);
  value = "/track/" + b + "?si=example";
  assert.equal(getTracklistRowId(row), b);
  value = "spotify:episode:" + b;
  assert.equal(getTracklistRowId(row), undefined);
  row.__reactFiber$test = { memoizedProps: {}, return: { memoizedProps: { track: { uri: "spotify:track:" + a } } } };
  assert.equal(getTracklistRowId(row), a);
});

test("only confirmed synced community lyrics qualify for the badge", () => {
  const lyrics = { source: "spl", Type: "Syllable", Content: [{ Text: "A line" }] };
  assert.equal(isSyncedSpicyLyrics(lyrics), true);
  assert.equal(isSyncedSpicyLyrics({ ...lyrics, Type: "Line" }), true);
  assert.equal(isSyncedSpicyLyrics({ ...lyrics, Type: "Static" }), false);
  assert.equal(isSyncedSpicyLyrics({ ...lyrics, source: "aml" }), false);
  assert.equal(isSyncedSpicyLyrics({ ...lyrics, Content: [] }), false);
});

test("a known badge survives expiry of an old record and clearing the lyrics cache", async () => {
  const saved = new Map();
  globalThis.caches = { async open(name) {
    const cache = saved.get(name) ?? new Map();
    saved.set(name, cache);
    return { match: async key => cache.get(key)?.clone(), put: async (key, value) => cache.set(key, value) };
  } };
  try {
    const id = "abcdefghijklmnopqrstuv";
    const oldName = "SpicyLyrics_SyncedTrackAvailability";
    const legacy = await caches.open(oldName);
    await legacy.put("/" + id, new Response(JSON.stringify({ CacheVersion: 1, ExpiresAt: 1, Content: true })));
    assert.equal(await getSpicyLyricsAvailability(id), true);
    saved.delete(oldName);
    saved.delete("SpicyLyrics_LyricsStore_g2");
    await rememberSpicyLyricsAvailability(id, null);
    assert.equal(await getSpicyLyricsAvailability(id), true);
    assert.equal(await getSpicyLyricsAvailability("unknown"), undefined);
  } finally { delete globalThis.caches; }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

let now = 0, uri = "spotify:track:a", nextId = 0;
const timers = new Map();
const element = () => {
  const classes = new Set();
  return { classes, classList: { add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name), toggle: (name, value) => value ? classes.add(name) : classes.delete(name) },
    setAttribute() {}, replaceChildren() {}, querySelector: () => null, removeEventListener() {}, addEventListener() {} };
};
const skeleton = element(), spinner = element(), content = element();
const win = {
  setTimeout: (cb, delay) => { const id = ++nextId; timers.set(id, { cb, delay }); return id; },
  addEventListener() {}, removeEventListener() {},
  clearTimeout: id => timers.delete(id), matchMedia: () => ({ matches: false }),
};
const container = { ...element(), ownerDocument: { hidden: false, defaultView: win },
  querySelectorAll: () => [skeleton, spinner], querySelector: selector => selector === ".LyricsSkeleton" ? skeleton : selector === ".loaderContainer" ? spinner : selector === ".LyricsSkeleton.active" ? skeleton.classes.has("active") && skeleton : content };
const page = { querySelector: selector => selector === ".LyricsContainer" ? container : null };
globalThis.__loaderScene = { page, current: value => value === uri, uri: () => uri, sceneDelay: 0 };
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => now } });
const { outputFiles } = await build({ entryPoints: ["src/utils/Lyrics/LyricsLoader.ts"], bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "loader-fixtures", setup(b) {
  b.onResolve({ filter: /(?:ScenePresentation|PageView|SpotifyPlayer|Track|LyricsSkeleton|experiments|remoteConfig)\.ts$/ }, args => ({ path: args.path, namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
    if (path.endsWith("ScenePresentation.ts")) return { contents: "export const beginSceneTrackChange=()=>{},sceneLoaderDelay=()=>globalThis.__loaderScene.sceneDelay;" };
    if (path.endsWith("PageView.ts")) return { contents: "export const PageContainer=globalThis.__loaderScene.page;" };
    if (path.endsWith("SpotifyPlayer.ts")) return { contents: "export const SpotifyPlayer={GetUri:globalThis.__loaderScene.uri};" };
    if (path.endsWith("Track.ts")) return { contents: "export const isCurrentTrack=globalThis.__loaderScene.current;" };
    if (path.endsWith("LyricsSkeleton.ts")) return { contents: "export const IsLyricsSkeletonEnabled=()=>true;" };
    if (path.endsWith("experiments.ts")) return { contents: "export const onExperimentChange=()=>{};" };
    return { contents: "export const getRemoteConfig=()=>({lyricsFetch:{loaderRevealDelayMs:2000}});" };
  });
} }] });
const { ShowLoaderContainer, PaintLyricsLoader, HideLoaderContainer, ShowQueueLoader, ClearLyricsLoader } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("fast network responses skip the skeleton; repeated calls preserve the deadline and queue notices remain immediate", async () => {
  ShowLoaderContainer(uri);
  assert.equal(skeleton.classes.has("active"), false);
  assert.equal([...timers.values()][0].delay, 2000);
  now = 500;
  ShowLoaderContainer(uri);
  assert.equal([...timers.values()][0].delay, 1500);
  assert.equal(skeleton.classes.has("active"), false);
  await PaintLyricsLoader(uri); // Must not request two placeholder frames while its reveal is pending.
  await HideLoaderContainer(uri);
  assert.equal(timers.size, 0);
  assert.equal(skeleton.classes.has("active"), false);
  uri = "spotify:track:b"; now = 1000;
  ShowLoaderContainer(uri);
  const stale = [...timers.values()][0].cb;
  now += 2000; stale();
  assert.equal(skeleton.classes.has("active"), true);
  ShowLoaderContainer(uri);
  assert.equal(skeleton.classes.has("active"), true);
  ClearLyricsLoader(); timers.clear();
  uri = "spotify:track:c";
  ShowQueueLoader();
  assert.equal(skeleton.classes.has("active"), true);
  ClearLyricsLoader(); timers.clear();
});

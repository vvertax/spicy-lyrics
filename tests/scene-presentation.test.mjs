import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

let uri = "spotify:track:a";
let motion = false;
const listeners = new Set();
const fixture = {
  uri: () => uri,
  store: { get: () => true, listen: cb => { listeners.add(cb); return () => listeners.delete(cb); } },
};
globalThis.__sceneFixture = fixture;
globalThis.window = { setInterval, clearInterval, setTimeout };
const { outputFiles } = await build({ entryPoints: ["src/components/Utils/ScenePresentation.ts"], bundle: true, write: false, format: "esm", platform: "node", plugins: [{ name: "scene-fixtures", setup(b) {
  b.onResolve({ filter: /(stores|experiments|DisplayedLyrics|lyrics|GetProgress|SpotifyPlayer|AnimationFrameLoop|WindowActivity)\.ts$/ }, args => ({ path: args.path, namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
    if (args.path.endsWith("WindowActivity.ts")) return { contents: "export const visibleInterval=(_win,cb,ms)=>{const id=setInterval(cb,ms);return()=>clearInterval(id)};" };
    if (args.path.endsWith("AnimationFrameLoop.ts")) return { contents: "export const onAnimationFrame=()=>()=>{};" };
    if (args.path.endsWith("stores.ts")) return { contents: "export const $smoothSceneTransitions=globalThis.__sceneFixture.store;export const $lyricsRendererPaused={get:()=>false};" };
    if (args.path.endsWith("SpotifyPlayer.ts")) return { contents: "export const SpotifyPlayer={GetUri:globalThis.__sceneFixture.uri};" };
    if (args.path.endsWith("experiments.ts")) return { contents: "export const isExperimentEnabled=()=>false;" };
    if (args.path.endsWith("DisplayedLyrics.ts")) return { contents: "export const getDisplayedLyrics=()=>null;" };
    if (args.path.endsWith("GetProgress.ts")) return { contents: "export default ()=>0;" };
    return { contents: "export const LyricsObject={Types:{Line:{Lines:[]},Syllable:{Lines:[]}}};" };
  });
} }] });
const { mountScenePresentation, beginSceneTrackChange, revealSceneLyrics, unmountScenePresentation, sceneLoaderDelay } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("rapid song changes never reveal stale lyrics; disabling and unmounting cancel animation ownership", async () => {
  const animations = [];
  const content = { childElementCount: 0, animate() {
    let finish;
    const result = { canceled: false, finished: new Promise(resolve => { finish = resolve; }), cancel() { this.canceled = true; finish(); } };
    animations.push(result); return result;
  } };
  const page = {
    isConnected: true, ownerDocument: { hidden: false, defaultView: { matchMedia: () => ({ matches: motion }) } },
    classList: { remove() {}, toggle() {} }, matches: () => false,
    querySelector: selector => selector === ".LyricsContent" ? content : null,
  };
  mountScenePresentation(page);
  uri = "spotify:track:b"; beginSceneTrackChange(page, uri);
  uri = "spotify:track:c"; beginSceneTrackChange(page, uri);
  revealSceneLyrics(page, "spotify:track:b"); assert.equal(animations.length, 0);
  revealSceneLyrics(page, uri); assert.equal(animations.length, 1);
  for (const cb of listeners) cb(false);
  assert.equal(animations[0].canceled, true);
  uri = "spotify:track:d"; beginSceneTrackChange(page, uri);
  motion = true; revealSceneLyrics(page, uri); assert.equal(animations.length, 1);
  unmountScenePresentation(page);
  assert.equal(listeners.size, 0);
  revealSceneLyrics(page, uri); assert.equal(animations.length, 1);
  await Promise.resolve();
});


test("entrance waits for initial positioning and an older observer cannot reveal a skipped track", () => {
  motion = false; uri = "spotify:track:ready-a";
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const flags = new Set(["InitialPositionPending"]);
  let animated = 0;
  const content = { childElementCount: 0, classList: { contains: name => flags.has(name) },
    animate() { animated++; return { finished: Promise.resolve(), cancel() {} }; } };
  const page = { isConnected: true, ownerDocument: { hidden: false, defaultView: { matchMedia: () => ({ matches: false }) } },
    classList: { remove() {}, toggle() {} }, matches: () => false,
    querySelector: selector => selector === ".LyricsContent" ? content : null };
  mountScenePresentation(page);
  uri = "spotify:track:ready-b"; beginSceneTrackChange(page, uri); revealSceneLyrics(page, uri);
  assert.equal(animated, 0);
  flags.clear(); observers[0].cb();
  assert.equal(animated, 1); assert.equal(observers[0].disconnected, true);
  flags.add("InitialPositionPending");
  uri = "spotify:track:ready-c"; beginSceneTrackChange(page, uri); revealSceneLyrics(page, uri);
  const old = observers[1]; uri = "spotify:track:ready-d"; beginSceneTrackChange(page, uri);
  flags.clear(); old.cb(); assert.equal(animated, 1); assert.equal(old.disconnected, true);
  unmountScenePresentation(page);
});

test("outgoing snapshot preserves the nested SimpleBar scroll instead of displaying virtual spacers", () => {
  uri = "spotify:track:scroll-a";
  const nested = { scrollTop: 6400, scrollLeft: 12 }, copy = { scrollTop: 0, scrollLeft: 0 };
  const snapshot = { classList: { remove() {} }, removeAttribute() {}, querySelectorAll: selector => selector === "*" ? [copy] : [] };
  const content = { childElementCount: 1, scrollTop: 0, scrollLeft: 0,
    querySelectorAll: () => [nested], cloneNode: () => snapshot,
    getBoundingClientRect: () => ({ top: 20, left: 0, width: 500, height: 600 }) };
  const outgoing = { style: {}, setAttribute() {}, append() {}, remove() {}, animate: () => ({ finished: Promise.resolve(), cancel() {} }) };
  const container = { classList: { contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0 }), append() {} };
  const page = { isConnected: true, ownerDocument: { hidden: false, createElement: () => outgoing, defaultView: { matchMedia: () => ({ matches: false }) } },
    classList: { remove() {}, toggle() {} }, matches: () => false,
    querySelector: selector => selector === ".LyricsContent" ? content : container };
  mountScenePresentation(page); uri = "spotify:track:scroll-b"; beginSceneTrackChange(page, uri);
  assert.equal(copy.scrollTop, 6400); assert.equal(copy.scrollLeft, 12);
  assert.ok(sceneLoaderDelay(page, uri) > 0);
  assert.equal(sceneLoaderDelay(page, "spotify:track:unrelated"), 0);
  unmountScenePresentation(page);
});

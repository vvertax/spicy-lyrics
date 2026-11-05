import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
function fakeWindow() {
  const events = new EventTarget(), doc = new EventTarget(); doc.hidden = false; doc.querySelectorAll = () => [];
  let id = 0; const frames = new Map(), intervals = new Map();
  const win = { document: doc, closed: false,
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: key => frames.delete(key),
    setInterval: callback => { intervals.set(++id, callback); return id; }, clearInterval: key => intervals.delete(key),
    frame(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(time)); },
    tick() { [...intervals.values()].forEach(cb => cb()); }, frames, intervals,
    hide(hidden) { doc.hidden = hidden; doc.dispatchEvent(new Event("visibilitychange")); },
    blur() { events.dispatchEvent(new Event("blur")); },
    close() { this.closed = true; events.dispatchEvent(new Event("pagehide")); },
  }; return win;
}
const host = fakeWindow(); globalThis.window = host;
const { outputFiles } = await build({ stdin: { contents: `export * from './src/utils/WindowActivity.ts';export * from './src/utils/AnimationFrameLoop.ts';export * from './src/utils/Lyrics/RequestAbort.ts';`, resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{name:"stores",setup(b){b.onResolve({filter:/stores\.ts$/},a=>({path:a.path,namespace:"stub"}));b.onLoad({filter:/.*/,namespace:"stub"},()=>({contents:'export const $animationFpsCap={get:()=>60,listen:()=>{}};export const $animationFpsCapEnabled={get:()=>false,listen:()=>{}};'}));}}] });
const api = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
test("hidden documents stop frames and visual timers; blur alone does not pause; repeated restores own one loop", () => {
  let draws = 0, domWrites = 0;
  const stop = api.onAnimationFrame(() => { draws++; domWrites++; }, host);
  const stopTimer = api.visibleInterval(host, () => { domWrites++; }, 150);
  host.frame(0); host.blur(); host.frame(16); assert.equal(draws, 2);
  for (let i=0;i<20;i++) {
    host.hide(true); const previous = domWrites;
    assert.equal(host.frames.size, 0); assert.equal(host.intervals.size, 0);
    for(let j=0;j<10;j++){host.frame(1000+i*100);host.tick();}
    assert.equal(domWrites, previous);
    host.hide(false); assert.equal(host.frames.size, 1); assert.equal(host.intervals.size, 1);
    host.frame(2000+i*100);
  }
  stop(); stopTimer(); assert.equal(host.frames.size, 0); assert.equal(host.intervals.size, 0);
});
test("visible PiP keeps activity while hidden host does no rendering; closing last window suspends global work", async () => {
  const external = fakeWindow(); let hostFrames=0, pipFrames=0;
  const stopHost=api.onAnimationFrame(()=>hostFrames++,host), stopPip=api.onAnimationFrame(()=>pipFrames++,external);
  host.hide(true); assert.equal(api.hasVisibleLyricsWindow(),true);
  external.frame(1);host.frame(1);assert.equal(pipFrames,1);assert.equal(hostFrames,0);
  external.hide(true);assert.equal(api.hasVisibleLyricsWindow(),false);
  let resumed=false;const pending=api.waitForVisibleLyrics().then(()=>resumed=true);await Promise.resolve();assert.equal(resumed,false);
  external.hide(false);await pending;assert.equal(resumed,true);
  external.close();assert.equal(api.hasVisibleLyricsWindow(),false);
  host.hide(false);assert.equal(api.hasVisibleLyricsWindow(),true);stopHost();stopPip();
});
test("one-shot layout callbacks wait for visibility and remain cancellable", () => {
  host.hide(true);let count=0;
  api.requestCappedFrame(()=>count++,host);const cancelled=api.requestCappedFrame(()=>count+=100,host);api.cancelCappedFrame(cancelled);
  assert.equal(host.frames.size,0);host.hide(false);host.frame(50000);assert.equal(count,1);assert.equal(host.frames.size,0);
});
test("cancellation detaches a non-abortable provider before its late response can trigger parsing", async () => {
  const controller=new AbortController();let complete;let processed=0;
  const request=api.abortable(new Promise(resolve=>complete=resolve),controller.signal).then(()=>processed++);
  controller.abort();await assert.rejects(request,{name:"AbortError"});complete({lyrics:"late"});await Promise.resolve();assert.equal(processed,0);
});
test("visual animations pause without touching unrelated Spotify content", () => {
  let pauses=0,plays=0;const animation={playState:"running",pause(){pauses++;this.playState="paused"},play(){plays++;this.playState="running"}};
  host.document.querySelectorAll=()=>[{getAnimations:()=>[animation],querySelectorAll:()=>[]}];
  api.registerActivityWindow(host);host.hide(true);host.hide(false);assert.equal(pauses,1);assert.equal(plays,1);
  host.document.querySelectorAll=()=>[];
});

test("only playing decorative videos are paused and a music pause prevents automatic video restart", () => {
  let paused=0,played=0;const video={paused:false,isConnected:true,pause(){paused++;this.paused=true},play(){played++;this.paused=false;return Promise.resolve()}};
  host.document.querySelectorAll=()=>[{getAnimations:()=>[],querySelectorAll:()=>[video]}];
  globalThis.Spicetify={Player:{isPlaying:()=>false}};
  host.hide(true);host.hide(false);assert.equal(paused,1);assert.equal(played,0);
  host.document.querySelectorAll=()=>[];delete globalThis.Spicetify;
});

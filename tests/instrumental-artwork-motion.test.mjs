import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const callbacks = new Set();
globalThis.__artworkFrames = callbacks;
const { outputFiles } = await build({ entryPoints: ["src/components/Utils/InstrumentalArtworkMotion.ts"], bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "capped-frames", setup(b) {
  b.onResolve({ filter: /AnimationFrameLoop\.ts$/ }, () => ({ path: "frames", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const onAnimationFrame=fn=>{globalThis.__artworkFrames.add(fn);return()=>globalThis.__artworkFrames.delete(fn)};" }));
} }] });
const { instrumentalArtworkFrame, createInstrumentalArtworkMotion } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("caption clears the rotating cover throughout entry and drift at different artwork sizes", () => {
  for (const [width, height] of [[160, 160], [640, 640], [720, 480]]) {
    for (const level of [0, .1, .5, 1]) {
      for (let phase = 0; phase < 18; phase += .1) {
        const value = instrumentalArtworkFrame(width, height, level, phase);
        const radians = value.angle * Math.PI / 180;
        const lowerEdge = value.y + (height * Math.cos(radians) + width * Math.abs(Math.sin(radians))) * value.scale / 2 - height / 2;
        assert.ok(value.captionY - lowerEdge >= level * 10 - 1e-9);
        assert.ok(value.scale >= 1 && value.scale <= 1.072);
        assert.ok(Math.abs(value.angle) <= .65);
      }
    }
  }
});

test("artwork drifts continuously, holds on pause, returns smoothly, and removes owned styles on cleanup", () => {
  let playing = true, reduced = false, time = 0;
  globalThis.Spicetify = { Player: { isPlaying: () => playing } };
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const element = () => {
    const values = new Map();
    return { isConnected: true, offsetWidth: 640, offsetHeight: 640, values,
      style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) } };
  };
  const cover = element(), caption = element(), classes = new Set();
  const page = { isConnected: true, ownerDocument: { hidden: false, defaultView: { matchMedia: () => ({ matches: reduced }) } },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    querySelector: selector => selector.endsWith(".MediaImageContainer") ? cover : caption };
  const tick = (count = 1) => { for (let i = 0; i < count; i++) { time += 16; for (const cb of [...callbacks]) cb(time); } };
  const motion = createInstrumentalArtworkMotion(page);
  motion.update(false); assert.equal(callbacks.size, 0);
  motion.update(true); assert.equal(callbacks.size, 1); tick(200);
  const firstAngle = cover.values.get("--vv-art-angle"); tick(100);
  assert.notEqual(cover.values.get("--vv-art-angle"), firstAngle);
  playing = false; tick(100);
  const held = [...cover.values]; tick(30); assert.deepEqual([...cover.values], held);
  motion.update(false); tick();
  assert.ok(Number(cover.values.get("--vv-art-scale")) > 1);
  tick(90); assert.equal(callbacks.size, 0); assert.equal(classes.size, 0);
  assert.equal(cover.values.size, 0); assert.equal(caption.values.size, 0);
  assert.equal(observers[0].disconnected, true);
  motion.update(true); tick(20); reduced = true; tick();
  assert.equal(callbacks.size, 0); assert.equal(cover.values.size, 0);
  reduced = false; motion.update(true); tick(20); motion.destroy();
  assert.equal(callbacks.size, 0); assert.equal(caption.values.size, 0);
});

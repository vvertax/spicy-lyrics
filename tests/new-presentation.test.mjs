import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform, build } from "esbuild";

async function load(path) {
  const { code } = await transform(readFileSync(new URL(path, import.meta.url), "utf8"), { loader: "ts", format: "esm" });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { effectiveOffset, songOffset } = await load("../src/utils/Lyrics/PlaybackOffsets.ts");
const { isInstrumentalBreak } = await load("../src/components/Utils/InstrumentalBreak.ts");
const { outputFiles } = await build({ entryPoints: ["src/components/Utils/QuoteCardRenderer.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { renderQuoteCard, coverCrop } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("song offsets isolate tracks, preserve zero, and follow global timing again after reset", () => {
  const offsets = { "spotify:track:a": -200, "spotify:track:b": 0 };
  assert.equal(effectiveOffset(80, offsets, "spotify:track:a"), -200);
  assert.equal(effectiveOffset(80, offsets, "spotify:track:b"), 0);
  assert.equal(effectiveOffset(80, offsets, "spotify:track:c"), 80);
  delete offsets["spotify:track:a"];
  assert.equal(effectiveOffset(300, offsets, "spotify:track:a"), 300);
  for (const value of [null, [], { x: NaN }, { x: "20" }, { x: 5001 }, Object.create({ x: 100 })]) {
    assert.equal(songOffset(value, "x"), undefined);
  }
});

test("instrumental stage handles intro, seeks, overlapping vocals, and returns before the next vocal", () => {
  const lines = [{ StartTime: 12000, EndTime: 15000 }, { StartTime: 28000, EndTime: 30000 }];
  assert.equal(isInstrumentalBreak(lines, 5000), true);
  assert.equal(isInstrumentalBreak(lines, 11000), false);
  assert.equal(isInstrumentalBreak(lines, 13000), false);
  assert.equal(isInstrumentalBreak(lines, 20000), true);
  assert.equal(isInstrumentalBreak(lines, 26800), false);
  assert.equal(isInstrumentalBreak(lines, 40000), false);
  assert.equal(isInstrumentalBreak([...lines, { StartTime: 14000, EndTime: 24000 }], 20000), false);
  assert.equal(isInstrumentalBreak([...lines, { StartTime: 15000, EndTime: 28000, DotLine: true }], 20000), true);
  assert.equal(isInstrumentalBreak([{ StartTime: 0, EndTime: 10000 }, { StartTime: 17000, EndTime: 19000 }], 13000), false);
});

function context() {
  const painted = [];
  const ctx = {
    canvas: { height: 1080 }, font: "52px SpicyLyrics", fillRect() {}, clearRect() {},
    fillText(text, x, y) { painted.push({ text, x, y, size: Number(this.font.match(/(\d+)px/)[1]) }); },
    measureText(text) { return { width: text.length * Number(this.font.match(/(\d+)px/)[1]) * .55 }; },
  };
  return { ctx, painted };
}
const defaults = { lines: ["A quiet street beneath the evening sky", "We carry little pieces of the light"], title: "Evening", artist: "Example", author: "Lyrics by @example", cover: null, includeCover: true, artworkBackground: false, blur: 20, darken: 55, palette: ["#123", "#012"], usePalette: false, gradient: false, textColor: "#fff", mutedColor: "#ccc", logo: null };

test("all quote compositions and formats keep text above credits, including long titles", () => {
  for (const template of ["classic", "cover-top", "poster", "type"]) {
    for (const format of ["auto", "1080", "1440", "1920"]) {
      const { ctx, painted } = context();
      assert.equal(renderQuoteCard(ctx, { ...defaults, title: "A very long title ".repeat(20), template, format }), true);
      const quotes = painted.filter(row => row.text.startsWith("A quiet") || row.text.startsWith("We carry"));
      assert.equal(quotes.length, 2);
      assert.ok(quotes.every(row => row.y >= 250 && row.y + row.size * 1.35 < ctx.canvas.height - 140));
      assert.ok(painted.every(row => row.y >= 0 && row.y + row.size < ctx.canvas.height));
    }
  }
});

test("oversized quotes cannot export as fitting, and auto format grows for dense quotes", () => {
  const { ctx } = context();
  assert.equal(renderQuoteCard(ctx, { ...defaults, template: "classic", format: "1080", lines: Array(12).fill("A long line of words ".repeat(8)) }), false);
  assert.equal(renderQuoteCard(ctx, { ...defaults, template: "type", format: "auto", lines: Array(12).fill("One line for every passing hour") }), true);
  assert.equal(ctx.canvas.height, 1920);
});

test("portrait and landscape art fill the target without being stretched", () => {
  const wide = coverCrop(1600, 900, 1080, 1920);
  assert.equal(wide.height, 1920); assert.ok(wide.x < 0); assert.ok(Math.abs(wide.width / wide.height - 1600 / 900) < 1e-12);
  const tall = coverCrop(800, 1600, 1080, 1080);
  assert.equal(tall.width, 1080); assert.ok(tall.y < 0); assert.equal(tall.width / tall.height, .5);
});

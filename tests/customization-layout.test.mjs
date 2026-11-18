import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const { outputFiles } = await build({
  stdin: { contents: 'export * from "./src/utils/CustomPalette.ts"; export * from "./src/components/Utils/QuoteVideoLayout.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { customPalette, normalizePaletteHex, paletteContrast, paletteHexToHsv, paletteHsvToHex, VIDEO_QUOTE_FRAMES, defaultVideoLayout, resolveVideoLayout } = await import(
  "data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);

test("a single HEX produces deterministic, legible colors in both schemes", () => {
  assert.equal(normalizePaletteHex(" 82fA19 "), "#82FA19");
  assert.equal(normalizePaletteHex("#F02"), null);
  assert.equal(normalizePaletteHex("#123456;"), null);
  for (const hex of ["#010101", "#FEFEFE", "#0000FF", "#FF00FF", "#FF0000", "#00FF00", "#664B86", "#71A5F9"]) {
    const palette = customPalette(hex);
    assert.deepEqual(palette, customPalette(hex.toLowerCase()));
    const r = palette.roles;
    for (const bg of [r.surface, r.container, r["container-high"], r.tonal]) {
      assert.ok(paletteContrast(r.text, bg) >= 4.5);
      assert.ok(paletteContrast(r.muted, bg) >= 4.5);
      assert.ok(paletteContrast(r.outline, bg) >= 3);
    }
    assert.ok(paletteContrast(r["on-primary"], r.primary) >= 4.5);
    assert.ok(paletteContrast(r.divider, r.container) < paletteContrast(r.outline, r.container));
  }
  const { roles } = customPalette("#71A5F9");
  assert.ok(roles.tonal[2] - roles.tonal[0] > 20);
});

test("picker preserves a saved HEX across RGB and HSV and keeps the chosen hue on gray", () => {
  for (const hex of ["#611300", "#FA4937", "#71A5F9", "#804080", "#00FF42", "#A0A0A0", "#000000", "#FFFFFF"]) {
    assert.equal(paletteHsvToHex(paletteHexToHsv(hex)), hex);
  }
  assert.deepEqual(paletteHexToHsv("#000000", 177), { hue: 177, saturation: 0, value: 0 });
  assert.equal(paletteHsvToHex({ hue: 120, saturation: 1, value: 1 }), "#00FF00");
});

test("each video composition can be moved within its own export frame", () => {
  for (const [format, frame] of Object.entries(VIDEO_QUOTE_FRAMES)) {
    for (const template of ["classic", "cover-top", "poster", "type"]) {
      for (const art of [true, false]) {
        const base = defaultVideoLayout(format, template, art);
        assert.deepEqual(resolveVideoLayout(format, base, {}), base);
        const moved = resolveVideoLayout(format, base, {
          cover: { x: 9000, y: -9999 }, title: { x: -9999, y: 9999 }, lyrics: { x: -9999, y: -9999 },
        });
        for (const box of [moved.cover, moved.title, moved.lyrics]) {
          assert.ok(box.x >= 0 && box.x + box.width <= frame.width);
          assert.ok(box.y >= 0 && box.y + box.height <= frame.height);
        }
        assert.equal(moved.lyrics.focus - moved.lyrics.y, base.lyrics.focus - base.lyrics.y);
      }
    }
  }
});

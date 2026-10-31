import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const { code } = await transform(readFileSync(new URL("../src/components/Utils/KaraokeTiming.ts", import.meta.url), "utf8"), { loader: "ts", format: "esm" });
const { hideKaraokeLine } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("current and past lines remain visible at eight seconds", () => {
  assert.equal(hideKaraokeLine(8000, 8000), false);
  assert.equal(hideKaraokeLine(3000, 8000), false);
});
test("next line reveals exactly 650 ms before its start", () => {
  assert.equal(hideKaraokeLine(10000, 9349), true);
  assert.equal(hideKaraokeLine(10000, 9350), false);
});
test("seeking backward hides future lines again", () => {
  assert.equal(hideKaraokeLine(10000, 15000), false);
  assert.equal(hideKaraokeLine(10000, 5000), true);
});
test("an invalid clock does not blank the lyrics", () => {
  assert.equal(hideKaraokeLine(10000, NaN), false);
});

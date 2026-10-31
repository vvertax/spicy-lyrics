import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const { code } = await transform(readFileSync(new URL("../src/components/Utils/QuoteText.ts", import.meta.url), "utf8"), { loader:"ts", format:"esm" });
const { quoteLineText, wrapQuoteText } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("word-synced text keeps word boundaries", () => {
 assert.equal(quoteLineText({Lead:{Syllables:[{Text:"Ян,"},{Text:"Ян,"},{Text:"братан,"},{Text:"вот"}]}}), "Ян, Ян, братан, вот");
});
test("syllables inside one word stay joined", () => {
 assert.equal(quoteLineText({Lead:{Syllables:[{Text:"нор",IsPartOfWord:true},{Text:"мальный"},{Text:"парень"}]}}), "нормальный парень");
});
test("explicit whitespace and punctuation are preserved", () => {
 assert.equal(quoteLineText({Lead:{Syllables:[{Text:"Hello "},{Text:"world"},{Text:"!"}]}}), "Hello world!");
});
test("wrapping moves a whole word onto the next row", () => {
 assert.deepEqual(wrapQuoteText("one three two", 8, s=>s.length), ["one", "three", "two"]);
});
test("a single oversized token can still wrap", () => {
 assert.deepEqual(wrapQuoteText("abcdefgh", 4, s=>s.length), ["abcd","efgh"]);
});

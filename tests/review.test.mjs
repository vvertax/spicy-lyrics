import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const { code } = await transform(readFileSync(new URL("../src/components/Utils/ReviewModel.ts", import.meta.url),"utf8"),{loader:"ts",format:"esm"});
const { authorHandle, changedTTMLLines } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("author handles preserve dots and strip the optional at sign",()=>{
 assert.equal(authorHandle(" @vvertax. "),"vvertax."); assert.equal(authorHandle("july"),"july");
});
test("links and empty author names are rejected",()=>{
 assert.equal(authorHandle("https://spicylyrics.org/july"),null); assert.equal(authorHandle(""),null);
});
test("comparison catches timing changes and added lines",()=>{
 const a=[{Text:"one",StartTime:1},{Text:"two",StartTime:2}];
 const b=[{Text:"one",StartTime:1.1},{Text:"two",StartTime:2},{Text:"three",StartTime:3}];
 assert.equal(changedTTMLLines(a,b),2); assert.equal(changedTTMLLines(a,structuredClone(a)),0);
});

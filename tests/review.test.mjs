import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const { code } = await transform(readFileSync(new URL("../src/components/Utils/ReviewModel.ts", import.meta.url),"utf8"),{loader:"ts",format:"esm"});
const { authorHandle, changedTTMLLines, comparisonTiming, comparisonDifference } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
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

test("comparison converts both line and word timings from seconds to milliseconds",()=>{
 assert.deepEqual(comparisonTiming({StartTime:1.2,EndTime:2}),{start:1200,end:2000});
 assert.deepEqual(comparisonTiming({Lead:{StartTime:3,EndTime:4.5}}),{start:3000,end:4500});
});
test("comparison distinguishes text, timing and missing lines",()=>{
 const a={Text:"hello",StartTime:1,EndTime:2};
 assert.equal(comparisonDifference(a,{...a,Text:"bye"}),"text");
 assert.equal(comparisonDifference(a,{...a,StartTime:1.5}),"timing");
 assert.equal(comparisonDifference(a,undefined),"missing");
 assert.equal(comparisonDifference(a,{...a}),"");
});

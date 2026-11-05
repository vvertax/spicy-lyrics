import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const {outputFiles}=await build({stdin:{contents:`export {normalizedSubtitleLayout} from './src/components/Utils/SubtitleLayout.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:"esm",platform:"node",plugins:[{name:"stores",setup(b){b.onResolve({filter:/stores\.ts$/},a=>({path:a.path,namespace:"stub"}));b.onLoad({filter:/.*/,namespace:"stub"},()=>({contents:'export const $uiLanguage={get:()=>"en"},$subtitleLayout={};'}))}}]});
const {normalizedSubtitleLayout}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('subtitle layout restores a safe default for missing or malformed saved data',()=>{
 assert.deepEqual(normalizedSubtitleLayout(null),{anchor:'player',width:780,x:.5,y:.5});
 assert.deepEqual(normalizedSubtitleLayout({anchor:'bad',width:NaN,x:Infinity,y:'no'}),{anchor:'player',width:780,x:.5,y:.5});
});
test('subtitle layout clamps stored geometry and preserves supported saved placements',()=>{
 assert.deepEqual(normalizedSubtitleLayout({anchor:'free',width:2000,x:-1,y:2}),{anchor:'free',width:1200,x:0,y:1});
 for(const anchor of ['player','top','corner','free'])assert.equal(normalizedSubtitleLayout({anchor,width:500,x:.2,y:.7}).anchor,anchor);
 assert.equal(normalizedSubtitleLayout({width:1}).width,320);
});

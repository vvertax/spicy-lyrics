import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/components/Utils/ReviewLines.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {reviewLines,reviewTime}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('review exposes every backing part with stable parent identity and independent timing',()=>{
 const data={Content:[{Lead:{StartTime:1,EndTime:3,Syllables:[{Text:'hello'}]},Background:[{StartTime:1.5,EndTime:4,Syllables:[{Text:'под',IsPartOfWord:true},{Text:'вал'},{Text:'эхо'}]},{StartTime:2,EndTime:8,Syllables:[{Text:'tail'}]}]},{Text:'next',StartTime:5,EndTime:6}]};
 const lines=reviewLines(data);assert.equal(lines.length,4);assert.deepEqual(lines.map(l=>l.key),['0:lead','0:0','0:1','1:lead']);assert.equal(lines[1].text,'подвал эхо');assert.equal(lines[1].timeMs,1500);assert.equal(lines[2].endMs,8000);assert.equal(lines[2].index,0);assert.equal(lines[2].backgroundIndex,1);assert.equal(lines[3].text,'next');assert.equal(data.Content[0].Background.length,2);
});
test('review handles unsynced and empty lines and formats times',()=>{
 assert.deepEqual(reviewLines({}),[]);const lines=reviewLines({Content:[{Text:'plain'},{Lead:{Syllables:[]}}]});assert.equal(lines[0].timeMs,0);assert.equal(lines[1].text,'');assert.equal(reviewTime(65120),'1:05.12');
});

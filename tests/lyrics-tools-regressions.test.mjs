import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
async function load(path) {
 const {code}=await transform(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'ts',format:'esm'});
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {getDisplayedLyrics,setDisplayedLyrics}=await load('../src/utils/Lyrics/DisplayedLyrics.ts');
const {followComparisonLine}=await load('../src/components/Utils/ComparisonFollow.ts');
const {wordGrowthShifts,animateSplitWords}=await load('../src/utils/Lyrics/Animator/Lyrics/SplitWordMotion.ts');
test('tools retain displayed lyrics without a fetch cache, reject a previous track and handle static lyrics',()=>{
 const data={Type:'Syllable',Content:[{Text:'test'}]};
 setDisplayedLyrics('spotify:track:a',data);
 assert.equal(getDisplayedLyrics('spotify:track:a'),data);
 assert.equal(getDisplayedLyrics('spotify:track:b'),null);
 setDisplayedLyrics('spotify:track:a',{Type:'Static',Lines:[{Text:'static'}]});
 assert.deepEqual(getDisplayedLyrics('spotify:track:a').Content,[{Text:'static'}]);
 setDisplayedLyrics(null,null);assert.equal(getDisplayedLyrics('spotify:track:a'),null);
});
test('both columns follow independently and resume during an already active line after manual scrolling',()=>{
 const a={manualUntil:0,followed:-1}, b={manualUntil:4000,followed:-1};let left=0,right=0;
 followComparisonLine(a,2,100,()=>left++);followComparisonLine(b,3,100,()=>right++);
 assert.equal(left,1);assert.equal(right,0);
 followComparisonLine(b,3,4001,()=>right++);assert.equal(right,1);
 followComparisonLine(b,3,4010,()=>right++);assert.equal(right,1);
 b.manualUntil=8000;b.followed=-1;
 followComparisonLine(b,3,8001,()=>right++);assert.equal(right,2);
 followComparisonLine(a,0,9000,()=>left++);assert.equal(left,2);
});
test('growth layout keeps unequal pieces touching and the whole word centred',()=>{
 const widths=[100,50,70], growth=[1.1,.8,1.2];
 const shifts=wordGrowthShifts(widths,growth);
 let x=0;const bounds=widths.map((width,i)=>{const center=x+width/2+shifts[i];x+=width;return [center-width*growth[i]/2,center+width*growth[i]/2];});
 assert.ok(Math.abs(bounds[0][1]-bounds[1][0])<1e-9);
 assert.ok(Math.abs(bounds[1][1]-bounds[2][0])<1e-9);
 assert.ok(Math.abs((bounds[0][0]+bounds[2][1])/2-110)<1e-9);
 assert.deepEqual(wordGrowthShifts(widths,[1,1,1]),[0,0,0]);
});
test('layout follows the rendered spring scale continuously, including shrinkage',()=>{
 const start=wordGrowthShifts([100,50],[1,1]);
 const middle=wordGrowthShifts([100,50],[1.02,1]);
 const end=wordGrowthShifts([100,50],[1.04,1]);
 assert.equal(start[1],0);assert.ok(Math.abs(middle[1]-1)<1e-9);assert.ok(Math.abs(end[1]-2)<1e-9);
 assert.ok(wordGrowthShifts([100,50],[.95,1])[1]<0);
});
test('wrapped fragments move independently, preserve lift and reset for reduced motion',()=>{
 const parent={classList:{contains:()=>true}};
 const doc={defaultView:{getComputedStyle:el=>({scale:el.style.scale})}};
 const words=[0,1,2].map(i=>({HTMLElement:{parentElement:parent,ownerDocument:doc,offsetTop:i===2?50:0,offsetLeft:i===1?100:0,offsetWidth:100,style:{scale:i===0?'1.1':'1',transform:'original'}}}));
 const line={HTMLElement:{isConnected:true},Syllables:{Lead:words}};
 animateSplitWords([line],false);
 assert.equal(words[1].HTMLElement.style.translate,'5.000px 0');
 assert.equal(words[2].HTMLElement.style.translate,'0.000px 0');
 assert.equal(words[1].HTMLElement.style.transform,'original');
 words[0].HTMLElement.style.scale='1';animateSplitWords([line],false);
 assert.equal(words[1].HTMLElement.style.translate,'0.000px 0');
 words[0].HTMLElement.style.scale='1.1';animateSplitWords([line],true);
 assert.equal(words[1].HTMLElement.style.translate,'0.000px 0');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let now=0;
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
const model={Types:{Syllable:{Lines:[]},Line:{Lines:[]}}};
globalThis.__comparisonAnimatorTest={model};
const atom=v=>({get:()=>v,set:x=>v=x,listen:()=>()=>{},subscribe:f=>{f(v);return()=>{}}});
globalThis.__comparisonAnimatorTest.atom=atom;
const {outputFiles}=await build({entryPoints:['src/utils/Lyrics/Animator/Lyrics/LyricsAnimator.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'runtime-fixture',setup(b){
 b.onResolve({filter:/(stores|lyrics|experiments|LyricsVirtualizer|Tuning)\.ts$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>{
 const prefix='const atom=globalThis.__comparisonAnimatorTest.atom;';
 if(a.path.endsWith('/lyrics.ts'))return{contents:'export const LyricsObject=globalThis.__comparisonAnimatorTest.model;export const SimpleLyricsMode_LetterEffectsStrengthConfig={LongerThan:1500,Longer:{Glow:.4,YOffset:.45,Scale:1.103},Shorter:{Glow:.285,YOffset:.1,Scale:1.09}};export const preHiddenDotLineMs=200;'};
 if(a.path.endsWith('stores.ts'))return{contents:prefix+'export const $splitWordMotion=atom(true);globalThis.__comparisonAnimatorTest.motionStore=$splitWordMotion;export const $currentLyricsType=atom("Syllable"),$simpleLyricsMode=atom(false),$simpleLyricsModeRenderingType=atom("calculate"),$spaceGravityMode=atom(false);globalThis.__comparisonAnimatorTest.typeStore=$currentLyricsType;'};
 if(a.path.endsWith('experiments.ts'))return{contents:'export const isExperimentEnabled=()=>false;'};
 if(a.path.endsWith('LyricsVirtualizer.ts'))return{contents:'export const isBgPopActive=()=>false,isLyricsListMoving=()=>false,setOnNewElementMounted=()=>{},syncDetachedBackgroundLines=()=>{};'};
 return{contents:prefix+'export const $animatorPreset=atom("Default"),$animatorValues=atom({wordPeakScale:1.0505,letterPeakScale:1.175,verticalStrength:1,glowStrength:1,blurStrength:1,scaleFrequency:.88,scaleDamping:.64,verticalFrequency:1.45,verticalDamping:.4,glowFrequency:1.18,glowDamping:.56});'};
 });
}}]});
const {Animate,createLyricsAnimationSession,setBlurringLastLine}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
function element(){
 const values={};const classes=new Set(['NotSung']);
 return {isConnected:true,style:{setProperty:(k,v)=>values[k]=v,removeProperty:k=>delete values[k],getPropertyValue:k=>values[k]??''},classList:{contains:k=>classes.has(k),add:(...ks)=>ks.forEach(k=>classes.add(k)),remove:(...ks)=>ks.forEach(k=>classes.delete(k)),toggle:(k,v)=>v?classes.add(k):classes.delete(k)},closest:()=>null,nextElementSibling:null,values,classes};
}
function lines(){return [{HTMLElement:element(),StartTime:0,EndTime:3000,Syllables:{Lead:[{HTMLElement:element(),StartTime:0,EndTime:3000,TotalTime:3000}]}}];}
function snapshot(lines){return lines.map(l=>({classes:[...l.HTMLElement.classes].sort(),style:l.HTMLElement.values,words:l.Syllables.Lead.map(w=>w.HTMLElement.values)}));}
test('comparison executes the same word animation as the main renderer and isolates both clocks',()=>{
 const main=lines(),a=lines(),b=lines();model.Types.Syllable.Lines=main;
 const sessionA=createLyricsAnimationSession('Syllable',a),sessionB=createLyricsAnimationSession('Syllable',b);
 for(const [clock,position] of [[16,500],[32,516],[48,532],[64,2000],[80,100],[96,3500]]){
  now=clock;Animate(position);sessionA.animate(position);
  assert.deepEqual(snapshot(a),snapshot(main));
  const before=JSON.stringify(snapshot(main));
  sessionB.animate(position+2000);
  assert.equal(JSON.stringify(snapshot(main)),before);
  assert.equal(model.Types.Syllable.Lines,main);
 }
 sessionA.destroy();sessionB.destroy();
 const before=JSON.stringify(snapshot(a));sessionA.animate(500);assert.equal(JSON.stringify(snapshot(a)),before);
});

test('letter emphasis matches the main renderer',()=>{
 now=200;
 const make=()=>{const value=lines();const word=value[0].Syllables.Lead[0];word.LetterGroup=true;
  word.Letters=[0,1,2].map(i=>({HTMLElement:element(),StartTime:i*1000,EndTime:(i+1)*1000,TotalTime:1000}));return value;};
 const main=make(),a=make();model.Types.Syllable.Lines=main;
 const session=createLyricsAnimationSession('Syllable',a);
 // Align the main renderer's frame clock before comparing spring output.
 Animate(0);session.animate(0);
 for(const position of [200,800,1200,2400,3100,100]){now+=16;Animate(position);session.animate(position);
  assert.deepEqual(a[0].Syllables.Lead[0].Letters.map(l=>l.HTMLElement.values),main[0].Syllables.Lead[0].Letters.map(l=>l.HTMLElement.values));}
 session.destroy();
});
test('line-synced comparison uses the same line animation',()=>{
 now=500;globalThis.__comparisonAnimatorTest.typeStore.set('Line');
 const main=lines(),a=lines();model.Types.Line.Lines=main;setBlurringLastLine(null);
 const session=createLyricsAnimationSession('Line',a);Animate(0);session.animate(0);
 for(const position of [500,1500,3500,100]){now+=16;Animate(position);session.animate(position);assert.deepEqual(snapshot(a),snapshot(main));}
 session.destroy();globalThis.__comparisonAnimatorTest.typeStore.set('Syllable');
});


test('joined-syllable motion is identical in normal lyrics and both comparison sessions',()=>{
 const make=()=>{
  const value=lines(),parent={classList:{contains:name=>name==='word-group'}};
  value[0].Syllables.Lead=[0,1].map(i=>({HTMLElement:element(),StartTime:i*1000,EndTime:(i+1)*1000,TotalTime:1000}));
  value[0].Syllables.Lead.forEach((word,i)=>{
   const el=word.HTMLElement;el.parentElement=parent;el.offsetTop=0;el.offsetLeft=i*100;el.offsetWidth=100;
   el.ownerDocument={defaultView:{getComputedStyle:element=>({scale:element.values.scale??'1'})}};
  });
  return value;
 };
 const main=make(),a=make(),b=make();model.Types.Syllable.Lines=main;
 const sessionA=createLyricsAnimationSession('Syllable',a),sessionB=createLyricsAnimationSession('Syllable',b);
 for(const position of [250,750,1250,2500,100]){
  now+=16;Animate(position);sessionA.animate(position);sessionB.animate(position);
  const offsets=rows=>rows[0].Syllables.Lead.map(word=>word.HTMLElement.style.translate);
  assert.deepEqual(offsets(a),offsets(main));assert.deepEqual(offsets(b),offsets(main));
 }
 globalThis.__comparisonAnimatorTest.motionStore.set(false);
 now+=16;Animate(400);sessionA.animate(400);sessionB.animate(400);
 for(const rows of [main,a,b])for(const word of rows[0].Syllables.Lead)if(word.HTMLElement.parentElement)assert.equal(word.HTMLElement.style.translate,'0.000px 0');
 globalThis.__comparisonAnimatorTest.motionStore.set(true);
 sessionA.destroy();sessionB.destroy();
});

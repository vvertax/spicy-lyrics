import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let reads=0;
const sessions=[], observers=[];
const win={ matchMedia:()=>({matches:true}),getComputedStyle:()=>{reads++;return{transform:'none'}} };
const doc={defaultView:win,createElement:()=>element()};
function element(){
 return {ownerDocument:doc,children:[],style:{},classList:{toggle(){}},setAttribute(){},
 get offsetTop(){reads++;return 0},get offsetHeight(){reads++;return 32},
 getBoundingClientRect(){reads++;return{top:0,height:50}},
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n)}},
 insertBefore(node,ref){node.remove();node.parentElement=this;const i=this.children.indexOf(ref);this.children.splice(i<0?this.children.length:i,0,node)},
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null},
 };
}
globalThis.ResizeObserver=class{constructor(cb){this.cb=cb;observers.push(this)}observe(){}disconnect(){}};
globalThis.__reelPerformance={render:(host)=>{const session={rows:[{element:element()}],positions:[],animate(p){this.positions.push(p)},destroy(){}};sessions.push(session);return session},backing:()=>({update(){},clear(){}})};
const {outputFiles}=await build({entryPoints:['src/components/Utils/SubtitleReel.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'reel-fixture',setup(b){b.onResolve({filter:/\/(ComparisonRenderer|SubtitleBacking)\.ts$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.includes('ComparisonRenderer')?'export const renderComparisonLyrics=globalThis.__reelPerformance.render;':'export const createSubtitleBacking=globalThis.__reelPerformance.backing;'}))}}]});
const {createSubtitleReel}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('held subtitle words keep all animator frames without reading reel geometry or rebuilding sessions',()=>{
 const reel=createSubtitleReel(element(),()=>{});
 const a={text:'Sustained',start:0,end:8000,source:{}},b={text:'Next',start:8000,end:10000,source:{}};
 const lines=[a,b];
 for(let i=0;i<3;i++)reel.update(lines,a,b,[],{},i*16);
 reads=0;const count=sessions[0].positions.length;
 for(let i=0;i<120;i++)reel.update(lines,a,b,[],{},1000+i*16);
 assert.equal(reads,0);assert.equal(sessions.length,2);assert.equal(sessions[0].positions.length-count,120);
 observers[0].cb();reel.update(lines,a,b,[],{},4000);assert.ok(reads>0,'resize must still remeasure');
 reel.update(lines,b,undefined,[],{},8100);assert.equal(sessions.length,2,'the next row must keep its session');
 reel.destroy();
});

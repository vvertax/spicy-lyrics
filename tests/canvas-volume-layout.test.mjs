import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source=readFileSync('src/components/Utils/Fullscreen.ts','utf8');
const {code}=await transform(source.slice(source.indexOf('function setupFullscreenVolumeSlider()'),source.indexOf('const MediaBox_MouseIn =')),{loader:'ts'});
function fixture(canvas,position){
  const nodes=[],observers=[],cleaned=[];
  const anchor=name=>({name,appendChild(node){node.parent=this;},insertAdjacentElement(_where,node){node.parent=this;}});
  const cover=anchor('cover'),dock=anchor('dock'),metadata=anchor('metadata');
  const header={querySelector:selector=>selector.includes('PlaybackControls')?null:metadata};
  const page={classList:{contains:()=>canvas},querySelector:selector=>selector.includes('> .CenteredView')?dock:selector.endsWith('.MediaBox')?cover:header};
  const win={MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){cleaned.push('observer');}}};
  const context=vm.createContext({Fullscreen:{IsOpen:true},IsPIP:false,IsCompactMode:()=>false,Defaults:{ShowVolumeSliderFullscreen:position},PageContainer:page,
    getPageDocument:()=>({createElement(){const node={classList:{toggle(){}},remove(){node.removed=true;}};nodes.push(node);return node;}}),getPageWindow:()=>win,
    CleanUpVolumeSlider(){},SetupVolumeSlider(node,horizontal){node.horizontal=!!horizontal;},keepVolumeSliderInView:()=>()=>cleaned.push('layout')});
  vm.runInContext('let cleanupVolumeLayout=null,ActiveVolumeSliderElement=null;'+code+'\nsetupFullscreenVolumeSlider();',context);
  return {nodes,observers,cleaned,setCanvas:value=>{canvas=value;}};
}
test('Canvas side sliders anchor to the visible dock; ordinary side sliders retain their cover anchor',()=>{
  for(const position of ['Left','Right'])for(const canvas of [false,true]){
    const f=fixture(canvas,position);assert.equal(f.nodes[0].parent.name,canvas?'dock':'cover');
  }
});
test('below slider remains horizontal, and Canvas transitions release the old anchor and observers',()=>{
  const below=fixture(true,'Below');assert.equal(below.nodes[0].horizontal,true);assert.equal(below.nodes[0].parent.name,'metadata');
  const f=fixture(false,'Left');f.setCanvas(true);f.observers[0].callback();
  assert.equal(f.nodes[0].removed,true);assert.equal(f.nodes[1].parent.name,'dock');assert.deepEqual(f.cleaned,['observer','layout']);
  f.setCanvas(false);f.observers[1].callback();assert.equal(f.nodes[2].parent.name,'cover');
});

test('Canvas toolbar anchor updates when the volume row changes header padding without resizing the page', async()=>{
  const canvasSource=readFileSync('src/components/DynamicBG/CanvasImmersive.ts','utf8');
  const observerStart=canvasSource.indexOf('  const resizeObserver = new ResizeObserver(');
  const observerEnd=canvasSource.indexOf('resizeObserver.observe(header);',observerStart)+'resizeObserver.observe(header);'.length;
  const measureStart=canvasSource.indexOf('function updateSquareTop(');
  const measureEnd=canvasSource.indexOf("// A row's own CSS",measureStart);
  const {code}=await transform(canvasSource.slice(observerStart,observerEnd)+'\n'+canvasSource.slice(measureStart,measureEnd),{loader:'ts'});
  let squareTop=151,callback;
  const properties=new Map(),observed=[];
  const media={getBoundingClientRect:()=>({top:squareTop})};
  const header={querySelector:()=>media};
  const nowBar={getBoundingClientRect:()=>({top:54}),style:{setProperty:(k,v)=>properties.set(k,v)}};
  const context=vm.createContext({mount:{header,nowBar},header,nowBar,contentBox:{},active:true,resizeAmbient(){},
    ResizeObserver:class{constructor(cb){callback=cb;}observe(node){observed.push(node);}}});
  vm.runInContext(code,context);
  assert.ok(observed.includes(header),'header content resize must be observed');
  callback();assert.equal(properties.get('--CanvasSquareTop'),'97px');
  squareTop-=48;callback();assert.equal(properties.get('--CanvasSquareTop'),'49px');
  squareTop+=48;callback();assert.equal(properties.get('--CanvasSquareTop'),'97px');
});

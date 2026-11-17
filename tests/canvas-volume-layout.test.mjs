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

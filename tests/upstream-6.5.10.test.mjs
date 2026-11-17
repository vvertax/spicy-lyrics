import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const read = path => readFileSync(path, 'utf8');
const queue = read('src/components/Utils/QueueView.ts');
const autoCode = queue.slice(queue.indexOf('export function SetNoLyricsSong('), queue.indexOf('function DestroyPanel()'));
const pickCode = queue.slice(queue.indexOf('  const pick = (view:'), queue.indexOf('\n  };', queue.indexOf('  const pick = (view:')) + 5);
const { code: queueCode } = await transform(autoCode.replace('export function', 'function') + '\n' + pickCode, {loader:'ts',format:'cjs'});
function autoQueue() {
  const model = {uri:'a',enabled:false,canShow:true,opened:0,closed:0,listener:null};
  const context = vm.createContext({exports:{},model,queueMicrotask:callback=>callback(),
    SpotifyPlayer:{GetUri:()=>model.uri},
    $showQueueWhenNoLyrics:{get:()=>model.enabled,listen:callback=>{model.listener=callback;}},
  });
  vm.runInContext('let noLyricsUri=null,autoOpened=false,dismissedUri=null,open=false;'+
    'function OpenQueue(){if(!model.canShow)return;open=true;model.opened++;}'+
    'function CloseQueue(){open=false;autoOpened=false;model.closed++;}'+queueCode,context);
  return {model,run:code=>vm.runInContext(code,context)};
}
test('no-lyrics queue is opt-in, persists across missing songs and closes when lyrics arrive',()=>{
  const f=autoQueue();f.run('SetNoLyricsSong("a")');assert.equal(f.model.opened,0);
  f.model.enabled=true;f.model.listener();assert.equal(f.run('open'),true);
  f.model.uri='b';f.run('SetNoLyricsSong("b")');assert.equal(f.model.opened,1);
  f.run('SetNoLyricsSong(null)');assert.equal(f.run('open'),false);assert.equal(f.model.closed,1);
});
test('manually opened queue stays open when lyrics arrive or auto-queue is disabled',()=>{
  const f=autoQueue();f.model.enabled=true;f.run('SetNoLyricsSong("a"); pick("queue"); SetNoLyricsSong(null)');
  f.model.enabled=false;f.model.listener();assert.equal(f.run('open'),true);assert.equal(f.model.closed,0);
});
test('selecting lyrics suppresses auto-open for this song but the next missing song may open it',()=>{
  const f=autoQueue();f.model.enabled=true;f.run('SetNoLyricsSong("a"); pick("lyrics"); SetNoLyricsSong("a"); SyncAutoQueue()');
  assert.equal(f.run('open'),false);assert.equal(f.model.opened,1);
  f.model.uri='b';f.run('SetNoLyricsSong("b")');assert.equal(f.run('open'),true);
});
test('auto-queue ignores stale tracks and opens only on an eligible surface',()=>{
  const f=autoQueue();f.model.enabled=true;f.run('SetNoLyricsSong("old")');assert.equal(f.model.opened,0);
  f.model.canShow=false;f.run('SetNoLyricsSong("a")');assert.equal(f.run('autoOpened'),false);
  f.model.canShow=true;f.run('SyncAutoQueue()');assert.equal(f.model.opened,1);
  f.model.enabled=false;f.model.listener();assert.equal(f.run('open'),false);
});

const bloom=read('src/utils/Lyrics/Animator/Lyrics/BloomAnimator.ts');
const bloomParts=bloom.slice(bloom.indexOf('function stepRefreshedLetter('),bloom.indexOf('// Promote an element'))+
  bloom.slice(bloom.indexOf('const PARK_OFFSET ='),bloom.indexOf('// Lines blur through text-shadow'));
const {code:bloomCode}=await transform(bloomParts,{loader:'ts',format:'cjs'});
test('settled Bloom letters release rounded-zero transforms while moving letters keep their layer',()=>{
  const context=vm.createContext({RefreshedEmphasis:{BlurEm:0,BlurPx:0},RefreshedLift:{Em:0},
    setStyleIfChanged:(element,key,value)=>{element.style[key]=value;}});
  vm.runInContext(bloomCode,context);
  context.letter={HTMLElement:{style:{}}};context.flame={Scale:[1],X:[.000001],Y:[-.000001],Glow:[0],Moving:[false]};
  vm.runInContext('stepRefreshedLetter(letter,0,flame)',context);assert.equal(context.letter.HTMLElement.style.transform,'none');
  context.flame.Moving[0]=true;vm.runInContext('stepRefreshedLetter(letter,0,flame)',context);
  assert.match(context.letter.HTMLElement.style.transform,/translate3d/);
});
test('Bloom parks only settled word offsets and leaves its animation cache intact',()=>{
  const cache=new WeakMap(), writes=[];
  const elements=[.0004,-.0005,.001].map(value=>{const element={style:{transform:'translate3d(...)'}};cache.set(element,new Map([['transform',value]]));return element;});
  const context=vm.createContext({_styleCache:cache,queueStyle:(el,key,value)=>writes.push({el,key,value}),line:{querySelectorAll:()=>elements}});
  vm.runInContext(bloomCode+'\nparkSettledLine(line)',context);
  assert.deepEqual(writes.map(w=>w.el),elements.slice(0,2));assert.ok(writes.every(w=>w.key==='transform'&&w.value===''));
  assert.equal(cache.get(elements[0]).get('transform'),.0004);
});

test('legacy navigation follows root class changes without rescanning the document',async()=>{
  const classes=new Set(),body=new Set(),callbacks=[];let queries=0,globalNav;
  const root={classList:{contains:name=>classes.has(name)}};
  const context=vm.createContext({$isGlobalNav:{set:value=>{globalNav=value;}},document:{querySelector:()=>{queries++;return root;},body:{classList:{toggle:(name,on)=>on?body.add(name):body.delete(name)}}},
    MutationObserver:class{constructor(callback){callbacks.push(callback);}observe(){}}});
  const source=read('src/utils/uiState.ts');
  const {code}=await transform(source.slice(source.indexOf('(function watchGlobalNav()')),{loader:'ts'});
  vm.runInContext(code,context);
  assert.equal(globalNav,false);assert.ok(body.has('SpicyLyrics_LegacyNav'));
  classes.add('global-nav');callbacks[0]();assert.equal(globalNav,true);assert.equal(body.size,0);
  assert.equal(queries,1);
});

test('cascade rows clear a tiny remaining translate on the exact final frame',async()=>{
  const source=read('src/utils/Lyrics/LyricsVirtualizer.ts');
  const method=source.slice(source.indexOf('  private _drawCascadeRow('),source.indexOf('  private _cascadeStep ='));
  const {code}=await transform('class CascadeFixture { '+method+' };',{loader:'ts'});
  const wrapper={style:{translate:'0 0.01px'}}, trailing=[];
  const context=vm.createContext({wrapper,trailing,row:{p:0,drawn:.005}});
  vm.runInContext(code+'\nconst fixture=new CascadeFixture(); fixture._cascadeScroll=0; fixture._wrappers=[wrapper]; fixture._allElements=[wrapper]; fixture._setTrailingOffset=value=>trailing.push(value); fixture._drawCascadeRow(0,row);',context);
  assert.equal(wrapper.style.translate,'');assert.equal(context.row.drawn,0);assert.deepEqual(trailing,[0]);
});

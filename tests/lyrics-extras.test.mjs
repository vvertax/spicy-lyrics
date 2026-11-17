import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let writes = 0;
function element() {
  let text = '', hidden = false;
  return { parentElement: null, children: [], handlers: {}, attributes: {}, style: { setProperty() {}, removeProperty() {} },
    get textContent() { return text; }, set textContent(value) { writes++; text = value; },
    get hidden() { return hidden; }, set hidden(value) { writes++; hidden = value; },
    setAttribute(key,value) { this.attributes[key]=value; }, addEventListener(name,handler) { this.handlers[name]=handler; }, removeEventListener(name) { delete this.handlers[name]; },
    append(...nodes) { nodes.forEach(node => { node.remove(); node.parentElement = this; this.children.push(node); }); },
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; },
  };
}
const footer = element(), arrow = element(), page = element();
const view = { clearTimeout() {}, setTimeout() {} };
page.ownerDocument = { defaultView: view, createElement: element };
page.querySelector = selector => selector === "#ScrollToActiveLyric" ? arrow : null;
const fx = globalThis.__extrasFixture = { tick: null, footer, data: { Type: 'Syllable', sourceDisplayName: 'Spicy Lyrics', fromCache: true }, state: { active: false, eligible: false, remaining: 0, duration: 750 } };
const stubs = {
 'sonner': 'export const toast={error(){}};',
 'CreateLyricsFooter.ts': 'export const GetPageLyricsFooter=()=>globalThis.__extrasFixture.footer,PinFooterDetailWithoutWriters=()=>{},UnregisterLyricsFooterDetail=()=>{};',
 'stores.ts': 'const f=globalThis.__extrasFixture;const store=(value)=>{let v=value;const listeners=new Set();return{get:()=>v,set:next=>{v=next;listeners.forEach(cb=>cb(v))},listen:cb=>{listeners.add(cb);return()=>listeners.delete(cb)}}};export const $ctrlWheelLyricsZoom=store(false),$lyricsSize=store(100),$uiLanguage=store("en");f.zoom=$ctrlWheelLyricsZoom;f.size=$lyricsSize;const enabled={get:()=>true};export const $showLyricsSourceInfo=enabled,$showScrollResumeIndicator=enabled,$currentLyricsData={set(){}};',
 'experiments.ts': 'export const $experiment=()=>({get:()=>false,listen:()=>()=>{}});',
 'WindowActivity.ts': 'export const visibleInterval=(win,cb)=>{globalThis.__extrasFixture.tick=cb;return()=>{}};',
 'DisplayedLyrics.ts': 'export const getDisplayedLyrics=()=>globalThis.__extrasFixture.data;',
 'fetchLyrics.ts': 'export const getSongKey=()=>"track",LyricsStore={},SessionTTMLStore=new Map();export default async()=>[];',
 'Applyer.ts': 'export const ApplyLyricsIfCurrent=()=>{};',
 'SpotifyPlayer.ts': 'export const SpotifyPlayer={GetUri:()=>"spotify:track:test"};',
 'ScrollToActiveLine.ts': 'export const getScrollResumeState=()=>globalThis.__extrasFixture.state;',
 'LyricsVirtualizer.ts': 'export const triggerRemeasureLV=()=>{};',
 'translate.ts': 'export const translateUi=s=>s;',
};
const { outputFiles } = await build({ entryPoints: ['src/components/Utils/LyricsExtras.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'extras-fixture', setup(b) {
 b.onResolve({filter:/.*/}, a => { const name=a.path.split('/').pop(); if(stubs[name]) return {path:name,namespace:'fixture'}; });
 b.onLoad({filter:/.*/,namespace:'fixture'}, a=>({contents:stubs[a.path]}));
} }] });
const { bindLyricsExtras } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
bindLyricsExtras(page);
test('unchanged source details and an idle countdown produce no repeated DOM writes', () => {
 fx.tick(); writes=0;
 for(let i=0;i<30;i++)fx.tick();
 assert.equal(writes,0);
});
test('countdown appears only when automatic following is eligible, and hides for a distant active line', () => {
 fx.state={active:true,eligible:true,remaining:500,duration:750}; fx.tick();
 const counter=arrow.children[0]; assert.equal(counter.hidden,false); assert.equal(counter.textContent,'0.5 s');
 fx.state.eligible=false; fx.tick(); assert.equal(counter.hidden,true);
 fx.state.eligible=true; fx.state.remaining=0; fx.tick(); assert.equal(counter.hidden,true);
});

test('Ctrl wheel changes the saved text size, shows its actual percentage and resets through the badge', () => {
 let prevented=0;const event={ctrlKey:true,metaKey:false,deltaY:-120,target:{closest:s=>s==='.LyricsContainer'?{}:null},preventDefault(){prevented++},stopPropagation(){}};
 fx.zoom.set(true); fx.size.set(150);page.handlers.wheel(event);assert.equal(fx.size.get(),155);assert.equal(prevented,1);
 const badge=page.children.find(node=>node.className==='vv-zoom-badge');assert.equal(badge.hidden,false);assert.equal(badge.children[1].textContent,'155%');
 badge.onclick();assert.equal(fx.size.get(),100);assert.equal(badge.children[1].textContent,'100%');
 fx.size.set(130);fx.zoom.set(false);page.handlers.wheel(event);assert.equal(fx.size.get(),130);assert.equal(prevented,1);assert.equal(badge.hidden,true);
 fx.zoom.set(true);page.handlers.wheel({...event,ctrlKey:false});assert.equal(fx.size.get(),130);assert.equal(prevented,1);
});

test('Ctrl wheel over the page background still updates Lyrics Size instead of browser zoom',()=>{
 fx.zoom.set(true);fx.size.set(100);let prevented=0;
 page.handlers.wheel({ctrlKey:true,metaKey:false,deltaY:-1,target:{closest:()=>null},preventDefault(){prevented++},stopPropagation(){}});
 assert.equal(fx.size.get(),105);assert.equal(prevented,1);
 page.handlers.wheel({ctrlKey:true,metaKey:false,deltaY:-1,target:{closest:()=>({})},preventDefault(){prevented++},stopPropagation(){}});
 assert.equal(fx.size.get(),105);assert.equal(prevented,1);
});

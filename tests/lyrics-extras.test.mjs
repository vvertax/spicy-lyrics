import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let writes = 0;
function element() {
  let text = '', hidden = false;
  return { parentElement: null, children: [], style: { setProperty() {}, removeProperty() {} },
    get textContent() { return text; }, set textContent(value) { writes++; text = value; },
    get hidden() { return hidden; }, set hidden(value) { writes++; hidden = value; },
    setAttribute() {}, addEventListener() {}, removeEventListener() {},
    append(...nodes) { nodes.forEach(node => { node.remove(); node.parentElement = this; this.children.push(node); }); },
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; },
  };
}
const footer = element(), arrow = element(), page = element();
const view = { clearTimeout() {}, setTimeout() {} };
page.ownerDocument = { defaultView: view, createElement: element };
page.querySelector = () => arrow;
const fx = globalThis.__extrasFixture = { tick: null, footer, data: { Type: 'Syllable', sourceDisplayName: 'Spicy Lyrics', fromCache: true }, state: { active: false, eligible: false, remaining: 0, duration: 750 } };
const stubs = {
 'sonner': 'export const toast={error(){}};',
 'CreateLyricsFooter.ts': 'export const GetPageLyricsFooter=()=>globalThis.__extrasFixture.footer,PinFooterDetailWithoutWriters=()=>{},UnregisterLyricsFooterDetail=()=>{};',
 'stores.ts': 'const enabled={get:()=>true};export const $showLyricsSourceInfo=enabled,$showScrollResumeIndicator=enabled,$currentLyricsData={set(){}},$uiLanguage={get:()=>"en"};',
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

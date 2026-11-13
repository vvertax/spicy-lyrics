import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
globalThis.__popupLoops=new Map();
const {outputFiles}=await build({stdin:{contents:'export {IntervalManager} from "./src/utils/IntervalManager.ts";export * from "./src/utils/VisualWindow.ts";',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'popup-loop-fixtures',setup(b){
 b.onResolve({filter:/(?:WindowActivity\.ts|AnimationFrameLoop\.ts|Logger)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path.endsWith('Logger')?'export default class Logger {warn(){}error(){}}':path.endsWith('WindowActivity.ts')?'export function visibleInterval(win,cb){const set=globalThis.__popupLoops.get(win);set.add(cb);return()=>set.delete(cb)}':'export function onAnimationFrame(cb,win){const set=globalThis.__popupLoops.get(win);set.add(cb);return()=>set.delete(cb)}'}));
}}]});
const {IntervalManager,notifyVisualWindowChanged}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('scroll frames move from a hidden host into visible Popup and return without duplicate loops',()=>{
 const host={hidden:true},popup={hidden:false};globalThis.__popupLoops.set(host,new Set());globalThis.__popupLoops.set(popup,new Set());
 let target=host,ticks=0;const manager=new IntervalManager(Infinity,()=>ticks++,()=>target);manager.Start();
 const frame=win=>{if(!win.hidden)for(const cb of [...globalThis.__popupLoops.get(win)])cb();};
 frame(host);assert.equal(ticks,0);
 for(let i=0;i<5;i++){
  target=popup;notifyVisualWindowChanged();assert.equal(globalThis.__popupLoops.get(host).size,0);assert.equal(globalThis.__popupLoops.get(popup).size,1);frame(popup);
  target=host;notifyVisualWindowChanged();assert.equal(globalThis.__popupLoops.get(popup).size,0);assert.equal(globalThis.__popupLoops.get(host).size,1);
 }
 assert.equal(ticks,5);manager.Destroy();notifyVisualWindowChanged();assert.equal(globalThis.__popupLoops.get(host).size,0);
});
test('finite visual timers also transfer; stopped managers stay stopped after window changes',()=>{
 const host={},popup={};globalThis.__popupLoops.set(host,new Set());globalThis.__popupLoops.set(popup,new Set());let target=host;
 const manager=new IntervalManager(.5,()=>{},()=>target);manager.Start();target=popup;notifyVisualWindowChanged();assert.equal(globalThis.__popupLoops.get(host).size,0);assert.equal(globalThis.__popupLoops.get(popup).size,1);
 manager.Stop();target=host;notifyVisualWindowChanged();assert.equal(globalThis.__popupLoops.get(host).size,0);assert.equal(globalThis.__popupLoops.get(popup).size,0);manager.Destroy();
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
globalThis.__roman={below:true,position:0,frames:new Set()};
const {outputFiles}=await build({entryPoints:['src/utils/Lyrics/Applyer/Utils/RomanLine.ts','src/utils/Lyrics/RomajiSpacing.ts'],outdir:'unused',bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'roman-fixtures',setup(b){
 b.onResolve({filter:/(?:stores|AnimationFrameLoop|GetProgress|Shared)\.ts$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path.endsWith('stores.ts')?'export const $romanizationBelow={get:()=>globalThis.__roman.below},$translationsBelow={get:()=>false};':path.endsWith('AnimationFrameLoop.ts')?'export function onAnimationFrame(cb){globalThis.__roman.frames.add(cb);return()=>globalThis.__roman.frames.delete(cb)}':path.endsWith('GetProgress.ts')?'export default ()=>globalThis.__roman.position;':'export const timeOffset=0;'}));
}}]});
const imports=await Promise.all(outputFiles.map(file=>import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const api=imports.find(module=>module.ApplyRomanRows),spacing=imports.find(module=>module.RomajiWordBreaks);
function element(doc){const el={ownerDocument:doc,children:[],isConnected:true,parentElement:null,values:{},classList:{add(){},remove(){}},style:{setProperty(key,value){el.values[key]=value;}},replaceChildren(){this.children=[];},append(child){this.children.push(child);child.parentElement=this;},remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}};return el;}
const doc={defaultView:{},createElement(){return element(doc);}};
test('lead and multiple backing rows retain independent timing, joined parts and clear all subscriptions',()=>{
 const syllables=[{Text:'こん',TransliteratedText:'kon',StartTime:0,EndTime:1,IsPartOfWord:true},{Text:'にち',TransliteratedText:'nichi',StartTime:1,EndTime:2}];
 const lyrics={Type:'Syllable',Content:[{Lead:{Syllables:syllables},Background:[{Syllables:[{Text:'声',TransliteratedText:'koe',StartTime:1,EndTime:3}]},{Syllables:[{Text:'音',TransliteratedText:'oto',StartTime:2,EndTime:4}]}]}]};
 const lead=element(doc),bg1=element(doc),bg2=element(doc);
 api.ApplyRomanRows(lyrics,[{HTMLElement:element(doc),DotLine:true},{HTMLElement:lead},{HTMLElement:bg1,BGLine:true},{HTMLElement:bg2,BGLine:true}],true);
 assert.equal(lead.children[0].children.map(child=>child.textContent).join(''),'konnichi');assert.equal(bg2.children[0].children[0].textContent,'oto');
 globalThis.__roman.position=1500;for(const frame of globalThis.__roman.frames)frame();
 assert.equal(lead.children[0].children[0].values['--SL_RomanFill'],'1');assert.equal(lead.children[0].children[1].values['--SL_RomanFill'],'0.5');assert.equal(bg2.children[0].children[0].values['--SL_RomanFill'],'0');
 api.ClearRomanRows();assert.equal(lead.children.length,0);assert.equal(globalThis.__roman.frames.size,0);
});
test('line/static pronunciation suppresses duplicate Latin text and replacement mode removes rows',()=>{
 const el=element(doc),lyrics={Type:'Line',Content:[{Text:'星',TransliteratedText:'hoshi',StartTime:0,EndTime:3}]};
 api.ApplyRomanRows(lyrics,[{HTMLElement:el}],true);assert.equal(el.children[0].children[0].textContent,'hoshi');
 globalThis.__roman.below=false;api.ApplyRomanRows(lyrics,[{HTMLElement:el}],true);assert.equal(el.children.length,0);assert.equal(globalThis.__roman.frames.size,0);globalThis.__roman.below=true;
 api.ApplyRomanRows({Type:'Static',Lines:[{Text:'Hello!',TransliteratedText:'hello'}]},[{HTMLElement:el}],true);assert.equal(el.children.length,0);
 assert.deepEqual(spacing.RomajiWordBreaks(['wa','ta','shi','wa'],'watashi wa'),[false,false,true,false]);
});
test('recording consumes the first Escape without closing lyrics; the next Escape is available to navigation',()=>{
 const source=readFileSync('src/components/Utils/CreativeTools.ts','utf8');const snippet=source.slice(source.indexOf('export function consumeRecordingEscape'),source.indexOf('function state(')).replace('export function','function').replace('event: KeyboardEvent, page: HTMLElement | null | undefined','event, page').replace('): boolean',')').replace('modes.get(page)!','modes.get(page)');
 const page={classList:{remove(name){assert.equal(name,'VV_Recording');}}},modes=new WeakMap([[page,{recording:true}]]);let prevented=0,stopped=0;
 const ctx=vm.createContext({modes,page,toast:{success(){}},event:{key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}}});vm.runInContext(snippet,ctx);
 assert.equal(vm.runInContext('consumeRecordingEscape(event,page)',ctx),true);assert.equal(prevented,1);assert.equal(stopped,1);
 assert.equal(vm.runInContext('consumeRecordingEscape(event,page)',ctx),false);
 const app=readFileSync('src/app.tsx','utf8');const handler=app.slice(app.indexOf('window.addEventListener("keydown", async'));
 assert.ok(handler.indexOf('consumeRecordingEscape(e, PageContainer)')<handler.indexOf('await handleEscapeKey()'));
});

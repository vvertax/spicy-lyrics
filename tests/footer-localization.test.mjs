import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let language='en',refresh;
globalThis.__footerLanguage={get:()=>language,subscribe:callback=>{refresh=callback;callback();return()=>{};}};
globalThis.MutationObserver=class{observe(){}disconnect(){}};
const {outputFiles}=await build({entryPoints:['src/utils/i18n/runtime.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'locale-store',setup(b){
  b.onResolve({filter:/\/stores\.ts$/},()=>({path:'store',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const $uiLanguage=globalThis.__footerLanguage;'}));
}}]});
const {localizeDocument}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function element(className,text,parent=null){
  const node={nodeType:1,className,parentElement:parent,children:[],closest(selector){let node=this;while(node){if(selector.split(',').some(s=>s.trim()===`.${node.className}`))return node;node=node.parentElement;}return null;},getAttribute:()=>null};
  if(text!==undefined)node.children.push({nodeType:3,nodeValue:text,parentElement:node});
  return node;
}
test('footer labels switch languages while names, provider values and next-track text stay unchanged',()=>{
  const info=element('SongInfo');
  const captions=[element('CreditsLabel','Written by'),element('CreditsLabel','Provided by'),element('SongInfoLead','Community lyrics',info),element('SongInfoRole','Made by',info),element('SongInfoRole','Uploaded by',info),element('NextUpLabel','Up Next')];
  const names=[element('CreditsValue','New'),element('SongInfoName','Settings',info),element('NextUpTrack','New'),element('NextUpTrack','july')];
  // Put metadata under a regular UI scope too: explicit exclusions must win.
  const outer=element('slm');for(const node of [...captions,...names])if(!node.parentElement)node.parentElement=outer;
  const all=[...captions,...names];
  const doc={documentElement:{},defaultView:{addEventListener(){}},querySelectorAll:()=>all,createTreeWalker(node){let i=0;return{nextNode:()=>node.children?.[i++]??null};}};
  localizeDocument(doc);
  const values=nodes=>nodes.map(n=>n.children[0].nodeValue);
  language='ru';refresh();
  assert.deepEqual(values(captions),['Авторы песни','Источник','Текст сообщества','Синхронизация','Загрузил','Далее']);
  assert.deepEqual(values(names),['New','Settings','New','july']);
  language='en';refresh();
  assert.deepEqual(values(captions),['Written by','Provided by','Community lyrics','Made by','Uploaded by','Up Next']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { targetLoader } from '../project/hosting-target.mjs';

const read = path => readFileSync(path, 'utf8');
test('each installer imports its own entrypoint and preserves explicit channel choices',async()=>{
  for(const host of ['lrc.vvrtx.lol','preview.example']) for(const selected of ['Stable','SL']) {
    const storage=new Map([['SpicyLyrics-sl-loader-initialized','1'],['SpicyLyrics-buildChannel',selected]]),loaded=[];
    const context=vm.createContext({Spicetify:{LocalStorage:{get:key=>storage.get(key),set:(key,value)=>storage.set(key,value)}},Date,setTimeout,
      loadModule:async url=>{loaded.push(url);}});
    const source=targetLoader(read('hosting/spicy-lyrics-sl.mjs'),host).replace('await import(', 'await loadModule(');
    await vm.runInContext(source,context);
    assert.equal(loaded.length,1);assert.ok(loaded[0].startsWith(`https://${host}/entrypoint.mjs?v=`));
    assert.equal(storage.get('SpicyLyrics-buildChannel'),selected==='SL'?'vvertax Edition':selected);
  }
});
test('alternate channel manager renders Russian labels and the canonical fork name',()=>{
  const nodes=[];
  const document={createElement:tag=>({tag,children:[],style:{},appendChild(node){this.children.push(node);},append(...nodes){this.children.push(...nodes);},addEventListener(){},setAttribute(){}}),
    querySelector:()=>null,body:{appendChild:node=>nodes.push(node)},documentElement:{},contains:()=>true};
  const storage=new Map([['SL:settings','{"uiLanguage":"ru"}'],['SpicyLyrics-buildChannel','SL'],['SpicyLyrics-customChannels',JSON.stringify({'vvertax Edition':['preview.example','preview.example'],SL:['preview.example','preview.example']})]]);
  const context=vm.createContext({document,navigator:{language:'en-US'},window:{innerWidth:1280,innerHeight:900,addEventListener(){},dispatchEvent(){}},
    Spicetify:{LocalStorage:{get:key=>storage.get(key)??null}},MutationObserver:class{observe(){}},setTimeout});
  const source=targetLoader(read('builds/main/entrypoint.mjs'),'preview.example').replace(/^import .*"\.\/release-hotfix\.mjs";\s*$/m, "");
  vm.runInContext(source.slice(0,source.indexOf('// ─── Stable Settings Injection'))+'\nshowChannelManager();',context);
  const texts=[];function collect(node){if(node.textContent)texts.push(node.textContent);for(const child of node.children??[])collect(child);}nodes.forEach(collect);
  for(const label of ['Управление каналами','vvertax Edition','Выбран','Переключить','Добавить канал','lrc.vvrtx.lol / lrc.vvrtx.lol'])assert.ok(texts.includes(label),label);
  assert.ok(!texts.includes('SL'));assert.ok(!texts.includes('Manage Branches'));
});
test('target generation rejects unsupported hosts and missing markers',()=>{
  for(const host of ['../outside','https://elsewhere.example','example.com/path','',null]) assert.throws(()=>targetLoader(read('hosting/spicy-lyrics-sl.mjs'),host),/Unsupported/);
  assert.throws(()=>targetLoader('old loader','preview.example'),/Missing/);
});

test('fresh alternate installers register a separate channel instead of repointing production',async()=>{
 for(const host of ['lrc.vvrtx.lol','preview.example']) {
  const storage=new Map(),loaded=[];
  const context=vm.createContext({Spicetify:{LocalStorage:{get:key=>storage.get(key),set:(key,value)=>storage.set(key,value)}},Date,setTimeout,loadModule:async url=>loaded.push(url)});
  await vm.runInContext(targetLoader(read('hosting/spicy-lyrics-sl.mjs'),host).replace('await import(', 'await loadModule('),context);
  assert.equal(storage.get('SpicyLyrics-buildChannel'),host==='lrc.vvrtx.lol'?'vvertax Edition':'vvertax Edition Dev');
  if(host!=='lrc.vvrtx.lol')assert.deepEqual(JSON.parse(storage.get('SpicyLyrics-customChannels'))['vvertax Edition Dev'],[host,host]);
 }
});

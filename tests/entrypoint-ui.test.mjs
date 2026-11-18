import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
const source=readFileSync('builds/main/entrypoint.mjs','utf8').replace(/^import .*"\.\/release-hotfix\.mjs";\s*$/m, "");
function loader(saved,system='en-US') {
 const document={createElement:tag=>({tag,attributes:{},children:[],setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.children.push(...nodes);}})};
 const context=vm.createContext({Spicetify:{LocalStorage:{get:()=>saved}},navigator:{language:system},document,usesOfficialStatus:()=>false});
 vm.runInContext(source.slice(0,source.indexOf('// Built-in channel'))+source.slice(source.indexOf('const h = (tag, props,'),source.indexOf('const channelRecoveryControl =')),context);
 return code=>vm.runInContext(code,context);
}
test('standalone recovery UI uses saved language before the extension can load',()=>{
 const ru=loader('{"uiLanguage":"ru"}');
 assert.equal(ru('loaderText("Couldn\'t connect")'),'Не удалось подключиться');
 assert.equal(ru('loaderText("Retry in background")'),'Повторять в фоне');
 const dynamic="Couldn't load the My Channel channel from api.example / files.example. Check your connection or switch build channels.";
 const translated=ru(`loaderText(${JSON.stringify(dynamic)})`);
 assert.match(translated,/Не удалось загрузить канал My Channel/);assert.match(translated,/api\.example \/ files\.example/);
 assert.equal(loader('{"uiLanguage":"en"}','ru-RU')('loaderText("Try again")'),'Try again');
 assert.equal(loader('malformed','ru-RU')('loaderText("Try again")'),'Повторить');
});
test('recovery support link renders the fork issue URL and a translated label',()=>{
 const run=loader('{"uiLanguage":"ru"}');const note=run('discordNote("Still not working? Ask on our")');
 const link=note.children.find(node=>node.tag==='a');
 assert.equal(link.attributes.href,'https://github.com/vvertax/spicy-lyrics/issues');
 assert.equal(link.children[0],'трекере ошибок');assert.match(note.children[0],/Проблема осталась/);
});
test('runtime UI contains no operational links to the base forks; documentation credits remain allowed',()=>{
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):/\.(?:tsx?|mjs|js)$/.test(entry.name)?[join(dir,entry.name)]:[]);
 for(const file of [...walk('src'),...walk('builds'),'hosting/spicy-lyrics-sl.mjs']) {
  assert.doesNotMatch(readFileSync(file,'utf8'),/https?:[^\s"'<>]*(?:github\.com|githubusercontent\.com)\/(?:iPixelGalaxy|Ruytha)\//i,file);
 }
});

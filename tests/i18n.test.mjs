import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const { outputFiles }=await build({entryPoints:[new URL("../src/utils/i18n/translate.ts",import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:')],bundle:true,write:false,format:"esm",platform:"node"});
const { translateUi }=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
test("English preserves original UI text",()=>assert.equal(translateUi("Settings","en"),"Settings"));
test("Russian translates UI labels and shortcuts",()=>{
 assert.equal(translateUi("Settings","ru"),"Настройки");
 assert.equal(translateUi("Karaoke · Alt+Shift+K","ru"),"Караоке · Alt+Shift+K");
});
test("unknown text and usernames are preserved",()=>assert.equal(translateUi("@vvertax. · My song","ru"),"@vvertax. · My song"));
test("dynamic versions and quote counts translate",()=>{
 assert.equal(translateUi("Updated to 1.6.0","ru"),"Обновлено до 1.6.0");
 assert.equal(translateUi("7 / 12 lines","ru"),"7 / 12 строк");
});
import { readFileSync } from "node:fs";
test("Russian covers all lyrics notices and their diagnostic code",()=>{
 const source=readFileSync(new URL('../src/utils/Lyrics/LyricsNotice.ts',import.meta.url),'utf8');
 const notices=source.slice(source.indexOf('const NOTICES:'),source.indexOf('export function HasNotice'));
 for(const [,text] of notices.matchAll(/(?:title|body): "([^"]+)"/g)){
  assert.notEqual(translateUi(text,'ru'),text,`Untranslated notice: ${text}`);
  assert.equal(translateUi(text,'en'),text);
 }
 assert.equal(translateUi('Code: lyrics-not-found (404)','ru'),'Код: lyrics-not-found (404)');
 assert.equal(translateUi('Copied','ru'),'Скопировано');
 assert.equal(translateUi("Couldn't copy",'ru'),'Не удалось скопировать');
});

test("update dialogs translate dynamic versions and split React text nodes",()=>{
 assert.equal(translateUi('Version 1.7.0 is out','ru'),'Доступна версия 1.7.0');
 assert.equal(translateUi("You're on ",'ru'),'Установлена версия ');
 assert.equal(translateUi("You're on 1.6.4.",'ru'),'Установлена версия 1.6.4.');
 assert.equal(translateUi('Updating reloads Spotify, which takes a few seconds.','ru'),'При обновлении Spotify перезапустится. Это займёт несколько секунд.');
 assert.equal(translateUi('See what changed in the ','ru'),'Изменения описаны в ');
 assert.equal(translateUi('patch notes','ru'),'списке изменений');
 assert.equal(translateUi('Spicy Lyrics 1.7.0 is out','ru'),'Доступна Spicy Lyrics 1.7.0');
 assert.equal(translateUi('Version 1.7.0 is out','en'),'Version 1.7.0 is out');
});


test("Russian covers channel controls, notifications, source descriptions and animator headings",()=>{
 for(const text of ['Build Channel','Choose which release stream this install should follow.','Apply & Reload','No lyrics saved yet','Presets','Words','Letters','Motion','Glow','Blur','Randomize','TTML saved to Local DB!','Open a song with lyrics first','Source Priority','Split Word Motion','Click to configure']){
  assert.notEqual(translateUi(text,'ru'),text,text);assert.equal(translateUi(text,'en'),text);
 }
 assert.equal(translateUi('Move Apple Music up','ru'),'Переместить Apple Music выше');
 assert.equal(translateUi('Hide Split Word Motion setting','ru'),'Скрыть Раздвигание сплитов');
 assert.equal(translateUi('Current: My Build','ru'),'Текущий канал: My Build');
 assert.equal(translateUi('Imported My Preset.','ru'),'Импортирован пресет: My Preset.');
 assert.equal(translateUi('Version B','ru'),'Версия B');
 assert.equal(translateUi(' Choose which release stream\n this install should follow. ','ru'),' Выберите канал обновлений для этой установки. ');
});

import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
test('visible static React labels, settings descriptions and source metadata have Russian translations',()=>{
 const allowed=new Set(['Spicy Lyrics','Discord','Ko-fi','vvertax Edition','English','Spotify Mix','Apple Music','Spotify','Musixmatch','LRCLIB','Netease','Let the music move you']);
 const files=[];
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.tsx?$/.test(file))files.push(file);}};
 walk(new URL('../src/components/ReactComponents/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:'));
 files.push(new URL('../src/utils/Lyrics/Animator/Tuning.ts',import.meta.url),new URL('../src/utils/Lyrics/LyricsSourcePreferences.ts',import.meta.url));
 for(const file of files){
  const source=ts.createSourceFile(String(file),readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=node=>{
   let text=null;
   if(ts.isJsxText(node))text=node.text;
   else if(ts.isStringLiteral(node)&&ts.isJsxAttribute(node.parent)&&/^(label|description|placeholder|title|aria-label|disabledReason)$/.test(node.parent.name.text))text=node.text;
   else if(ts.isStringLiteral(node)&&ts.isPropertyAssignment(node.parent)&&/^(label|description|group)$/.test(node.parent.name.getText(source)))text=node.text;
   if(text){text=text.trim().replace(/\s+/g,' ').replace(/&apos;/g,"'");if(/[a-zA-Z]{2}/.test(text)&&!allowed.has(text))assert.notEqual(translateUi(text,'ru'),text,`${file}: ${text}`);}
   ts.forEachChild(node,visit);
  };visit(source);
 }
});

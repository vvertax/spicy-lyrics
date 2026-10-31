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

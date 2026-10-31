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

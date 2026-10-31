import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test("update notes, recovery and window help do not link to another fork",()=>{
 for(const path of ['src/components/ReactComponents/UpdateDialog.tsx','src/components/ReactComponents/SettingsPanel/ExperimentsPanel.tsx','builds/main/entrypoint.mjs']) {
  assert.doesNotMatch(read(path),/https:\/\/(?:raw\.githubusercontent\.com|github\.com)\/(?:iPixelGalaxy|Ruytha)\//i);
 }
});
test("official support and Spikerko links are retained",()=>{
 assert.match(read('src/components/ReactComponents/UpdateDialog.tsx'),/https:\/\/discord\.com\/invite\/uqgXU5wh8j/);
 assert.match(read('src/components/ReactComponents/SettingsPanel/Footer.tsx'),/https:\/\/ko-fi\.com\/spikerko/);
});
test("update notes use our own changelog and version series",()=>{
 const source=read('src/components/ReactComponents/UpdateDialog.tsx');
 assert.match(source,/https:\/\/raw\.githubusercontent\.com\/vvertax\/spicy-lyrics\/main\/CHANGELOG\.md/);
 assert.doesNotMatch(source,/hasPixelEditionVersion/);
});

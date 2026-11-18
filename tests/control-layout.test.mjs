import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const { code } = await transform(readFileSync(new URL("../src/components/Utils/ControlLayout.ts",import.meta.url),"utf8"),{loader:"ts",format:"esm"});
const { controlId, normalizeQuickControls, QUICK_CONTROLS, orderedQuickControls, moveQuickControl } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("quick settings ignore invalid persisted entries and duplicates",()=>assert.deepEqual(normalizeQuickControls(["SettingsToggle","invalid",null,"SettingsToggle","karaoke"]),["SettingsToggle","karaoke"]));
test("shortcut labels retain stable control IDs",()=>assert.equal(controlId("","Karaoke · Alt+Shift+K"),"karaoke"));
test("existing controls retain their original IDs",()=>assert.equal(controlId("RomanizationToggle","Enable Romanization"),"RomanizationToggle"));
test("all quick action identifiers are unique",()=>assert.equal(new Set(QUICK_CONTROLS.map(([id])=>id)).size,QUICK_CONTROLS.length));
test("reordering preserves hidden slots and appends newly pinned actions",()=>{
 const pinned=["subtitles","quote","review"];
 assert.deepEqual(orderedQuickControls(pinned,null,["quote","subtitles","review"]),["quote","subtitles","review"]);
 const edited=moveQuickControl(["quote","subtitles","review"],["quote","review"],"quote","review");
 assert.deepEqual(edited,["review","subtitles","quote"]);
 assert.deepEqual(orderedQuickControls([...pinned,"karaoke"],edited,[]),["review","subtitles","quote","karaoke"]);
});

const {code:presentationCode}=await transform(readFileSync(new URL("../src/components/Utils/ControlPresentation.ts",import.meta.url),"utf8"),{loader:"ts",format:"esm"});
const {prepareMenuButton,controlMenuPlacement}=await import(`data:text/javascript;base64,${Buffer.from(presentationCode).toString('base64')}`);
test('renderer toggle becomes one menu glyph with a checked state instead of a second disc',()=>{
 const attrs=new Map([['aria-pressed','true']]);let removed=0,animationCleared=0;
 const button={getAttribute:k=>attrs.get(k)??null,removeAttribute:k=>attrs.delete(k),setAttribute:(k,v)=>attrs.set(k,v),querySelectorAll:s=>s.includes('KnockoutDisc')?[{remove(){removed++}}]:[{classList:{remove(){animationCleared++}}}]};
 assert.equal(prepareMenuButton(button),'true');assert.equal(removed,1);assert.equal(animationCleared,1);assert.equal(attrs.has('aria-pressed'),false);assert.equal(attrs.get('aria-checked'),'true');
});
test('detached controls menu stays within the viewport and opens above a bottom toolbar',()=>{
 const top=controlMenuPlacement({left:1200,right:1244,top:20,bottom:64},260,500,{width:1280,height:720});assert.equal(top.opensAbove,false);assert.ok(top.left+260<=1268);assert.equal(top.top,74);
 const bottom=controlMenuPlacement({left:24,right:68,top:650,bottom:694},260,500,{width:1280,height:720});assert.equal(bottom.opensAbove,true);assert.equal(bottom.left,12);assert.equal(bottom.top+500,640);
 const narrow=controlMenuPlacement({left:0,right:44,top:20,bottom:64},260,500,{width:320,height:260});assert.equal(narrow.left,12);assert.ok(narrow.maxHeight+narrow.top<=248);
});

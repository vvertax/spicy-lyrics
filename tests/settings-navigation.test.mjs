import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const fixture = { scrollTop: 0, unmounted: 0, location: null, current: null };
const scroll = { get scrollTop() { return fixture.scrollTop; } };
const doc = { createElement: () => ({}), querySelector: () => ({ querySelector: () => scroll }) };
const modal = {
  ownerDocument: doc, classList: { toggle() {} },
  display(options) { fixture.current = options; },
  transition(options) { const previous = fixture.current; fixture.current = options; previous?.onClose?.(); },
};
globalThis.__settingsNavigation = { fixture, modal };
const { outputFiles } = await build({ entryPoints: ["src/utils/settings.ts"], bundle: true, write: false, format: "esm", platform: "node", plugins: [{ name: "settings-fixtures", setup(b) {
  b.onResolve({ filter: /^react$|^react-dom(?:\/client)?$|\/Modal\.ts$|\/SettingsPanel\/(?:index|HiddenSettingsPanel|AnimatorBehaviorPanel)\.tsx$|Fullscreen\.ts$|\/(?:uiState|stores|experiments)\.ts$/ }, args => ({ path: args.path, namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
    if (path === "react") return { contents: "export default {createElement:(type,props)=>({type,props})};" };
    if (path === "react-dom/client") return { contents: "export default {createRoot:container=>({render:element=>container.element=element,unmount:()=>globalThis.__settingsNavigation.fixture.unmounted++})};" };
    if (path === "react-dom") return { contents: "export const flushSync=cb=>cb();" };
    if (path.endsWith("Modal.ts")) return { contents: "export const PopupModal=globalThis.__settingsNavigation.modal;" };
    if (path.endsWith("stores.ts")) return { contents: "export const $rememberSettingsMenuLocation={get:()=>false};" };
    if (path.endsWith("uiState.ts")) return { contents: "export const $settingsMenuLocation={get:()=>({}),set:()=>{}};" };
    if (path.endsWith("experiments.ts")) return { contents: "export const $experiment=()=>({subscribe:cb=>cb(true)});" };
    if (path.endsWith("Fullscreen.ts")) return { contents: "export default {IsOpen:true,Toggle:()=>{}};" };
    return { contents: `export default ${JSON.stringify(path.includes("HiddenSettingsPanel") ? "hidden" : path.includes("AnimatorBehaviorPanel") ? "animator" : "settings")};` };
  });
} }] });
const { openSettingsPanel, getSettingsReturn } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("returning from a subpanel preserves the settings location and restores working hidden-settings actions", () => {
  openSettingsPanel(doc);
  fixture.current.content.element.props.onStateChange({ query: "", sectionFilter: "Advanced", scrollTop: 0 });
  fixture.scrollTop = 94;
  const back = getSettingsReturn(doc);
  modal.transition({ content: {} });
  back();
  const settings = fixture.current.content.element;
  assert.equal(settings.type, "settings");
  assert.equal(settings.props.initialState.sectionFilter, "Advanced");
  assert.equal(settings.props.initialState.scrollTop, 94);
  settings.props.onOpenHiddenSettings();
  assert.equal(fixture.current.title, "Hidden Settings");
  assert.equal(fixture.current.content.element.type, "hidden");
  fixture.current.content.element.props.onBack();
  assert.equal(fixture.current.content.element.type, "settings");
  assert.equal(typeof fixture.current.content.element.props.onOpenHiddenSettings, "function");
  assert.equal(typeof fixture.current.content.element.props.onManageAnimator, "function");
  assert.ok(fixture.unmounted >= 3);
});

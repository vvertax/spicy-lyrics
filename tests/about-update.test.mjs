import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fixture = globalThis.__aboutUpdate = { calls: [], errors: [], fail: false };
const { outputFiles } = await build({
  entryPoints: ['src/components/ReactComponents/SettingsPanel/Footer.tsx'], bundle: true,
  write: false, platform: 'node', format: 'esm', plugins: [{ name: 'about-fixture', setup(b) {
    b.onResolve({ filter: /^react(?:\/jsx-runtime)?$|^@nanostores\/react$|^sonner$|\/(?:Session|stores)\.ts$|\/CheckForUpdates\.tsx$/ }, a => ({ path: a.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
      if (path === 'react/jsx-runtime') return { contents: 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";' };
      if (path === 'react') return { contents: 'export default {};export const useEffect=()=>{},useState=()=>["outdated",()=>{}];' };
      if (path === '@nanostores/react') return { contents: 'export const useStore=()=>"1.11.3";' };
      if (path === 'sonner') return { contents: 'export const toast={error:message=>globalThis.__aboutUpdate.errors.push(message)};' };
      if (path.endsWith('/stores.ts')) return { contents: 'export const $spicyLyricsVersion={};' };
      if (path.endsWith('/Session.ts')) return { contents: 'export default {Navigate(){throw Error("Must not open channel selector")}};' };
      return { contents: 'export async function CheckForUpdates(force){const f=globalThis.__aboutUpdate;f.calls.push(force);if(f.fail)throw Error("offline");}' };
    });
  } }],
});
const { default: About } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function updateButton(node) {
  if (node?.type === 'button' && node.props.className === 'sl-sp-about-update') return node;
  for (const child of [node?.props?.children].flat(Infinity)) {
    const found = child && typeof child === 'object' ? updateButton(child) : null;
    if (found) return found;
  }
}
test('About Update explicitly reopens the real update flow even if its notification was dismissed', async () => {
  const button = updateButton(About());
  assert.ok(button);
  button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fixture.calls, [true]);
  assert.deepEqual(fixture.errors, []);
});
test('About reports a failed update check without opening the channel selector', async () => {
  fixture.fail = true;
  updateButton(About()).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fixture.errors, ['Could not check for updates.']);
});

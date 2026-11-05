import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/utils/Lyrics/Applyer/Credits/CreateLyricsFooter.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { PlaceLyricsFooter, PinFooterDetailWithoutWriters, GetPageLyricsFooter, GetLyricsFooterDetails, UnregisterLyricsFooterDetail } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function element() {
  const classes = new Set();
  return { children: [], parentElement: null, dataset: {},
    classList: { contains: c => classes.has(c), add: (...cs) => cs.forEach(c => classes.add(c)), remove: c => classes.delete(c), toggle(c, enabled) { enabled ? classes.add(c) : classes.delete(c); } },
    appendChild(child) { child.remove(); this.children.push(child); child.parentElement = this; },
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; },
    querySelectorAll() { return this.children.filter(c => c.classList.contains('PinnedFooterDetail')); },
  };
}
function fixture() {
  const page = element(), layer = element(), content = element(), container = element(), footer = element(), source = element();
  content.closest = () => page; content.parentElement = { querySelector: () => layer };
  PlaceLyricsFooter(footer, container, content); footer.appendChild(source); PinFooterDetailWithoutWriters(source, footer);
  return { page, layer, content, container, footer, source };
}
test('source details follow the same footer through scrollable, writers-only and fully pinned modes', () => {
  const { page, layer, content, container, footer, source } = fixture();
  assert.equal(GetPageLyricsFooter(page), footer); assert.equal(source.parentElement, footer);
  page.classList.add('PinnedFooterMode_NoWriters'); PlaceLyricsFooter(footer, container, content);
  assert.equal(source.parentElement, layer); assert.equal(footer.parentElement, container);
  page.classList.remove('PinnedFooterMode_NoWriters'); page.classList.add('PinnedFooterMode_Full'); PlaceLyricsFooter(footer, container, content);
  assert.equal(source.parentElement, footer); assert.equal(footer.parentElement, layer);
  page.classList.remove('PinnedFooterMode_Full'); PlaceLyricsFooter(footer, container, content);
  assert.equal(source.parentElement, footer); assert.equal(footer.parentElement, container);
});
test('source details remain with gravity credits and unregister cleanly on renderer replacement', () => {
  const { page, layer, content, container, footer, source } = fixture();
  page.classList.add('PinnedFooterMode_NoWriters'); PlaceLyricsFooter(footer, container, content);
  assert.equal(source.parentElement, layer);
  PlaceLyricsFooter(footer, container, content, true); PinFooterDetailWithoutWriters(source, footer);
  assert.equal(source.parentElement, footer);
  UnregisterLyricsFooterDetail(source, footer); assert.equal(GetLyricsFooterDetails(footer).includes(source), false);
  const next = element(); PlaceLyricsFooter(next, container, content); assert.equal(GetPageLyricsFooter(page), next);
});

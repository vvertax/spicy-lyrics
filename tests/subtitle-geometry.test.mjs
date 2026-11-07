import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Both renderers run the same nested word/letter scales. Their unscaled line
// boxes must match too, otherwise scaling moves the glyphs around different
// centres even when the animator outputs are identical.
test('subtitle line boxes preserve the main renderer baseline at compact font sizes',()=>{
 const main=readFileSync('src/css/Lyrics/Mixed.css','utf8');
 const subtitle=readFileSync('src/css/ForkUI.css','utf8').match(/#sl-subtitle-bar \.line \{([^}]+)\}/)[1];
 const leading=css=>Number(css.match(/--lyrics-line-height:\s*([\d.]+)/)[1]);
 const reference=leading(main),compact=leading(subtitle);
 for(const size of [20,24]) {
  const referenceHeight=size*reference,compactHeight=size*compact;
  assert.ok(Math.abs(referenceHeight-compactHeight)<.001,`different scale origins at ${size}px: ${referenceHeight} vs ${compactHeight}`);
 }
 assert.match(subtitle,/line-height:\s*var\(--lyrics-line-height\)/);
});

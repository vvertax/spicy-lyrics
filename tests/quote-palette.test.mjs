import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const {code}=await transform(readFileSync(new URL('../src/components/Utils/QuotePalette.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const {coverAccent,coverGradient}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const repeat=(color,count)=>Array.from({length:count},()=>color).flat();
test('cyan accents survive a larger grey background',()=>{
 const [r,g,b]=coverAccent([...repeat([180,190,190,255],80),...repeat([20,190,255,255],20)]);
 assert.ok(b>r+100&&g>r+100);
});
test('grayscale and black covers stay neutral',()=>{
 assert.deepEqual(coverAccent(repeat([160,160,160,255],30)),[160,160,160]);
 assert.deepEqual(coverAccent(repeat([0,0,0,255],30)),[0,0,0]);
});
test('transparent colors and isolated noise cannot dominate',()=>{
 assert.deepEqual(coverAccent([...repeat([140,140,140,255],100),255,0,0,0]),[140,140,140]);
 const [r,g,b]=coverAccent([...repeat([140,140,140,255],100),255,0,0,255]);assert.ok(Math.max(r,g,b)-Math.min(r,g,b)<3);
});

test('dark red details produce a red-to-black gradient rather than two black stops',()=>{
 const {background:[top,bottom]}=coverGradient([...repeat([8,8,8,255],85),...repeat([90,12,25,255],15)]);
 assert.ok(top[0]>top[2]+30);assert.ok(top[0]>bottom[0]+40);assert.ok(Math.max(...bottom)<15);
});
test('neutral artwork keeps a neutral gradient',()=>{
 const {background}=coverGradient(repeat([30,30,30,255],30));
 for(const color of background)assert.equal(Math.max(...color),Math.min(...color));
});

test('light cyan covers retain blue in the darker gradient stop',()=>{
 const {background:[top,bottom]}=coverGradient(repeat([78,196,231,255],100));
 assert.ok(top[2]>top[0]+40);assert.ok(bottom[2]>bottom[0]+30);
 assert.ok(top[2]>bottom[2]);
});

test('large muted green surfaces outweigh small saturated skin and metal details',()=>{
 const [r,g,b]=coverAccent([...repeat([140,160,148,255],80),...repeat([140,90,45,255],10),...repeat([20,40,120,255],5),...repeat([8,8,8,255],5)]);
 assert.ok(g>r&&g>b,`Expected green, received ${[r,g,b]}`);
});

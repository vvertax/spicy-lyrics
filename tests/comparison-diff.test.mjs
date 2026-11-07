import {test} from 'node:test';import assert from 'node:assert/strict';import{build}from'esbuild';
const{outputFiles}=await build({entryPoints:['src/components/Utils/ComparisonDiff.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const{compareTTMLData,characterEdits,alignComparisonLines}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const line=(Text,StartTime=0,EndTime=2)=>({Text,StartTime,EndTime});const data=Content=>({Type:'Line',Content});
const word=(Text,StartTime,EndTime,IsPartOfWord=false)=>({Text,StartTime,EndTime,IsPartOfWord});
const sung=(parts,extra={})=>({Lead:{StartTime:0,EndTime:4,Syllables:parts},...extra});
test('line insertion and deletion do not cascade, including repeated choruses and global retiming',()=>{
 const a=[line('Intro',0),line('Chorus',3),line('Verse',6),line('Chorus',9)];
 const b=[line('Added',10),...a.map(l=>({...l,StartTime:l.StartTime+20,EndTime:l.EndTime+20}))];
 const pairs=compareTTMLData(data(a),data(b));assert.equal(pairs.filter(p=>p.categories.includes('added')).length,1);
 assert.deepEqual(pairs.filter(p=>p.a!==undefined).map(p=>[p.a,p.b]),[[0,1],[1,2],[2,3],[3,4]]);
 assert.ok(pairs.filter(p=>p.a!==undefined).every(p=>p.categories.includes('timing')&&!p.categories.includes('text')));
 const removed=compareTTMLData(data(b),data(a));assert.equal(removed.filter(p=>p.categories.includes('removed')).length,1);
});
test('timing threshold applies to rounded milliseconds: 9 ignored, 10 included, including duration',()=>{
 const a=data([line('same',1,2)]);assert.equal(compareTTMLData(a,data([line('same',1.009,2)]))[0].changes.length,0);
 const diff=compareTTMLData(a,data([line('same',1.01,2)]))[0];assert.deepEqual(diff.changes.map(c=>c.field),['Start','Duration']);
 assert.equal(compareTTMLData(a,data([line('same',1.0096,2)]))[0].categories[0],'timing');
});
test('one pair retains concurrent text, timing, voice and backing differences',()=>{
 const a=data([sung([word('Hello',0,1),word('world',1,4)],{Background:[{StartTime:1,EndTime:3,Syllables:[word('echo',1,3)]}]})]);a.Type='Syllable';
 const b=structuredClone(a);b.Content[0].Lead.Syllables[1].Text='friend';b.Content[0].Lead.Syllables[1].StartTime=1.05;b.Content[0].OppositeAligned=true;b.Content[0].Background[0].Syllables[0].Text='answer';
 const p=compareTTMLData(a,b)[0];for(const kind of ['text','timing','voice','background'])assert.ok(p.categories.includes(kind));
 assert.ok(p.changes.some(c=>c.partA===1&&c.field==='StartTime'));assert.ok(p.changes.some(c=>c.backgroundA===0&&c.field==='Text'));
});
test('split changes are visible even when the rendered word is unchanged',()=>{
 const a={Type:'Syllable',Content:[sung([word('под',0,2,true),word('вал',2,4)])]},b={Type:'Syllable',Content:[sung([word('подвал',0,4)])]};
 assert.ok(compareTTMLData(a,b)[0].categories.includes('splits'));assert.ok(!compareTTMLData(a,b)[0].categories.includes('text'));
});
test('translations, romanization, punctuation and spaces are compared without treating property order as timing',()=>{
 const a={Type:'Syllable',Content:[sung([word('word',0,4)],{TranslatedText:'старый',TransliteratedText:'old'})]},b=structuredClone(a);b.Content[0].TranslatedText='новый';b.Content[0].TransliteratedText='new';
 assert.equal(compareTTMLData(a,b)[0].changes.filter(c=>c.category==='text').length,2);
 assert.ok(compareTTMLData(data([line('hello world')]),data([line('hello,  world')]))[0].categories.includes('text'));
 assert.equal(compareTTMLData(data([{Text:'same',StartTime:0,EndTime:2}]),data([{EndTime:2,StartTime:0,Text:'same'}]))[0].changes.length,0);
});
test('multiple backing vocals align separately, including added and removed parts',()=>{
 const bg=(t,s)=>({StartTime:s,EndTime:s+1,Syllables:[word(t,s,s+1)]});const a={Type:'Syllable',Content:[sung([word('lead',0,4)],{Background:[bg('one',0),bg('two',2)]})]},b=structuredClone(a);b.Content[0].Background.unshift(bg('new',-1));
 const p=compareTTMLData(a,b)[0];assert.equal(p.changes.filter(c=>c.field==='Added backing vocal').length,1);assert.ok(!p.changes.some(c=>c.field==='Text'));
});
test('character details reconstruct both versions, preserving Unicode and whitespace',()=>{
 const a='Привет 🌙  мир!',b='Привет ☀ мир?';const edits=characterEdits(a,b);
 assert.equal(edits.filter(c=>c.kind!=='added').map(c=>c.text).join(''),a);assert.equal(edits.filter(c=>c.kind!=='removed').map(c=>c.text).join(''),b);
 assert.ok(edits.some(c=>c.kind==='added'));
});
test('large inputs keep bounded alignment memory and locate an inserted row',()=>{
 const a=Array.from({length:1500},(_,i)=>line(`line ${i}`,i));const b=[...a];b.splice(700,0,line('inserted',699.5));
 const aligned=alignComparisonLines(a,b);assert.equal(aligned.filter(p=>p.a===undefined).length,1);assert.equal(aligned.at(-1).b,1500);
});

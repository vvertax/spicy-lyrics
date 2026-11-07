import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {outputFiles}=await build({stdin:{contents:'export * from "./src/components/Utils/AuthorProfile.ts";export * from "./src/components/ReactComponents/IframeProfile/IframeProfileModal.tsx";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'profile-fixture',setup(b){b.onResolve({filter:/\/(stores|translate)\.ts$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('stores.ts')?'export const $uiLanguage={get:()=>"en"};':'export const translateUi=s=>s;'}))}}]});
const {rememberAuthor,knownAuthor,authorProfileUrl,createAuthorCard,resolveProfileIdentity,showIframeProfileModal,closeIframeProfileModal}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
function documentFixture(){
 const tags=[],listeners=new Map();let focused;
 function node(tag){return{tag,children:[],isConnected:true,setAttribute(){},append(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n)})},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this)},focus(){focused=this},querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)])},set innerHTML(value){throw new Error('Profile metadata must never use HTML')}}}
 const previous=node('button');const doc={body:node('body'),activeElement:previous,createElement:tag=>{tags.push(tag);return node(tag)},defaultView:{addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:name=>listeners.delete(name)}};
 return{doc,tags,listeners,previous,focused:()=>focused};
}
test('author metadata resolves locally and canonical profile URLs prefer immutable IDs',async()=>{
 rememberAuthor({id:'12345',username:'vvertax.',displayName:'july'});
 assert.equal((await resolveProfileIdentity('12345')).username,'vvertax.');
 assert.equal(knownAuthor('VVErTaX.').displayName,'july');
 assert.equal(authorProfileUrl(knownAuthor('12345',true)),'https://spicylyrics.org/uid/12345');
 assert.equal(authorProfileUrl({username:'@july'}),'https://spicylyrics.org/july');
 assert.throws(()=>authorProfileUrl({username:'javascript:alert(1)'}));
});
test('native author cards create no frame and do not turn metadata into markup or unsafe image URLs',()=>{
 const {doc,tags}=documentFixture();
 const card=createAuthorCard(doc,{username:'july',displayName:'<img onerror=bad>',avatar:'javascript:bad'});
 assert.equal(card.children[1].children[0].textContent,'<img onerror=bad>');
 assert.equal(tags.includes('iframe'),false);assert.equal(tags.includes('img'),false);
 const link=card.querySelectorAll('a')[0];assert.equal(link.rel,'noopener noreferrer');assert.equal(link.target,'_blank');
});
test('native profiles replace previous authors and close with Escape while restoring focus',()=>{
 const f=documentFixture(),states=[];rememberAuthor({id:'22222',username:'july'});
 const options={signal:new AbortController().signal,onState:s=>states.push(s)};
 showIframeProfileModal('12345',f.doc,options);assert.equal(f.doc.body.children.length,1);
 showIframeProfileModal('22222',f.doc,options);assert.equal(f.doc.body.children.length,1);
 f.listeners.get('keydown')({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(f.doc.body.children.length,0);assert.equal(f.focused(),f.previous);assert.deepEqual(states,['ready','closed','ready','closed']);
 assert.equal(f.tags.includes('iframe'),false);closeIframeProfileModal();
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/utils/InterfaceDesign.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {registerDesignDocument,setInterfaceDesign}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const document=()=>({documentElement:{value:null,setAttribute(name,value){assert.equal(name,'data-sl-design');this.value=value;}}});
test('design changes reach open windows and newly opened windows; closed windows stop updating',()=>{
 const main=document(),pip=document();const stopMain=registerDesignDocument(main),stopPip=registerDesignDocument(pip);
 setInterfaceDesign('original');assert.equal(main.documentElement.value,'original');assert.equal(pip.documentElement.value,'original');
 const cinema=document(),stopCinema=registerDesignDocument(cinema);assert.equal(cinema.documentElement.value,'original');
 stopPip();stopPip();setInterfaceDesign('ruytha');assert.equal(main.documentElement.value,'ruytha');assert.equal(cinema.documentElement.value,'ruytha');assert.equal(pip.documentElement.value,'original');
 stopMain();stopCinema();
});
test('multiple consumers in one document retain synchronization until the last releases it',()=>{
 const doc=document(),a=registerDesignDocument(doc),b=registerDesignDocument(doc);a();setInterfaceDesign('original');assert.equal(doc.documentElement.value,'original');
 setInterfaceDesign('unknown');assert.equal(doc.documentElement.value,'ruytha');b();
});

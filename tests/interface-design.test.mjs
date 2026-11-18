import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/utils/InterfaceDesign.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {registerDesignDocument,setInterfaceDesign,setVvertaxYouPalette}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const document=()=>({documentElement:{
 value:null, palette:null,
 setAttribute(name,value){if(name==='data-sl-design')this.value=value;else {assert.equal(name,'data-sl-palette');this.palette=value;}},
 removeAttribute(name){assert.equal(name,'data-sl-palette');this.palette=null;},
}});
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
test('vvertax You shares its own palette across windows and restores it after switching designs',()=>{
 const main=document(),pip=document();
 const stopMain=registerDesignDocument(main);
 setInterfaceDesign('vvertax-you');
 assert.equal(main.documentElement.palette,'gray');
 setVvertaxYouPalette('white');
 const stopPip=registerDesignDocument(pip);
 assert.equal(pip.documentElement.palette,'white');
 setVvertaxYouPalette('green');
 assert.equal(main.documentElement.palette,'green');
 assert.equal(pip.documentElement.palette,'green');
 setInterfaceDesign('original');
 assert.equal(main.documentElement.palette,null);
 setInterfaceDesign('vvertax-you');
 assert.equal(main.documentElement.palette,'green');
 setVvertaxYouPalette('unknown');
 assert.equal(main.documentElement.palette,'gray');
 stopMain();stopPip();
});

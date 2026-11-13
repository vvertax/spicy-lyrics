import {previewBuildOptions} from './preview-options.mjs';
import {build}from'esbuild';import{readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const out=resolve(root,'dist/preview');mkdirSync(out,{recursive:true});
const fontCache=resolve(root,'.cache/preview-fonts');mkdirSync(fontCache,{recursive:true});mkdirSync(resolve(out,'fonts'),{recursive:true});
for(const file of ['source.css','LyricsRegular.woff2','LyricsMedium.woff2','LyricsSemibold.woff2','LyricsBold.woff2']){
 const cached=resolve(fontCache,file);if(!existsSync(cached)){const response=await fetch('https://fonts.spikerko.org/spicy-lyrics/'+file,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Cannot load original Spicy Lyrics font: '+response.status);writeFileSync(cached,new Uint8Array(await response.arrayBuffer()));}copyFileSync(cached,resolve(out,'fonts',file));
}
writeFileSync(resolve(out,'fonts/SOURCE.txt'),'Original Spicy Lyrics font assets: https://fonts.spikerko.org/spicy-lyrics/source.css\n');
const built=await build(previewBuildOptions(root,out));
writeFileSync(resolve(out,'modules.json'),JSON.stringify(Object.keys(built.metafile.inputs).map(p=>p.replaceAll('\\','/'))));
for(const file of ['index.html','cover-a.svg','cover-b.svg'])copyFileSync(resolve(root,'hosting/preview',file),resolve(out,file));
writeFileSync(resolve(out,'build.json'),JSON.stringify({version:readFileSync(resolve(root,'project/config.ts'),'utf8').match(/ProjectVersion\s*=\s*"([^"]+)"/)[1],components:'production',environment:'browser-preview'}));console.log('Built live preview: '+out);

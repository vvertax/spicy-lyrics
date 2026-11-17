import { readFileSync, copyFileSync, mkdirSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { targetLoader, validReleaseHost } from "./hosting-target.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(resolve(root, "dist/version"), "utf8").trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid dist/version");
const bundle = `spicy-lyrics@${version}.mjs`;
// Read before changing the staging manifest, so a missing build cannot publish a new version.
readFileSync(resolve(root, "dist", bundle));
const siteHost=process.argv.find(arg=>arg.startsWith('--host='))?.slice(7)??'lrc.vvrtx.lol';
if(!validReleaseHost(siteHost))throw new Error('Unsupported hosting target');
const output = resolve(root, "deploy",siteHost);
mkdirSync(output, { recursive: true });
copyFileSync(resolve(root, "dist", bundle), resolve(output, bundle));
for (const [source, file] of [["builds/main/entrypoint.mjs", "entrypoint.mjs"], ["hosting/spicy-lyrics-sl.mjs", "spicy-lyrics-sl.mjs"]]) {
  writeFileSync(resolve(output, file), targetLoader(readFileSync(resolve(root, source), "utf8"), siteHost));
}
copyFileSync(resolve(root, "hosting/index.html"), resolve(output, "index.html"));
for(const file of ['preview-host.js','preview-host.css'])copyFileSync(resolve(root,'hosting',file),resolve(output,file));
if(!existsSync(resolve(root,'dist/preview/index.html')))throw new Error('Build the live preview with node project/build-preview.mjs first');
cpSync(resolve(root,'dist/preview'),resolve(output,'preview'),{recursive:true});
writeFileSync(resolve(output, "version"), version + "\n");
writeFileSync(resolve(output, "_headers"), `/*
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
/*.mjs
  Content-Type: application/javascript; charset=utf-8
`);
console.log(`Prepared ${output} (${version})`);

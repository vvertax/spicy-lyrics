import { readFileSync, copyFileSync, mkdirSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { targetLoader, validReleaseHost } from "./hosting-target.mjs";
import { hotfixBundleName, parseHotfix } from "../builds/main/release-hotfix.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(resolve(root, "dist/version"), "utf8").trim();
const counter = resolve(root, "dist/hotfix");
const hotfix = existsSync(counter) ? parseHotfix(readFileSync(counter, "utf8")) : 0;
const bundle = hotfixBundleName(version, hotfix);
// Read before changing the staging manifest, so a missing build cannot publish a new version.
const bundlePath = resolve(root, "dist", bundle);
const payload = readFileSync(bundlePath);
const siteHost=process.argv.find(arg=>arg.startsWith('--host='))?.slice(7)??'lrc.vvrtx.lol';
if(!validReleaseHost(siteHost))throw new Error('Unsupported hosting target');
const output = resolve(root, "deploy",siteHost);
const outputVersion = resolve(output, "version");
const outputHotfix = resolve(output, "hotfix");
const outputBundle = resolve(output, bundle);
if (existsSync(outputVersion) && readFileSync(outputVersion, "utf8").trim() === version &&
    existsSync(outputHotfix) && parseHotfix(readFileSync(outputHotfix, "utf8")) > hotfix) {
  throw new Error("Cannot lower the hotfix counter for the same version. Use a new hotfix number for a rollback.");
}
if (hotfix > 0 && existsSync(outputBundle) && !payload.equals(readFileSync(outputBundle))) {
  throw new Error("This hotfix number already contains a different bundle.");
}
if (!existsSync(resolve(root, "dist/preview/index.html"))) throw new Error("Build the live preview with node project/build-preview.mjs first");
mkdirSync(output, { recursive: true });
copyFileSync(bundlePath, outputBundle);
if (hotfix > 0) {
  const baseName = hotfixBundleName(version, 0);
  const base = resolve(root, "dist", baseName);
  const fallback = resolve(output, baseName);
  if (!existsSync(fallback)) copyFileSync(existsSync(base) ? base : bundlePath, fallback);
}
copyFileSync(resolve(root, "builds/main/release-hotfix.mjs"), resolve(output, "release-hotfix.mjs"));
for (const [source, file] of [["builds/main/entrypoint.mjs", "entrypoint.mjs"], ["hosting/spicy-lyrics-sl.mjs", "spicy-lyrics-sl.mjs"]]) {
  writeFileSync(resolve(output, file), targetLoader(readFileSync(resolve(root, source), "utf8"), siteHost));
}
copyFileSync(resolve(root, "hosting/index.html"), resolve(output, "index.html"));
for(const file of ['preview-host.js','preview-host.css'])copyFileSync(resolve(root,'hosting',file),resolve(output,file));
cpSync(resolve(root,'dist/preview'),resolve(output,'preview'),{recursive:true});
writeFileSync(resolve(output, "_headers"), `/*
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
/*.mjs
  Content-Type: application/javascript; charset=utf-8
/hotfix
  Content-Type: text/plain; charset=utf-8
`);
writeFileSync(outputVersion, version + "\n");
writeFileSync(outputHotfix, hotfix + "\n");
console.log(`Prepared ${output} (${version}, hotfix ${hotfix})`);

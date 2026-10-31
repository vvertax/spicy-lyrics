import { readFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(resolve(root, "dist/version"), "utf8").trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid dist/version");
const bundle = `spicy-lyrics@${version}.mjs`;
// Read before changing the staging manifest, so a missing build cannot publish a new version.
readFileSync(resolve(root, "dist", bundle));
const output = resolve(root, "deploy/lrc.vvrtx.lol");
mkdirSync(output, { recursive: true });
copyFileSync(resolve(root, "dist", bundle), resolve(output, bundle));
copyFileSync(resolve(root, "builds/main/entrypoint.mjs"), resolve(output, "entrypoint.mjs"));
copyFileSync(resolve(root, "hosting/spicy-lyrics-sl.mjs"), resolve(output, "spicy-lyrics-sl.mjs"));
copyFileSync(resolve(root, "hosting/index.html"), resolve(output, "index.html"));
writeFileSync(resolve(output, "version"), version + "\n");
writeFileSync(resolve(output, "_headers"), `/*
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache
/*.mjs
  Content-Type: application/javascript; charset=utf-8
`);
console.log(`Prepared ${output} (${version})`);

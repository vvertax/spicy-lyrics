import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: ["src/utils/Lyrics/manager/LocalLyricsFile.ts"], bundle: true, write: false, platform: "node", format: "esm",
});
const { parseLocalLyrics, readLocalLyricsFile, parseLyricsBackup } = await import(
  "data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);
const file = { format: "lrc", text: "[ti:Example]\n[offset:+200]\n[00:02.00][00:06.00]Repeated\n[00:04.00]Middle" };
const entry = { uri: "spotify:track:0123456789abcdefghijkl", ...file };

test("local LRC handles offset, multiple tags, and the real duration of the final line", async () => {
  const lyrics = await parseLocalLyrics(file, 7000);
  assert.equal(lyrics.Type, "Line");
  assert.deepEqual(lyrics.Content.map(line => [line.Text, line.StartTime, line.EndTime]),
    [["Repeated", 2.2, 4.2], ["Middle", 4.2, 6.2], ["Repeated", 6.2, 7]]);
  assert.equal(await parseLocalLyrics({ format: "lrc", text: "Plain text" }), null);
});

test("old TTML strings remain readable and backups preserve raw files and track bindings", async () => {
  assert.deepEqual(readLocalLyricsFile("<tt/>"), { format: "ttml", text: "<tt/>" });
  assert.deepEqual(await parseLyricsBackup(JSON.stringify({ version: 1, entries: [entry] })), [entry]);
  await assert.rejects(parseLyricsBackup(JSON.stringify({ version: 2, entries: [entry] })), /Invalid lyrics backup/);
  await assert.rejects(parseLyricsBackup(JSON.stringify({ version: 1, entries: [entry, entry] })), /Invalid lyrics backup/);
  await assert.rejects(parseLyricsBackup(JSON.stringify({ version: 1, entries: [{ ...entry, uri: "playlist:test" }] })), /Invalid lyrics backup/);
});

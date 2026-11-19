import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const { outputFiles } = await build({
  stdin: {
    contents: 'export * from "./src/components/Utils/QuoteVideo.ts"; export { trimQuoteAudio } from "./src/components/Utils/QuoteVideoAudio.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: "node", format: "esm",
});
const { makeQuoteVideoClip, quoteSelection, quoteVideoFormats, quoteVideoMarkerBounds, trimQuoteAudio } = await import(
  "data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64")
);
const data = { Type: "Syllable", Content: [
  { Text: "", StartTime: 0, EndTime: 2 },
  { Text: "Repeated chorus", StartTime: 3, EndTime: 5 },
  { Lead: { StartTime: 6, EndTime: 8, Syllables: [
    { Text: "Re", StartTime: 6, EndTime: 6.2, IsPartOfWord: true },
    { Text: "peated", StartTime: 6.2, EndTime: 6.5 },
    { Text: "chorus", StartTime: 6.5, EndTime: 8 },
  ] } },
  { Text: "Far away", StartTime: 69, EndTime: 71 },
] };

test("quote selection follows the timed source index, skips empty rows and honors explicit context-menu selection", () => {
  assert.equal(quoteSelection(data, 6500).find(row => row.selected)?.index, 2);
  assert.equal(quoteSelection(data, 6500, 1).find(row => row.selected)?.index, 1);
  assert.equal(quoteSelection(data, 5100).some(row => row.selected), false);
  assert.equal(quoteSelection(data, 5100)[0].index, 1);
});

test("video clip preserves timing and enforces the duration limit across gaps", () => {
  const clip = makeQuoteVideoClip(data, [1, 2]);
  assert.deepEqual([clip.start, clip.end], [3000, 8000]);
  assert.deepEqual(clip.lyrics.Content[1].Lead.Syllables.map(part => [part.Text, part.StartTime]), [["Re", 6], ["peated", 6.2], ["chorus", 6.5]]);
  assert.equal(makeQuoteVideoClip(data, [1, 3]), null);
  assert.equal(makeQuoteVideoClip(data, [2, 3]), null);
  assert.equal(makeQuoteVideoClip({ ...data, Type: "Static" }, [1]), null);
});

test("video clip keeps a duet and includes the backing vocals before and after its lead", () => {
  const duet = {
    OppositeAligned: true,
    Lead: { StartTime: 4, EndTime: 6, Syllables: [{ Text: "Duet", StartTime: 4, EndTime: 6 }] },
    Background: [{ StartTime: 3, EndTime: 9, Syllables: [{ Text: "Harmony", StartTime: 3, EndTime: 9 }] }],
  };
  const lyrics = { Type: "Syllable", Content: [duet, { Text: "Next", StartTime: 11, EndTime: 13 }] };
  const single = makeQuoteVideoClip(lyrics, [0]);
  assert.deepEqual([single.start, single.end], [3000, 9000]);
  assert.deepEqual(single.lyrics.Content, [duet]);
  assert.equal(makeQuoteVideoClip(lyrics, [0, 1]).lyrics.Content.length, 2);
});

test("video quotes replace skipped lines with a timed interlude and add dots to long vocal pauses", () => {
  const lyrics = { Type: "Line", Content: [
    { Text: "First", StartTime: 2, EndTime: 4 },
    { Text: "Skipped", StartTime: 4, EndTime: 5 },
    { Text: "Next", StartTime: 5, EndTime: 8 },
    { Text: "After silence", StartTime: 11, EndTime: 13 },
  ] };
  const clip = makeQuoteVideoClip(lyrics, [0, 2, 3]);
  assert.deepEqual([clip.start, clip.end], [2000, 13000]);
  assert.deepEqual(clip.lyrics.Content.map(row => row.Text), ["First", "• • •", "Next", "• • •", "After silence"]);
  assert.deepEqual(clip.lyrics.Content.filter(row => row.Type === "Interlude").map(row => [row.StartTime, row.EndTime]), [[4, 5], [8, 11]]);
  assert.deepEqual(makeQuoteVideoClip(lyrics, [2, 3], 5000).lyrics.Content.map(row => row.Text), ["Next", "After silence"]);
  assert.equal(makeQuoteVideoClip(lyrics, [0, 0]), null);
  lyrics.Content[0].EndTime = 6;
  assert.deepEqual(makeQuoteVideoClip(lyrics, [0, 2]).lyrics.Content.map(row => row.Text), ["First", "Next"]);
});

test("video accepts 24 adjacent lines and bounds the selection to 60 seconds", () => {
  const indices = Array.from({ length: 25 }, (_, index) => index);
  const lyrics = { Type: "Line", Content: indices.map(index => ({
    Text: "Lyric " + index, StartTime: index * 2.5, EndTime: (index + 1) * 2.5,
  })) };
  const selection = indices.slice(0, 24);
  const clip = makeQuoteVideoClip(lyrics, selection);
  assert.equal(clip.lyrics.Content.length, 24);
  assert.equal(clip.end - clip.start, 60_000);
  lyrics.Content[24].StartTime = 59;
  lyrics.Content[24].EndTime = 60;
  assert.equal(makeQuoteVideoClip(lyrics, indices), null);
  lyrics.Content[23].EndTime = 60.01;
  assert.equal(makeQuoteVideoClip(lyrics, selection), null);
});

test("quote timeline keeps markers ordered and within the source track and 60-second limit", () => {
  assert.deepEqual(quoteVideoMarkerBounds({ start: 3000, end: 8000 }, "start", 10_000), [0, 7999]);
  assert.deepEqual(quoteVideoMarkerBounds({ start: 3000, end: 8000 }, "end", 10_000), [3001, 10_000]);
  assert.deepEqual(quoteVideoMarkerBounds({ start: 30_000, end: 90_000 }, "start", 200_000), [30_000, 89_999]);
  assert.deepEqual(quoteVideoMarkerBounds({ start: 30_000, end: 90_000 }, "end", 200_000), [30_001, 90_000]);
});

test("export chooses native MP4 first and offers WebM without MP4 support", () => {
  const view = { HTMLCanvasElement: { prototype: { captureStream() {} } },
    VideoEncoder() {}, MediaRecorder: { isTypeSupported: () => true } };
  assert.equal(quoteVideoFormats(view)[0].extension, "mp4");
  view.MediaRecorder.isTypeSupported = type => type.startsWith("video/webm");
  assert.equal(quoteVideoFormats(view)[0].extension, "webm");
  assert.equal(quoteVideoFormats(view)[0].mimeType, "video/webm;codecs=vp8");
  view.VideoEncoder = undefined;
  view.MediaRecorder.isTypeSupported = () => true;
  assert.ok(quoteVideoFormats(view).every(format => format.extension === "webm"));
  view.MediaRecorder = null;
  assert.deepEqual(quoteVideoFormats(view), []);
});

test("quote audio starts at the selected timestamp and copies exactly the clip's samples", () => {
  const original = globalThis.AudioBuffer;
  globalThis.AudioBuffer = class {
    constructor({ sampleRate, length, numberOfChannels }) {
      Object.assign(this, { sampleRate, length, numberOfChannels });
      this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }
    getChannelData(index) { return this.channels[index]; }
  };
  try {
    const audio = new AudioBuffer({ sampleRate: 1000, length: 250, numberOfChannels: 2 });
    audio.getChannelData(0).set([.25, .5, .75], 50);
    audio.getChannelData(1).set([-.5, 0, .5], 50);
    const clip = trimQuoteAudio(audio, 50, 3);
    assert.deepEqual([...clip.getChannelData(0)], [.25, .5, .75]);
    assert.deepEqual([...clip.getChannelData(1)], [-.5, 0, .5]);
    assert.equal(trimQuoteAudio(audio, 248, 3), null);
    assert.equal(trimQuoteAudio(audio, -1, 3), null);
  } finally { globalThis.AudioBuffer = original; }
});

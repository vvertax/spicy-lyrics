import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

async function load(entry) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
}
const { checkTime, checkTimingLines } = await load("src/components/Utils/TTMLCheck.ts");
const { subtitleLines, subtitleAt, subtitleBackingLines, subtitleBackingAt } = await load("src/components/Utils/SubtitleModel.ts");

test("TTML inspection understands clock, frame, tick and offset timings without normalizing reversed ranges", () => {
  assert.equal(checkTime("01:02:03.500"), 3723.5);
  assert.equal(checkTime("02:03.5"), 123.5);
  assert.equal(checkTime("00:00:01:15", 30), 1.5);
  assert.equal(checkTime("500ms"), .5);
  assert.equal(checkTime("90f", 30), 3);
  assert.equal(checkTime("90t", 30, 10), 9);
  assert.equal(checkTime("2m"), 120);
  assert.equal(checkTime("-1s"), -1);
  assert.equal(checkTime(null), undefined);
  assert.equal(checkTime("00:02:61"), undefined);
  assert.equal(checkTime("invalid"), undefined);
});

test("TTML checks flag malformed lines but accept normal duet overlaps and extended background vocals", () => {
  const valid = [
    { text: "Voice A", start: 0, end: 5, spans: [{ start: 0, end: 5 }, { start: 4, end: 7, background: true }] },
    { text: "Voice B", start: 2, end: 6, spans: [{ start: 2, end: 6 }] },
  ];
  assert.deepEqual(checkTimingLines(valid), []);
  const report = checkTimingLines([
    ...valid,
    { text: "", start: 8, end: 7, spans: [] },
    { text: "Outside", start: 8, end: 10, spans: [{ start: 7, end: 11 }] },
    { text: "Invalid", start: -1, end: 0, spans: [{ invalid: true }] },
    { text: "Zero", start: 40, end: 40, spans: [] },
    { text: "No timing", spans: [] },
  ]);
  for (const code of ["Empty lyric line", "End precedes start", "Word outside line timing", "Negative timing", "Unrecognized timing", "Zero duration", "Untimed lyric line", "Long instrumental gap"])
    assert.ok(report.some(issue => issue.code === code), code);
  assert.equal(report.find(issue => issue.code === "Long instrumental gap").severity, "info");
});

test("subtitle model preserves syllable word boundaries, handles overlaps, gaps and backward seeks", () => {
  const rows = subtitleLines({ Type: "Syllable", Content: [
    { Lead: { StartTime: 0, EndTime: 4, Syllables: [{ Text: "нор", IsPartOfWord: true }, { Text: "мальный" }, { Text: "парень" }] } },
    { Lead: { StartTime: 2, EndTime: 5, Syllables: [{ Text: "duet" }] } },
    { Lead: { StartTime: 8, EndTime: 10, Syllables: [{ Text: "next" }] } },
  ] });
  assert.equal(rows[0].text, "нормальный парень");
  assert.equal(rows[0].source.Lead.Syllables[0].IsPartOfWord, true);
  assert.equal(rows[0].source.Lead.StartTime, 0);
  assert.equal(subtitleAt(rows, 1000).current.text, "нормальный парень");
  assert.equal(subtitleAt(rows, 3000).current.text, "duet");
  assert.equal(subtitleAt(rows, 6000).current.text, "next");
  assert.equal(subtitleAt(rows, 6000).next, undefined);
  assert.equal(subtitleAt(rows, -1000).current, rows[0]);
  assert.equal(subtitleAt(rows, 8000).current, subtitleAt(rows, 6000).current);
  assert.equal(subtitleAt(rows, 1000).next.text, "duet");
  assert.equal(subtitleAt(rows, 11000).next, undefined);
  assert.deepEqual(subtitleLines({ Type: "Static", Content: ["text"] }), []);
  assert.deepEqual(subtitleLines({ Type: "Line", Content: [{ Text: "bad", StartTime: 2, EndTime: 1 }] }), []);
});

test("subtitle backing vocals keep their own timing across lead changes and the final tail", () => {
  const early = { StartTime: 0, EndTime: 6, Syllables: [
    { Text: "э", StartTime: 0, EndTime: 2, IsPartOfWord: true },
    { Text: "хо", StartTime: 2, EndTime: 6 },
  ] };
  const tail = { Syllables: [{ Text: "ааа", StartTime: 9, EndTime: 13 }] };
  const data = { Type: "Syllable", Content: [
    { Lead: { StartTime: 2, EndTime: 4, Syllables: [{ Text: "lead" }] }, Background: [early] },
    { Lead: { StartTime: 8, EndTime: 10, Syllables: [{ Text: "next" }] }, Background: [tail,
      { StartTime: 12, EndTime: 11, Syllables: [{ Text: "invalid" }] },
      { StartTime: 9, EndTime: 12, Syllables: [] }], OppositeAligned: true },
  ] };
  const lead = subtitleLines(data), backing = subtitleBackingLines(data);
  assert.equal(backing.length, 2);
  assert.equal(backing[0].text, "эхо");
  assert.equal(backing[0].source.Lead.Syllables, early.Syllables);
  assert.equal("Lead" in early, false);
  assert.equal("Background" in early, false);
  assert.equal(backing[1].start, 9000);
  assert.equal(backing[1].end, 13000);
  assert.equal(backing[1].source.OppositeAligned, true);
  assert.deepEqual(subtitleBackingAt(backing, 0), [backing[0]]);
  assert.equal(subtitleAt(lead, 4500).current.text, "next");
  assert.deepEqual(subtitleBackingAt(backing, 4500), [backing[0]]);
  assert.deepEqual(subtitleBackingAt(backing, 6000), []);
  assert.deepEqual(subtitleBackingAt(backing, 7999), []);
  assert.deepEqual(subtitleBackingAt(backing, 8000), [backing[1]]);
  assert.equal(subtitleAt(lead, 11000).current, undefined);
  assert.deepEqual(subtitleBackingAt(backing, 11000), [backing[1]]);
  assert.deepEqual(subtitleBackingAt(backing, 13000), []);
  assert.deepEqual(subtitleBackingAt(backing, 1000), [backing[0]]);
  assert.deepEqual(subtitleBackingLines({ Type: "Static", Content: data.Content }), []);
});

test("subtitle backing vocals preserve simultaneous parts rather than choosing only one", () => {
  const backing = subtitleBackingLines({ Type: "Syllable", Content: [{ Background: [
    { StartTime: 1, EndTime: 5, Syllables: [{ Text: "left", StartTime: 1, EndTime: 5 }] },
    { Lead: { StartTime: 2, EndTime: 4, Syllables: [{ Text: "right", StartTime: 2, EndTime: 4 }] } },
  ] }] });
  assert.equal(backing.length, 2);
  assert.deepEqual(subtitleBackingAt(backing, 2500), backing);
});

const { createSubtitlePresence } = await load("src/components/Utils/SubtitlePresence.ts");
function presenceFixture(reduced = false) {
  const animations = [];
  const view = { getComputedStyle: () => ({ opacity: ".5", transform: "none" }), matchMedia: () => ({ matches: reduced }) };
  const element = () => ({ hidden: true, ownerDocument: { defaultView: view }, animate(frames, options) {
    const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation); return animation;
  } });
  const panel = element(), text = element(); let cleared = 0;
  const presence = createSubtitlePresence(panel, text, () => { cleared++; });
  return { panel, animations, presence, cleared: () => cleared };
}
test("subtitle panel keeps outgoing text until its exit finishes and repeated polls do not restart it", async () => {
  const { panel, animations, presence, cleared } = presenceFixture();
  const entered = presence.show(); animations[0].onfinish(); await entered;
  assert.equal(panel.hidden, false);
  const exited = presence.hide();
  assert.equal(presence.hide(), exited);
  assert.equal(panel.hidden, false);
  assert.equal(panel.inert, true);
  assert.equal(cleared(), 0);
  animations[2].onfinish(); await exited;
  assert.equal(panel.hidden, true);
  assert.equal(cleared(), 1);
});
test("subtitle panel reverses interrupted exits without letting stale callbacks clear the new song", async () => {
  const { panel, animations, presence, cleared } = presenceFixture();
  const first = presence.show();
  const oldExit = presence.hide(); const staleFinish = animations[2].onfinish;
  const reopened = presence.show(); await first; await oldExit;
  staleFinish();
  assert.equal(panel.hidden, false); assert.equal(panel.inert, false); assert.equal(cleared(), 0);
  animations[4].onfinish(); await reopened;
  assert.equal(presence.visible, true);
  presence.destroy(); assert.equal(panel.hidden, true); assert.equal(cleared(), 1);
});
test("subtitle panel respects reduced motion without delaying cleanup", async () => {
  const { panel, animations, presence, cleared } = presenceFixture(true);
  await presence.show(); assert.equal(panel.hidden, false);
  await presence.hide(); assert.equal(panel.hidden, true); assert.equal(cleared(), 1);
  assert.equal(animations.length, 0);
});

const { createSubtitleBacking } = await load("src/components/Utils/SubtitleBacking.ts");
function backingFixture(reduced = false) {
  const animations = [], sessions = [];
  const view = { matchMedia: () => ({ matches: reduced }), getComputedStyle: () => ({ opacity: ".5" }) };
  const doc = { defaultView: view, createElement: () => element() };
  function element() { return { ownerDocument: doc, hidden: true, children: [],
    append(...nodes) { nodes.forEach(node => { node.remove(); this.children.push(node); node.parent = this; }); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); },
    animate(frames) { const animation = { frames, cancel() { this.cancelled = true; } }; animations.push(animation); return animation; },
  }; }
  const host = element();
  const render = (content, data, seek, options) => {
    const session = { data, seek, options, rows: [{ element: { setAttribute() {} } }], times: [],
      animate(time) { this.times.push(time); }, destroy() { this.destroyed = true; } };
    sessions.push(session); return session;
  };
  const seeks = [];
  return { host, animations, sessions, seeks, controller: createSubtitleBacking(host, line => seeks.push(line), render) };
}
test("backing parts keep their DOM and production sessions when neighbouring parts enter or leave", () => {
  const { host, controller, sessions, animations, seeks } = backingFixture();
  const a = { text: "A", source: { StartTime: 1 } }, b = { text: "B", source: { StartTime: 2 } };
  controller.update([a], { Type: "Syllable" }, 1000);
  const first = host.children[0];
  controller.update([a, b], {}, 2000);
  assert.equal(sessions.length, 2); assert.equal(host.children[0], first);
  assert.equal(sessions[0].options.backgroundOnly, true);
  sessions[1].seek(); assert.equal(seeks[0], b);
  controller.update([a], {}, 3000);
  assert.equal(sessions[0].destroyed, undefined);
  assert.equal(sessions[1].destroyed, undefined); // finishing its fade, not abruptly deleted
  animations.at(-1).onfinish();
  assert.equal(sessions[1].destroyed, true); assert.equal(host.children[0], first);
  assert.deepEqual(sessions[0].times, [1000, 2000, 3000]);
  controller.clear(); assert.equal(host.children.length, 0); assert.equal(host.hidden, true);
});
test("rewinding during a backing exit reverses it without stale removal or a spring reset", () => {
  const { host, controller, sessions, animations } = backingFixture();
  const a = { text: "A", source: {} };
  controller.update([a], {}, 1000); controller.update([], {}, 3000);
  const oldFinish = animations.at(-1).onfinish;
  controller.update([a], {}, 1000); oldFinish();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].destroyed, undefined); assert.equal(host.children.length, 1);
  controller.update([], {}, 3000); const staleAfterClear = animations.at(-1).onfinish;
  controller.clear(); staleAfterClear(); assert.equal(host.children.length, 0);
  controller.update([a], {}, 1000); assert.equal(sessions.length, 2); assert.equal(host.hidden, false);
});
test("reduced-motion backing changes have no lingering outgoing parts", () => {
  const { host, controller, sessions, animations } = backingFixture(true);
  const a = { text: "A", source: {} };
  controller.update([a], {}, 1000); controller.update([], {}, 2000);
  assert.equal(sessions[0].destroyed, true); assert.equal(animations.length, 0); assert.equal(host.hidden, true);
});

test("rewinding restores backing source order without recreating a surviving part", () => {
  const { host, controller, sessions } = backingFixture(true);
  const a = { text: "A", source: {} }, b = { text: "B", source: {} };
  controller.update([b], {}, 5000); const retained = host.children[0];
  controller.update([a, b], {}, 1000);
  assert.equal(host.children[1], retained); assert.equal(sessions.length, 2);
  assert.equal(sessions[0].destroyed, undefined);
});

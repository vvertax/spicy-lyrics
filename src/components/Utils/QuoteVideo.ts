import { quoteLineText } from "./QuoteText.ts";
import { subtitleBackingLines, subtitleLines } from "./SubtitleModel.ts";

export const MAX_QUOTE_VIDEO_LINES = 24;
const MAX_QUOTE_VIDEO_DURATION_MS = 60_000;

export type QuoteVideoTiming = { start: number; end: number };
export type QuoteVideoClip = QuoteVideoTiming & { lyrics: { Type: "Line" | "Syllable"; Content: unknown[]; experimentalWordSync?: boolean } };

export function quoteVideoMarkerBounds(range: QuoteVideoTiming, marker: keyof QuoteVideoTiming, trackEnd: number): [number, number] {
  return marker === "start"
    ? [Math.max(0, range.end - MAX_QUOTE_VIDEO_DURATION_MS), range.end - 1]
    : [range.start + 1, Math.min(trackEnd, range.start + MAX_QUOTE_VIDEO_DURATION_MS)];
}

export function quoteSelection(data: { Type?: string; Content?: unknown[] }, position: number, explicit?: number) {
  const content = data.Content ?? [];
  const source = explicit === undefined ? subtitleLines(data).findLast(line => line.start <= position && position < line.end)?.source : null;
  const index = explicit ?? (source ? content.indexOf(source) : -1);
  return content.map((line, index) => ({ line, index, text: quoteLineText((line ?? {}) as Parameters<typeof quoteLineText>[0]) }))
    .filter(entry => entry.text && (entry.line as { Type?: string } | null)?.Type !== "Interlude")
    .map(entry => ({ ...entry, selected: entry.index === index }))
}

export function makeQuoteVideoClip(data: { Type?: string; Content?: unknown[]; experimentalWordSync?: boolean }, selected: number[], interludeMinMs = 3000): QuoteVideoClip | null {
  if (!selected.length || selected.length > MAX_QUOTE_VIDEO_LINES || new Set(selected).size !== selected.length) return null;
  const content = data.Content ?? [];
  const positions = new Map(quoteSelection(data, 0, -1).map((entry, position) => [entry.index, position]));
  const timed = new Map(subtitleLines(data).map(line => [line.source, line]));
  const lines = selected.map(index => {
    const position = positions.get(index);
    const line = timed.get(content[index]);
    return line && position !== undefined ? { position, line } : null;
  }).filter(entry => entry !== null);
  if (lines.length !== selected.length) return null;
  lines.sort((a, b) => a.line.start - b.line.start);
  const backing = new Map<unknown, QuoteVideoTiming>();
  for (const vocal of subtitleBackingLines({ ...data, Content: lines.map(({ line }) => line.source) })) {
    const range = backing.get(vocal.parent);
    backing.set(vocal.parent, {
      start: Math.min(vocal.start, range?.start ?? vocal.start),
      end: Math.max(vocal.end, range?.end ?? vocal.end),
    });
  }
  const vocalStart = lines.map(({ line }) => Math.min(line.start, backing.get(line.source)?.start ?? line.start));
  const start = Math.min(...vocalStart);
  let end = start;
  let previousPosition: number | undefined;
  const rows: unknown[] = [];
  for (const [index, { position, line }] of lines.entries()) {
    const gap = vocalStart[index] - end;
    if (previousPosition !== undefined && gap > 0 && (position !== previousPosition + 1 || gap >= interludeMinMs)) {
      rows.push({ Type: "Interlude", Text: "• • •", StartTime: end / 1000, EndTime: vocalStart[index] / 1000 });
    }
    rows.push(line.source);
    end = Math.max(end, line.end, backing.get(line.source)?.end ?? line.end);
    previousPosition = position;
  }
  return end > start && end - start <= MAX_QUOTE_VIDEO_DURATION_MS ? {
    start, end,
    lyrics: { Type: data.Type === "Syllable" ? "Syllable" : "Line", Content: rows, experimentalWordSync: data.experimentalWordSync },
  } : null;
}

const FPS = 30;

type RecordingWindow = Window & typeof globalThis;
type VideoFormat = { mimeType: string; extension: "mp4" | "webm" };

export function quoteVideoFormats(view: RecordingWindow): VideoFormat[] {
  const fixedEncoder = typeof view.VideoEncoder === "function";
  if (!fixedEncoder && (!view.MediaRecorder || !view.HTMLCanvasElement.prototype.captureStream)) return [];
  const formats: VideoFormat[] = [
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  return formats.filter(format => (fixedEncoder || format.extension === "webm")
    && (view.MediaRecorder?.isTypeSupported(format.mimeType) ?? true));
}

export async function recordQuoteVideo(
  canvas: HTMLCanvasElement, duration: number, draw: (elapsed: number) => void,
  signal: AbortSignal, onProgress: (ratio: number, extension: VideoFormat["extension"]) => void, audio?: AudioBuffer,
) {
  const { encodeQuoteFrames } = await import("./QuoteVideoEncoding.ts");
  if (typeof VideoEncoder !== "undefined") {
    const video = await encodeQuoteFrames(canvas, duration, FPS, draw, signal, onProgress, audio);
    if (video) return video;
  }
  const { encodeQuoteWebmFallback } = await import("./QuoteVideoWebm.ts");
  return encodeQuoteWebmFallback(canvas, duration, FPS, draw, signal, onProgress, audio);
}

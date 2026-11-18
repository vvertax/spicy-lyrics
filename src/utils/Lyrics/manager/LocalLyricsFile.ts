import { IsEmptyLyrics, StripEmptyLyricsLines } from "../EmptyLines.ts";
import { parseLRCLikeLyrics } from "../Sources/Lrclib.ts";
import { buildLineLyrics } from "../Sources/Shared.ts";
import { ParseTTML } from "./parseTTML.ts";

export type LocalLyricsFile = { format: "ttml" | "lrc"; text: string };
export type LocalLyricsEntry = LocalLyricsFile & { uri: string };

export function isTrackUri(uri: unknown): uri is string {
  return typeof uri === "string" && /^(spotify:track:[a-zA-Z0-9]+|spotify:local:.+)$/.test(uri);
}

export function readLocalLyricsFile(value: unknown): LocalLyricsFile | null {
  if (typeof value === "string") return { format: "ttml", text: value };
  if (!value || typeof value !== "object") return null;
  const { format, text } = value as Partial<LocalLyricsFile>;
  return (format === "ttml" || format === "lrc") && typeof text === "string" ? { format, text } : null;
}

export async function parseLocalLyrics(file: LocalLyricsFile, durationMs = 0) {
  if (file.format === "lrc") {
    const offsetMs = Number(file.text.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/im)?.[1] ?? 0);
    const { synced } = parseLRCLikeLyrics(file.text.replace(/^\s*\[[a-z]+:.*?\]\s*$/gim, ""));
    if (!synced || !Number.isSafeInteger(offsetMs)) return null;
    const lines = synced.map(line => ({ ...line, startTimeMs: Math.max(0, line.startTimeMs + offsetMs) }));
    const uniqueStarts = [...new Set(lines.map(line => line.startTimeMs))].sort((a, b) => a - b);
    const endByStart = new Map(uniqueStarts.map((start, index) => [start, uniqueStarts[index + 1] ?? (durationMs > start ? durationMs : start + 4000)]));
    return buildLineLyrics(lines.map(line => ({ ...line, endTimeMs: endByStart.get(line.startTimeMs) })), durationMs, "ldb");
  }
  const lyrics = (await ParseTTML(file.text))?.Result;
  if (!["Static", "Line", "Syllable"].includes(lyrics?.Type)) return null;
  StripEmptyLyricsLines(lyrics);
  return IsEmptyLyrics(lyrics) ? null : { ...lyrics, source: "ldb" };
}

export async function parseLyricsBackup(source: string): Promise<LocalLyricsEntry[]> {
  const backup = JSON.parse(source);
  if (backup?.version !== 1 || !Array.isArray(backup.entries)) throw new Error("Invalid lyrics backup.");
  const seen = new Set<string>();
  const entries: LocalLyricsEntry[] = [];
  for (const entry of backup.entries) {
    const file = typeof entry === "object" ? readLocalLyricsFile(entry) : null;
    if (!file || !isTrackUri(entry?.uri) || seen.has(entry.uri) || !(await parseLocalLyrics(file))) {
      throw new Error("Invalid lyrics backup.");
    }
    seen.add(entry.uri);
    entries.push({ ...file, uri: entry.uri });
  }
  return entries;
}

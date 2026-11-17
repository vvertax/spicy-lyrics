import { atom } from "nanostores";
import { $playbackOffset, $songPlaybackOffsets } from "./stores.ts";
import { $ttmlReviewer } from "./ttmlReviewer.ts";
export const OFFSET_LIMIT_MS = 5000;
export const $songOffsets = $songPlaybackOffsets;
export const $offsetScope = atom<"all" | "song">("all");
export function getSongOffset(uri: string | null | undefined): number { return uri ? $songOffsets.get()[uri] ?? 0 : 0; }
export function setSongOffset(uri: string, offsetMs: number) {
  if (!Number.isFinite(offsetMs)) return;
  const offset = Math.round(Math.max(-OFFSET_LIMIT_MS, Math.min(OFFSET_LIMIT_MS, offsetMs)));
  const values = { ...$songOffsets.get() };
  if (offset) values[uri] = offset; else delete values[uri];
  $songOffsets.set(values);
}
export function lyricsOffsetMs(uri: string | null | undefined): number { return $playbackOffset.get() + ($ttmlReviewer.get() ? 0 : getSongOffset(uri)); }

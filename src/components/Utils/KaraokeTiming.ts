/** Renderer line times and the playback clock are both milliseconds. */
export function hideKaraokeLine(startMs: number, positionMs: number): boolean {
  if (!Number.isFinite(startMs) || !Number.isFinite(positionMs)) return false;
  return startMs > positionMs + 650;
}

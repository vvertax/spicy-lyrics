type VocalLine = { StartTime: number; EndTime: number; DotLine?: boolean };

/** Only gaps with known vocals on the far side qualify. Overlapping voices keep the stage normal. */
export function isInstrumentalBreak(lines: readonly VocalLine[], position: number): boolean {
  let previousEnd = 0;
  let nextStart = Infinity;
  for (const line of lines) {
    if (line.DotLine || !Number.isFinite(line.StartTime) || !Number.isFinite(line.EndTime)) continue;
    if (position >= line.StartTime && position < line.EndTime) return false;
    if (line.EndTime <= position) previousEnd = Math.max(previousEnd, line.EndTime);
    if (line.StartTime > position) nextStart = Math.min(nextStart, line.StartTime);
  }
  return Number.isFinite(nextStart) && nextStart - previousEnd >= 8000 &&
    position >= previousEnd + 600 && position < nextStart - 1200;
}

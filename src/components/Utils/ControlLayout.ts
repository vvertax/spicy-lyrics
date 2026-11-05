export const QUICK_CONTROLS = [
  ["CinemaView", "Cinema View"], ["NowBarToggle", "NowBar"], ["cover-only", "Cover Only"],
  ["RomanizationToggle", "Romanization"], ["CompactModeToggle", "Compact Mode"],
  ["NowBarSideToggle", "Swap NowBar Side"], ["FullscreenToggle", "Fullscreen"],
  ["load-ttml", "Load TTML File"], ["LyricsManager", "Lyrics Manager"],
  ["CacheAction", "Clear Cached Lyrics"], ["karaoke", "Karaoke"], ["recording", "Recording Mode"],
  ["subtitles", "Subtitles"], ["quote", "Create Quote Card"], ["authors", "Find Author Works"],
  ["review", "Review Lyrics"], ["check-ttml", "Check TTML"], ["compare", "Compare TTML A/B"],
  ["SettingsToggle", "Settings"], ["Close", "Close Page"],
] as const;
export function controlId(id: string, label: string): string {
  return id || QUICK_CONTROLS.find(([,name]) => name === label.split(" · ")[0])?.[0] || label;
}
export function normalizeQuickControls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(QUICK_CONTROLS.map(([id]) => id));
  return [...new Set(value.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

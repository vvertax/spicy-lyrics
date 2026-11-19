export const QUICK_CONTROLS = [
  ["CinemaView", "Cinema View"], ["NowBarToggle", "NowBar"], ["cover-only", "Cover Only"],
  ["RomanizationToggle", "Romanization"], ["CompactModeToggle", "Compact Mode"],
  ["NowBarSideToggle", "Swap NowBar Side"], ["FullscreenToggle", "Fullscreen"],
  ["load-ttml", "Load TTML File"], ["LyricsManager", "Lyrics Manager"],
  ["CacheAction", "Clear Cached Lyrics"], ["karaoke", "Karaoke"], ["recording", "Recording Mode"],
  ["subtitles", "Subtitles"], ["quote", "Create Quote Card"], ["authors", "Find Author Works"],
  ["review", "Review Lyrics"], ["compare", "Compare TTML A/B"],
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

export function orderedQuickControls(pinned: string[], saved: unknown, menuOrder: string[]) {
  const leading = Array.isArray(saved) ? normalizeQuickControls(saved) : menuOrder;
  return [...new Set([...leading, ...pinned])].filter(id => pinned.includes(id));
}

export function moveQuickControl(order: string[], visible: string[], from: string, to: string) {
  const movable = order.filter(id => visible.includes(id));
  const source = movable.indexOf(from);
  const target = movable.indexOf(to);
  if (source === -1 || target === -1 || source === target) return order;
  movable.splice(source, 1);
  movable.splice(target, 0, from);
  let index = 0;
  return order.map(id => visible.includes(id) ? movable[index++] : id);
}

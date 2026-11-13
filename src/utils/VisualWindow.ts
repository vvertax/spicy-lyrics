const listeners = new Set<() => void>();
/** Moving the page is an explicit event, even if the old document is already hidden. */
export function notifyVisualWindowChanged(): void {
  for (const listener of [...listeners]) listener();
}
export function observeVisualWindow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

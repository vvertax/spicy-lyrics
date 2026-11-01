// Tools use the displayed model, not the fetch cache (which may be cleared).
let displayed: { uri: string; data: any } | null = null;
export function setDisplayedLyrics(uri: string | null, data: any): void {
  displayed = uri && data ? { uri, data } : null;
}
export function getDisplayedLyrics(uri: string | null): any {
  if (!uri || displayed?.uri !== uri) return null;
  const data = displayed.data;
  return data.Type === "Static" ? { ...data, Content: data.Lines ?? [] } : data;
}

export type InterfaceDesign = "ruytha" | "original";
let current: InterfaceDesign = "ruytha";
const documents = new Map<Document, number>();

/** All extension windows share one persisted design; Spotify's own UI is untouched. */
export function setInterfaceDesign(value: unknown): void {
  current = value === "original" ? "original" : "ruytha";
  documents.forEach((_, doc) => doc.documentElement?.setAttribute?.("data-sl-design", current));
}

export function registerDesignDocument(doc: Document): () => void {
  documents.set(doc, (documents.get(doc) ?? 0) + 1);
  doc.documentElement?.setAttribute?.("data-sl-design", current);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (documents.get(doc) ?? 1) - 1;
    if (count) documents.set(doc, count);
    else documents.delete(doc);
  };
}

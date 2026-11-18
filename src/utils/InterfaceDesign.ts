import { customPalette, DEFAULT_CUSTOM_COLOR, normalizePaletteHex } from "./CustomPalette.ts";

export const INTERFACE_DESIGNS = { ruytha: "Ruytha Fork", original: "Original Spicy Lyrics", "vvertax-you": "vvertax You" } as const;
export const VVERTAX_YOU_PALETTES = { gray: "Gray", lavender: "Lavender", green: "Green", white: "White", custom: "Custom palette" } as const;
export type InterfaceDesign = keyof typeof INTERFACE_DESIGNS;
export type VvertaxYouPalette = keyof typeof VVERTAX_YOU_PALETTES;
let current: InterfaceDesign = "ruytha";
let palette: VvertaxYouPalette = "gray";
let customColor = DEFAULT_CUSTOM_COLOR;
const documents = new Map<Document, number>();
const customDocuments = new WeakSet<Document>();
const roles = Object.keys(customPalette(DEFAULT_CUSTOM_COLOR).roles);

export function normalizeVvertaxYouPalette(value: unknown): VvertaxYouPalette {
  return value === "lavender" || value === "green" || value === "white" || value === "custom" ? value : "gray";
}

function applyDesign(doc: Document) {
  doc.documentElement?.setAttribute("data-sl-design", current);
  if (current === "vvertax-you") doc.documentElement?.setAttribute("data-sl-palette", palette);
  else doc.documentElement?.removeAttribute("data-sl-palette");
  if (current === "vvertax-you" && palette === "custom") {
    const { roles: colors, scheme } = customPalette(customColor);
    for (const [role, rgb] of Object.entries(colors)) doc.documentElement.style.setProperty("--you-" + role, `rgb(${rgb.join(" ")})`);
    doc.documentElement.style.setProperty("--you-scheme", scheme);
    customDocuments.add(doc);
  } else if (customDocuments.delete(doc)) {
    for (const role of [...roles, "scheme"]) doc.documentElement.style.removeProperty("--you-" + role);
  }
}

export function setVvertaxYouCustomColor(value: unknown): void {
  customColor = normalizePaletteHex(value) ?? DEFAULT_CUSTOM_COLOR;
  if (current === "vvertax-you" && palette === "custom") documents.forEach((_, doc) => applyDesign(doc));
}

/** All extension windows share one persisted design; Spotify's own UI is untouched. */
export function setInterfaceDesign(value: unknown): void {
  current = value === "original" || value === "vvertax-you" ? value : "ruytha";
  documents.forEach((_, doc) => applyDesign(doc));
}

export function setVvertaxYouPalette(value: unknown): void {
  palette = normalizeVvertaxYouPalette(value);
  if (current === "vvertax-you") documents.forEach((_, doc) => applyDesign(doc));
}

export function registerDesignDocument(doc: Document): () => void {
  documents.set(doc, (documents.get(doc) ?? 0) + 1);
  applyDesign(doc);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (documents.get(doc) ?? 1) - 1;
    if (count) documents.set(doc, count);
    else documents.delete(doc);
  };
}

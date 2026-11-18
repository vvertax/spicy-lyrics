type RGB = [number, number, number];
export type HSV = { hue: number; saturation: number; value: number };
const black: RGB = [0, 0, 0];
const white: RGB = [255, 255, 255];
export const DEFAULT_CUSTOM_COLOR = "#766296";

export function normalizePaletteHex(value: unknown) {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  return /^#?[0-9a-f]{6}$/i.test(hex) ? "#" + hex.replace(/^#/, "").toUpperCase() : null;
}

function hexRgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function paletteHexToHsv(hex: string, grayHue = 0): HSV {
  const [red, green, blue] = hexRgb(hex).map(channel => channel / 255);
  const value = Math.max(red, green, blue);
  const spread = value - Math.min(red, green, blue);
  if (spread === 0) return { hue: grayHue, saturation: 0, value };
  const sector = value === red ? (green - blue) / spread
    : value === green ? (blue - red) / spread + 2
    : (red - green) / spread + 4;
  return { hue: (sector * 60 + 360) % 360, saturation: spread / value, value };
}

export function paletteHsvToHex({ hue, saturation, value }: HSV) {
  const hexChannel = (offset: number) => {
    const position = (hue / 60 + offset) % 6;
    const channel = value * (1 - saturation * Math.max(0, Math.min(position, 4 - position, 1)));
    return Math.round(255 * channel).toString(16).padStart(2, "0");
  };
  return ("#" + [5, 3, 1].map(hexChannel).join("")).toUpperCase();
}

function luminance(color: RGB) {
  const linear = color.map(channel => {
    const s = channel / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

export function paletteContrast(a: RGB, b: RGB) {
  const [first, second] = [luminance(a), luminance(b)];
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return [channel(0), channel(1), channel(2)];
}

function ensureContrast(color: RGB, toward: RGB, backgrounds: RGB[], ratio: number): RGB {
  for (let step = 0; step < 100; step++) {
    const next = mix(color, toward, step / 100);
    if (backgrounds.every(background => paletteContrast(next, background) >= ratio)) return next;
  }
  return toward;
}

export function customPalette(value: unknown) {
  const hex = normalizePaletteHex(value) ?? DEFAULT_CUSTOM_COLOR;
  const seed = hexRgb(hex);
  const light = luminance(seed) > .45;
  const base = light ? white : black;
  const ink = light ? black : white;
  const surface = mix(mix(base, ink, light ? .015 : .065), seed, light ? .055 : .13);
  const container = mix(mix(surface, ink, .045), seed, light ? .018 : .035);
  const high = mix(mix(surface, ink, .08), seed, light ? .035 : .065);
  const tonal = mix(mix(high, ink, .05), seed, light ? .07 : .13);
  const backgrounds = [surface, container, high, tonal];
  const text = mix(ink, seed, .1);
  const muted = ensureContrast(mix(ink, seed, .32), ink, backgrounds, 4.5);
  const outline = ensureContrast(mix(container, text, .4), ink, backgrounds, 3);
  const divider = mix(container, text, .17);
  const primary = ensureContrast(seed, ink, backgrounds, 4.5);
  const onPrimary = paletteContrast(primary, black) > paletteContrast(primary, white) ? black : white;
  const roles = {
    surface, container, "container-high": high, text, muted, outline, divider,
    primary, "on-primary": onPrimary, tonal, "on-tonal": text,
  };
  return { roles, scheme: light ? "light" : "dark" };
}

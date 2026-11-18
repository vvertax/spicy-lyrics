import type { QuoteTemplate } from "./QuoteCardRenderer.ts";

export const VIDEO_QUOTE_FRAMES = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
} as const;
export type VideoQuoteFormat = keyof typeof VIDEO_QUOTE_FRAMES;
export type QuoteRegion = "cover" | "title" | "lyrics";
type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
export type QuoteLayoutOffsets = Partial<Record<QuoteRegion, Point>>;
export type QuoteVideoLayout = {
  cover: Box;
  title: Box & { centered: boolean };
  lyrics: Box & { focus: number; centered: boolean };
  fontSize: number;
  footerY: number;
};

export function defaultVideoLayout(format: VideoQuoteFormat, template: QuoteTemplate, art: boolean): QuoteVideoLayout {
  const { width, height } = VIDEO_QUOTE_FRAMES[format];
  const center = width / 2;
  const cover = (x: number, y: number, size: number) => ({ x, y, width: size, height: size });
  const title = (x: number, y: number, width: number, centered = false) => ({ x, y, width, height: 110, centered });
  const lyrics = (x: number, y: number, width: number, bottom: number, focus: number, centered = false) =>
    ({ x, y, width, height: bottom - y, focus, centered });
  let layout: Omit<QuoteVideoLayout, "fontSize" | "footerY">;
  if (format === "9:16") {
    switch (template) {
      case "classic":
        layout = { cover: cover(96, 144, 196), title: title(art ? 332 : 96, 186, art ? 652 : 888), lyrics: lyrics(96, 422, 888, 1718, 990) };
        break;
      case "poster":
        layout = { cover: cover(624, 126, 360), title: title(96, 236, art ? 470 : 888), lyrics: lyrics(96, art ? 570 : 465, 888, 1718, 1280) };
        break;
      case "type":
        layout = { cover: cover(880, 1770, 104), title: title(96, 240, 888, true), lyrics: lyrics(96, 415, 888, 1718, 1000, true) };
        break;
      default:
        layout = { cover: cover(325, 148, 430), title: title(96, art ? 630 : 300, 888, true), lyrics: lyrics(96, art ? 770 : 465, 888, 1718, art ? 1180 : 1030) };
    }
    return { ...layout, fontSize: 86, footerY: 1810 };
  }
  if (format === "1:1") {
    switch (template) {
      case "classic":
        layout = { cover: cover(72, 64, 150), title: title(art ? 258 : 72, 92, art ? 750 : 936), lyrics: lyrics(72, 245, 936, 940, 585) };
        break;
      case "poster":
        layout = { cover: cover(712, 62, 296), title: title(72, 142, art ? 580 : 936), lyrics: lyrics(72, art ? 395 : 270, 936, 940, 695) };
        break;
      case "type":
        layout = { cover: cover(922, 962, 86), title: title(72, 80, 936, true), lyrics: lyrics(72, 240, 936, 940, 570, true) };
        break;
      default:
        layout = { cover: cover(center - 113, 50, 226), title: title(72, art ? 310 : 90, 936, true), lyrics: lyrics(72, art ? 448 : 255, 936, 940, art ? 665 : 570) };
    }
    return { ...layout, fontSize: 62, footerY: 985 };
  }
  switch (template) {
    case "classic":
      layout = { cover: cover(88, 140, 440), title: title(art ? 640 : 88, 128, art ? 1192 : 1744), lyrics: lyrics(art ? 640 : 88, 305, art ? 1192 : 1744, 950, 600) };
      break;
    case "poster":
      layout = { cover: cover(1242, 126, 590), title: title(88, 122, art ? 1042 : 1744), lyrics: lyrics(88, 300, art ? 1042 : 1744, 945, 650) };
      break;
    case "type":
      layout = { cover: cover(1730, 962, 86), title: title(88, 95, 1744, true), lyrics: lyrics(88, 275, 1744, 950, 580, true) };
      break;
    default:
      layout = { cover: cover(center - 116, 46, 232), title: title(88, art ? 300 : 98, 1744, true), lyrics: lyrics(120, art ? 447 : 270, 1680, 950, art ? 675 : 570, true) };
  }
  return { ...layout, fontSize: 72, footerY: height - 95 };
}

export function resolveVideoLayout(format: VideoQuoteFormat, base: QuoteVideoLayout, offsets: QuoteLayoutOffsets) {
  const frame = VIDEO_QUOTE_FRAMES[format];
  const move = <T extends Box>(box: T, region: QuoteRegion): T => {
    const delta = offsets[region];
    return { ...box,
      x: Math.min(frame.width - box.width, Math.max(0, box.x + (delta?.x ?? 0))),
      y: Math.min(frame.height - box.height, Math.max(0, box.y + (delta?.y ?? 0))),
    };
  };
  const lyrics = move(base.lyrics, "lyrics");
  lyrics.focus += lyrics.y - base.lyrics.y;
  return { ...base, cover: move(base.cover, "cover"), title: move(base.title, "title"), lyrics };
}

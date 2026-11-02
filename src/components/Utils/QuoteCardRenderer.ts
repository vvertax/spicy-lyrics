import { wrapQuoteText } from "./QuoteText.ts";

export type QuoteTemplate = "classic" | "cover-top" | "poster" | "type";
export type QuoteCardOptions = {
  template: QuoteTemplate; format: string; lines: string[];
  title: string; artist: string; author: string;
  cover: HTMLImageElement | null; includeCover: boolean;
  artworkBackground: boolean; blur: number; darken: number;
  palette: string[]; usePalette: boolean; gradient: boolean;
  textColor: string; mutedColor: string; logo: HTMLCanvasElement | null;
};

/** Crop without stretching, including the blur overscan at the edges. */
export function coverCrop(imageWidth: number, imageHeight: number, width: number, height: number) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  return { x: (width - imageWidth * scale) / 2, y: (height - imageHeight * scale) / 2,
    width: imageWidth * scale, height: imageHeight * scale };
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(image, x + crop.x, y + crop.y, crop.width, crop.height); ctx.restore();
}

export function quoteGeometry(template: QuoteTemplate, height: number, includeCover: boolean) {
  const coverSize = template === "cover-top" ? 280 : template === "poster" ? 360 : 140;
  const top = template === "cover-top" && includeCover ? 536 : template === "poster" && includeCover ? 490 : template === "type" ? 250 : 330;
  return { top, bottom: height - 188, coverSize };
}

const backgrounds = new WeakMap<HTMLCanvasElement, { image: HTMLImageElement; blur: number; height: number; canvas: HTMLCanvasElement }>();

/** Same renderer for the live preview, downloaded PNG, and clipboard PNG. */
export function renderQuoteCard(ctx: CanvasRenderingContext2D, options: QuoteCardOptions): boolean {
  const { template, cover } = options;
  const hasCover = Boolean(options.includeCover && cover);
  const layoutAt = (height: number) => {
    const geometry = quoteGeometry(template, height, hasCover);
    let size = template === "type" ? 62 : 52;
    const rowsAt = () => {
      ctx.font = `bold ${size}px SpicyLyrics, sans-serif`;
      return options.lines.map(line => wrapQuoteText(line, 936, value => ctx.measureText(value).width));
    };
    let rows = rowsAt();
    const usedHeight = () => rows.reduce((total, line) => total + line.length * size * 1.35 + 12, 0);
    while (size > 22 && usedHeight() > geometry.bottom - geometry.top) { size -= 2; rows = rowsAt(); }
    return { ...geometry, size, rows, usedHeight: usedHeight(), fits: usedHeight() <= geometry.bottom - geometry.top };
  };
  let height = options.format === "auto" ? (options.lines.length > 7 ? 1920 : options.lines.length > 4 ? 1440 : 1080) : Number(options.format);
  let layout = layoutAt(height);
  while (options.format === "auto" && height < 1920 && (!layout.fits || layout.size < 32)) {
    height = height === 1080 ? 1440 : 1920; layout = layoutAt(height);
  }
  // Reset the bitmap as well as drawing state, so disabling artwork also clears any export taint.
  ctx.canvas.height = height;
  ctx.clearRect(0, 0, 1080, height);
  const top = options.usePalette ? options.palette[0] : "#382052";
  ctx.fillStyle = top;
  if (options.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top); gradient.addColorStop(1, options.usePalette ? options.palette[1] : "#211735");
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, 1080, height);
  const artwork = options.artworkBackground && cover;
  if (artwork) {
    let cached = backgrounds.get(ctx.canvas);
    if (!cached || cached.image !== cover || cached.blur !== options.blur || cached.height !== height) {
      const canvas = ctx.canvas.ownerDocument.createElement("canvas"); canvas.width = 1080; canvas.height = height;
      const background = canvas.getContext("2d")!;
      const bleed = options.blur * 3 + 2;
      background.filter = `blur(${options.blur}px)`;
      drawCover(background, cover, -bleed, -bleed, 1080 + bleed * 2, height + bleed * 2);
      cached = { image: cover, blur: options.blur, height, canvas }; backgrounds.set(ctx.canvas, cached);
    }
    ctx.drawImage(cached.canvas, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${options.darken / 100})`; ctx.fillRect(0, 0, 1080, height);
  }
  const textColor = artwork ? "#ffffff" : options.usePalette ? options.textColor : "#eee2ff";
  const mutedColor = artwork ? "#e0dce5" : options.usePalette ? options.mutedColor : "#c1add9";
  if (options.logo && !artwork && template !== "type") {
    ctx.save(); ctx.globalAlpha = .12; ctx.drawImage(options.logo, 580, -100); ctx.restore();
  }
  let titleX = 72, titleY = 88, titleWidth = 936;
  if (hasCover && cover) {
    if (template === "cover-top") {
      drawCover(ctx, cover, 400, 64, 280, 280); titleY = 382;
    } else if (template === "poster") {
      drawCover(ctx, cover, 648, 72, 360, 360); titleWidth = 520;
    } else if (template === "type") {
      drawCover(ctx, cover, 920, height - 148, 88, 88);
    } else {
      drawCover(ctx, cover, 72, 72, 140, 140); titleX = 240; titleWidth = 768;
    }
  }
  ctx.textBaseline = "top";
  if (artwork) { ctx.shadowColor = "#0009"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
  function label(text: string, x: number, y: number, width: number, size: number, maxRows: number, color: string, bold = false) {
    ctx.font = `${bold ? "bold " : ""}${size}px SpicyLyrics, sans-serif`; ctx.fillStyle = color;
    const rows = wrapQuoteText(text, width, value => ctx.measureText(value).width);
    for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
      let row = rows[i];
      if (i === maxRows - 1 && rows.length > maxRows) {
        while (row && ctx.measureText(`${row}…`).width > width) row = row.slice(0, -1);
        row += "…";
      }
      ctx.fillText(row, x, y + i * size * 1.3);
    }
  }
  label(options.title, titleX, titleY, titleWidth, 30, 2, textColor, true);
  label(options.artist, titleX, titleY + 88, titleWidth, 24, 1, mutedColor);
  ctx.font = `bold ${layout.size}px SpicyLyrics, sans-serif`; ctx.fillStyle = textColor;
  const centered = template === "type";
  ctx.textAlign = centered ? "center" : "left";
  let y = template === "poster" ? layout.bottom - layout.usedHeight : centered
    ? layout.top + (layout.bottom - layout.top - layout.usedHeight) / 2 : layout.top;
  for (const rows of layout.rows) {
    for (const row of rows) { ctx.fillText(row, centered ? 540 : 72, y); y += layout.size * 1.35; }
    y += 12;
  }
  ctx.textAlign = "left";
  const footerWidth = template === "type" && hasCover ? 808 : 936;
  label(options.author, 72, height - 140, footerWidth, 22, 1, mutedColor);
  label("Spicy Lyrics", 72, height - 84, 400, 22, 1, mutedColor, true);
  if (!(template === "type" && hasCover)) {
    ctx.font = "20px SpicyLyrics, sans-serif"; ctx.textAlign = "right";
    ctx.fillText("vvertax Edition", 1008, height - 82); ctx.textAlign = "left";
  } else label("vvertax Edition", 72, height - 54, 400, 18, 1, mutedColor);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.textBaseline = "alphabetic";
  return layout.fits;
}

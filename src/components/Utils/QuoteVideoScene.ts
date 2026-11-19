import { createBloomAnimationSession } from "../../utils/Lyrics/Animator/Lyrics/BloomAnimator.ts";
import { sampleInterludeDot } from "../../utils/Lyrics/Animator/Lyrics/LyricsAnimator.ts";
import bloomEmphasize from "../../utils/Lyrics/Applyer/Utils/BloomEmphasize.ts";
import { IsLetterCapable, MinLetterCapableDuration } from "../../utils/Lyrics/Applyer/Utils/BloomIsLetterCapable.ts";
import { isBloomRenderer, $spaceGravityMode } from "../../utils/stores.ts";
import isRtl from "../../utils/Lyrics/isRtl.ts";
import { renderComparisonLyrics } from "./ComparisonRenderer.ts";
import { coverCrop, drawBlurredQuoteCover, quoteBackgroundFill, type QuoteCardOptions } from "./QuoteCardRenderer.ts";
import { wrapQuoteText } from "./QuoteText.ts";
import type { QuoteVideoClip } from "./QuoteVideo.ts";

import { VIDEO_QUOTE_FRAMES, type QuoteVideoLayout, type VideoQuoteFormat } from "./QuoteVideoLayout.ts";

function paintBackdrop(ctx: CanvasRenderingContext2D, options: QuoteCardOptions, composition: QuoteVideoLayout, format: VideoQuoteFormat, scale: number) {
  const { width: WIDTH, height: HEIGHT } = VIDEO_QUOTE_FRAMES[format];
  const inset = format === "9:16" ? 96 : 72;
  const textWidth = WIDTH - inset * 2;
  const cover = options.cover;
  const artwork = options.artworkBackground && cover;
  const customGradient = options.gradient && !artwork;
  if (customGradient) {
    ctx.fillStyle = quoteBackgroundFill(ctx, HEIGHT, options);
  } else {
    const ambient = ctx.createRadialGradient(WIDTH / 2, 285, 50, WIDTH / 2, 320, 1000);
    ambient.addColorStop(0, cover && options.usePalette ? options.palette[0] : "#423555");
    ambient.addColorStop(1, "#15121a");
    ctx.fillStyle = ambient;
  }
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (artwork) {
    drawBlurredQuoteCover(ctx, artwork, WIDTH, HEIGHT, options.blur, scale);
    ctx.fillStyle = `rgba(0,0,0,${options.darken / 100})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (options.logo && !artwork) {
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.drawImage(options.logo, WIDTH - 500, -100);
    ctx.restore();
  }
  if (!customGradient && !artwork) {
    const shade = ctx.createLinearGradient(0, 550, 0, HEIGHT);
    shade.addColorStop(0, "transparent");
    shade.addColorStop(1, "#100e16e8");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 550, WIDTH, HEIGHT - 550);
  }

  if (options.includeCover && cover) {
    const { x, y, width: size } = composition.cover;
    const crop = coverCrop(cover.naturalWidth, cover.naturalHeight, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 26);
    ctx.shadowColor = "#0008";
    ctx.shadowBlur = 45;
    ctx.fillStyle = "#211c28";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    ctx.drawImage(cover, x + crop.x, y + crop.y, crop.width, crop.height);
    ctx.restore();
  }
  function label(text: string, y: number, size: number, weight: number, color: string,
    x = WIDTH / 2, width = textWidth, centered = true) {
    const rtl = isRtl(text);
    ctx.textAlign = centered ? "center" : rtl ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.font = weight + " " + size + "px SpicyLyrics, sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(text, !centered && rtl ? x + width : x, y, width);
  }
  const { x, y, width, centered } = composition.title;
  const titleX = centered ? x + width / 2 : x;
  label(options.title, y, 44, 700, "#fff", titleX, width, centered);
  label(options.artist, y + 63, 31, 500, "#ffffffa8", titleX, width, centered);
  const footerWidth = options.template === "type" && options.includeCover && cover ? textWidth - 136 : textWidth;
  label("Spicy Lyrics · vvertax Edition", composition.footerY, 23, 600, "#ffffffa8", inset + footerWidth / 2, footerWidth);
  if (options.author) label(options.author, composition.footerY + 37, 20, 500, "#ffffff70", inset + footerWidth / 2, footerWidth);
}

function gradient(ctx: CanvasRenderingContext2D, width: number, position: number, rtl: boolean) {
  const fill = ctx.createLinearGradient(rtl ? width : 0, 0, rtl ? 0 : width, 0);
  const bright = Math.max(0, Math.min(1, position / 100));
  const dim = Math.max(bright, Math.min(1, (position + 20) / 100));
  if (dim === 0) return "#ffffff82";
  fill.addColorStop(bright, position < 0 ? "#ffffffba" : "#fff");
  fill.addColorStop(dim, "#ffffff82");
  return fill;
}

export function prepareQuoteVideo(ctx: CanvasRenderingContext2D, clip: QuoteVideoClip, options: QuoteCardOptions, format: VideoQuoteFormat, composition: QuoteVideoLayout, scale = 1) {
  const { width: WIDTH, height: HEIGHT } = VIDEO_QUOTE_FRAMES[format];
  const doc = ctx.canvas.ownerDocument;
  const backdrop = doc.createElement("canvas");
  backdrop.width = WIDTH * scale;
  backdrop.height = HEIGHT * scale;
  const bg = backdrop.getContext("2d")!;
  bg.scale(scale, scale);
  paintBackdrop(bg, options, composition, format, scale);

  const stage = doc.createElement("div");
  stage.className = "vv-quote-motion-stage";
  stage.style.width = composition.lyrics.width + "px";
  stage.style.fontSize = composition.fontSize + "px";
  stage.style.setProperty("--DefaultLyricsSize", composition.fontSize + "px");
  stage.inert = true;
  stage.setAttribute("aria-hidden", "true");
  doc.body.append(stage);
  const bloom = isBloomRenderer() && !$spaceGravityMode.get();
  const session = renderComparisonLyrics(stage, clip.lyrics, () => {}, {
    useTrackOffset: false,
    animator: bloom ? {
      createSession: createBloomAnimationSession,
      emphasize: (letters, element, part, background, target) => bloomEmphasize(letters, element, part, background, undefined, null, target),
      isLetterCapable: IsLetterCapable,
      minLetterDuration: MinLetterCapableDuration,
    } : undefined,
  });
  const rowGap = composition.fontSize;
  let nextTop = 0;
  const rows = session.diffRows.map((row, index) => {
    const text = row.element.textContent ?? "";
    const rtl = isRtl(text);
    const backing = row.backgroundIndex !== undefined;
    const align: CanvasTextAlign = row.element.classList.contains("OppositeAligned") ? "right" :
      composition.lyrics.centered ? "center" : rtl ? "right" : "left";
    const rowFontSize = composition.fontSize * (backing ? .6 : 1);
    const weight = backing ? 600 : 700;
    row.element.dir = rtl ? "rtl" : "ltr";
    row.element.style.textAlign = align;
    row.element.style.fontSize = rowFontSize + "px";
    row.element.style.fontWeight = String(weight);
    if (backing) row.element.style.setProperty("--DefaultLyricsSize", rowFontSize + "px");
    if (index > 0) nextTop += rowGap * (backing ? .18 : 1);
    const height = row.element.offsetHeight;
    const center = nextTop + height / 2;
    nextTop += height;
    const glyphs = row.segments.flatMap(part => {
      const letters = Array.from(part.element.querySelectorAll<HTMLElement>(".letter"));
      return letters.length ? letters : [part.element];
    });
    const origin = backing ? row.element.getBoundingClientRect() : undefined;
    const segments = glyphs.map(element => ({ element, text: element.textContent ?? "",
      bounds: origin && relativeBounds(element, origin) })).filter(segment => segment.text.trim());
    const interlude = (clip.lyrics.Content[row.sourceIndex] as { Type?: string }).Type === "Interlude";
    return { ...row, text, rtl, align, backing, weight, rowFontSize, center, height, segments, interlude };
  });
  const leadRows = rows.filter(row => !row.backing);
  const destroy = () => { session.destroy(); stage.remove(); };
  if (!leadRows.length || rows.some(row => row.height > Math.min(620, composition.lyrics.height))) { destroy(); return null; }
  ctx.canvas.width = WIDTH * scale;
  ctx.canvas.height = HEIGHT * scale;
  ctx.scale(scale, scale);
  const { focus, x: left, y: top, width: textWidth, height, centered } = composition.lyrics;
  const bottom = top + height;
  const fontSize = Number.parseFloat(doc.defaultView!.getComputedStyle(stage).fontSize);

  function draw(time: number) {
    session.animate(time, time - clip.start);
    ctx.drawImage(backdrop, 0, 0, WIDTH, HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - 12, top, textWidth + 24, height);
    ctx.clip();
    let active = 0;
    for (let i = 1; i < leadRows.length; i++) if (leadRows[i].start <= time) active = i;
    const current = leadRows[active];
    const previous = leadRows[Math.max(0, active - 1)];
    const progress = Math.max(0, Math.min(1, (time - current.start) / 440));
    const center = current.center + (previous.center - current.center) * (1 - progress) ** 3;
    for (const row of rows) {
      const y = focus + row.center - center - row.height / 2;
      if (y > bottom || y + row.height < top) continue;
      const distance = Math.abs(row.center - center);
      const emphasis = Math.max(0, 1 - distance / (fontSize * 2.8));
      const vocalFade = Math.max(0, Math.min(1, (time - row.start) / 180, (row.end + 220 - time) / 220));
      const backingAlpha = .22 + .35 * emphasis;
      ctx.globalAlpha = row.backing
        ? backingAlpha + (.9 - backingAlpha) * vocalFade * vocalFade * (3 - 2 * vocalFade)
        : .26 + .74 * emphasis;

      if (row.interlude) {
        const radius = fontSize * .156;
        const spacing = fontSize * .46;
        const startX = centered ? left + textWidth / 2 - spacing : left + spacing / 2;
        const progress = (time - row.start) * 3 / (row.end - row.start);
        ctx.save();
        for (let dot = 0; dot < 3; dot++) {
          const pose = sampleInterludeDot(progress - dot);
          ctx.fillStyle = `rgba(255,255,255,${pose.opacity})`;
          ctx.shadowColor = `rgba(255,255,255,${pose.glow * .9})`;
          ctx.shadowBlur = (4 + 6 * pose.glow) * scale;
          ctx.beginPath();
          ctx.arc(startX + spacing * dot, y + row.height / 2 + pose.lift * fontSize, radius * pose.scale, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
        continue;
      }

      ctx.font = row.weight + " " + row.rowFontSize + "px SpicyLyrics, sans-serif";
      ctx.textBaseline = "top";
      ctx.textAlign = row.rtl ? "right" : "left";
      ctx.direction = row.rtl ? "rtl" : "ltr";
      if (!row.segments.length) {
        ctx.fillStyle = "#fff";
        const wrapped = wrapQuoteText(row.text, textWidth, text => ctx.measureText(text).width);
        ctx.textAlign = row.align;
        const x = row.align === "center" ? left + textWidth / 2 : row.align === "right" ? left + textWidth : left;
        wrapped.forEach((line, index) => ctx.fillText(line, x, y + index * row.rowFontSize * 1.24));
        continue;
      }
      // Backing vocals keep a stable baseline while their timing still drives the highlight.
      const origin = row.backing ? undefined : row.element.getBoundingClientRect();
      for (const { element, text, bounds: fixedBounds } of row.segments) {
        const bounds = fixedBounds ?? relativeBounds(element, origin!);
        if (bounds.width <= 0 || bounds.height <= 0) continue;
        const size = Math.max(row.rowFontSize * .3, bounds.height / 1.24);
        ctx.save();
        ctx.translate(left + bounds.left, y + bounds.top);
        ctx.font = row.weight + " " + size + "px SpicyLyrics, sans-serif";
        const position = element.style.getPropertyValue("--SLM_GradientPosition")
          || element.style.getPropertyValue("--gradient-position");
        ctx.fillStyle = gradient(ctx, bounds.width, Number.parseFloat(position || "-20"), row.rtl);
        const glow = Number.parseFloat(element.style.getPropertyValue("--text-shadow-opacity")) || 0;
        if (glow > 0) {
          const blur = element.style.getPropertyValue("--text-shadow-blur-radius");
          const relative = blur.match(/calc\(([\d.]+)em\s*\+\s*([\d.]+)px\)/);
          ctx.shadowColor = "rgba(255,255,255," + Math.min(1, glow / 100) + ")";
          ctx.shadowBlur = relative ? Number(relative[1]) * size + Number(relative[2]) : Number.parseFloat(blur) || 0;
        }
        ctx.fillText(text, row.rtl ? bounds.width : 0, (bounds.height - size) / 2);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  return { draw, destroy };
}

function relativeBounds(element: HTMLElement, origin: DOMRect) {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left: left - origin.left, top: top - origin.top, width, height };
}

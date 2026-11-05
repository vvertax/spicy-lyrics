import { visibleInterval } from "../../utils/WindowActivity.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { coverGradient } from "./QuotePalette.ts";
import { renderQuoteCard, type QuoteTemplate } from "./QuoteCardRenderer.ts";
import { quoteLineText } from "./QuoteText.ts";
import { hideKaraokeLine } from "./KaraokeTiming.ts";
import { toast } from "sonner";

import { LyricsObject } from "../../utils/Lyrics/lyrics.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { Icons } from "../Styling/Icons.ts";

type Modes = { karaoke: boolean; recording: boolean };
const modes = new WeakMap<HTMLElement, Modes>();
function state(page: HTMLElement): Modes {
  const existing = modes.get(page); if (existing) return existing;
  const value = { karaoke: false, recording: false }; modes.set(page, value);
  const doc = page.ownerDocument; const win = doc.defaultView!;
  const stopRecording = (event: KeyboardEvent) => {
    if (event.key === "Escape" && value.recording) {
      event.preventDefault(); event.stopImmediatePropagation();
      value.recording = false; page.classList.remove("VV_Recording");
      toast.success("Recording mode off");
    }
  };
  doc.addEventListener("keydown", stopRecording, true);
  const timer = visibleInterval(win,() => {
    if (!page.isConnected) { timer(); doc.removeEventListener("keydown", stopRecording, true); modes.delete(page); return; }
    if (!value.karaoke) return;
    const position = GetProgress();
    for (const line of [...LyricsObject.Types.Line.Lines, ...LyricsObject.Types.Syllable.Lines]) {
      const element = line.HTMLElement;
      if (!page.contains(element)) continue;
      const hidden = hideKaraokeLine(line.StartTime, position);
      if (element.classList.contains("VV_KaraokeHidden") !== hidden) {
        element.classList.toggle("VV_KaraokeHidden", hidden);
        if (!hidden && !win.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          element.animate([
            { opacity: 0, translate: "0 -70%", filter: "blur(2px)", clipPath: "inset(0 -5% 100% -5%)", offset: 0 },
            { opacity: .7, translate: "0 -20%", filter: "blur(.5px)", clipPath: "inset(-10% -5% 15% -5%)", offset: .55 },
            { opacity: 1, translate: "0 0", filter: "blur(0px)", clipPath: "inset(-10% -5% -10% -5%)", offset: 1 },
          ], { duration: 440, easing: "cubic-bezier(.22,1,.36,1)" });
        }
      }
    }
  }, 100);
  return value;
}

export function CreativeMenuRows(menu: HTMLElement, page: HTMLElement, add: (button: HTMLButtonElement, label: string) => void) {
  const doc = menu.ownerDocument;
  const row = (label: string, icon: string, action: () => void, active?: boolean) => {
    const button = doc.createElement("button"); button.type = "button"; button.innerHTML = icon;
    add(button, label); button.onclick = action;
    if (active !== undefined) { button.role = "menuitemcheckbox"; button.setAttribute("aria-checked", String(active)); }
    return button;
  };
  const current = modes.get(page);
  const karaoke = row("Karaoke · Alt+Shift+K", Icons.Karaoke, () => {
    const data = getDisplayedLyrics(SpotifyPlayer.GetUri());
    if (!data || data.Type === "Static") { toast.error("Karaoke needs synced lyrics"); return; }
    const value = state(page); value.karaoke = !value.karaoke;
    karaoke.setAttribute("aria-checked", String(value.karaoke));
    page.classList.toggle("VV_Karaoke", value.karaoke);
    if (!value.karaoke) page.querySelectorAll(".VV_KaraokeHidden").forEach(el => el.classList.remove("VV_KaraokeHidden"));
  }, current?.karaoke ?? false);
  karaoke.dataset.vvAction = "karaoke";
  const recording = row("Recording Mode · Alt+Shift+R", Icons.RecordingMode, () => {
    const value = state(page); value.recording = !value.recording;
    recording.setAttribute("aria-checked", String(value.recording));
    page.classList.toggle("VV_Recording", value.recording);
    if (value.recording) toast("Recording mode: press Escape to exit", { duration: 2500 });
  }, current?.recording ?? false);
  recording.dataset.vvAction = "recording";
  row("Create Quote Card", Icons.QuoteCard, () => { void quoteCard(doc).catch(error => toast.error((error as Error).message)); });
}

async function loadImage(doc: Document, url: string): Promise<HTMLImageElement> {
  const img = doc.createElement("img"); img.crossOrigin = "anonymous";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Artwork took too long to load")), 10000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("Artwork could not load. Export without cover or retry.")); }; img.src = url;
  });
}
export async function quoteCard(doc: Document, initialLine=0, supplied?:any) {
  const existing = doc.querySelector<HTMLDialogElement>(".vv-quote-dialog");
  if (existing) { existing.focus(); return; }
  const lyrics = supplied ?? getDisplayedLyrics(SpotifyPlayer.GetUri());
  if (!lyrics) throw new Error("Open a song with lyrics first");
  const lines = (lyrics.Content ?? []).map(quoteLineText).filter(Boolean) as string[];
  if (!lines.length) throw new Error("No lines available for a quote");
  // Snapshot track and credits: switching songs must not mix metadata into the card.
  const meta = { ...Spicetify.Player.data?.item?.metadata };
  const maker = lyrics.TTMLUploadMetadata?.Maker ?? lyrics.TTMLUploadMetadata?.Uploader;
  const author = maker?.username ? `Lyrics by @${maker.username}` : lyrics.sourceDisplayName ?? "";
  const previous = doc.activeElement as HTMLElement | null;
  const dialog = doc.createElement("dialog"); dialog.className = "vv-quote-dialog";
  const heading = doc.createElement("h2"); heading.textContent = "Create Quote Card";
  const help = doc.createElement("p"); help.textContent = "Pick your lines, choose a format, and make it yours.";
  const list = doc.createElement("div"); list.className = "vv-quote-lines";
  const canvas = doc.createElement("canvas"); canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;
  const format = doc.createElement("select"); format.setAttribute("aria-label", "Card format");
  for (const [value, label] of [["auto","Auto · fits your quote"],["1080","Square · 1:1"],["1440","Portrait · 3:4"],["1920","Story · 9:16"]]) {
    const option = doc.createElement("option"); option.value = value; option.textContent = label; format.append(option);
  }
  const counter = doc.createElement("span"); counter.className = "vv-quote-counter"; counter.setAttribute("aria-live", "polite");
  const dimensions = doc.createElement("span"); dimensions.className = "vv-quote-dimensions";
  let fitsCard = true;
  let copying = false;

  const selected=Math.max(0,(lyrics.Content??[]).slice(0,initialLine).map(quoteLineText).filter(Boolean).length);
  const picked = new Set<number>(lines[selected]?.length <= 1800 ? [selected] : []);
  const status = doc.createElement("p"); status.role = "status";
  const coverLabel = doc.createElement("label");
  const useCover = doc.createElement("input"); useCover.type = "checkbox"; useCover.checked = true;
  const coverText=doc.createElement("span");coverText.textContent="Include cover art";
  coverLabel.className="vv-quote-option";coverLabel.append(coverText,useCover);
  const paletteLabel = doc.createElement("label");
  const usePalette = doc.createElement("input"); usePalette.type = "checkbox";
  const paletteTextLabel=doc.createElement("span");paletteTextLabel.textContent="Background from cover colors";
  paletteLabel.className="vv-quote-option";paletteLabel.append(paletteTextLabel,usePalette);
  const gradientLabel = doc.createElement("label");
  const useGradient = doc.createElement("input");useGradient.type="checkbox";useGradient.checked=false;
  const gradientText=doc.createElement("span");gradientText.textContent="Gradient background";
  gradientLabel.className="vv-quote-option";gradientLabel.append(gradientText,useGradient);
  const template = doc.createElement("select"); template.setAttribute("aria-label", "Card template");
  for (const [value, text] of [["classic", "Classic"], ["cover-top", "Cover on Top"], ["poster", "Poster"], ["type", "Typography"]]) {
    const option = doc.createElement("option"); option.value = value; option.textContent = text; template.append(option);
  }
  const templateLabel = doc.createElement("label"); templateLabel.textContent = "Composition"; templateLabel.append(template);
  const artworkLabel = doc.createElement("label"); artworkLabel.className = "vv-quote-option";
  const useArtwork = doc.createElement("input"); useArtwork.type = "checkbox";
  const artworkText = doc.createElement("span"); artworkText.textContent = "Cover art as background";
  artworkLabel.append(artworkText, useArtwork);
  function range(label: string, max: number, value: number, unit: string) {
    const row = doc.createElement("label"); row.className = "vv-quote-range";
    const text = doc.createElement("span"); text.textContent = label;
    const output = doc.createElement("output");
    const input = doc.createElement("input"); input.type = "range"; input.min = "0"; input.max = String(max); input.step = "1"; input.value = String(value);
    input.setAttribute("aria-label", label);
    const update = () => { output.value = `${input.value} ${unit}`; };
    update(); input.oninput = () => { update(); paint(); };
    row.append(text, output, input); return { row, input };
  }
  const { row: blurLabel, input: blur } = range("Artwork Blur", 60, 20, "px");
  const { row: darkenLabel, input: darken } = range("Artwork Darkening", 90, 55, "%");
  let paletteAvailable = true;
  let palette = ["#382052", "#211735"];
  let paletteLogoLightness = 0;
  let paletteText = "#eee2ff";
  let paletteMuted = "#c1add9";
  let cover: HTMLImageElement | null = null;
  if (doc !== document) for (const face of document.fonts) {
    if (face.family.replace(/"/g, "") === "SpicyLyrics") doc.fonts.add(face);
  }
  await doc.fonts.load('700 52px "SpicyLyrics"').catch(() => []);

  const svg = Icons.LyricsPage.replace(/id="[^"]*"/g, "");
  const logo = await loadImage(doc, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).catch(() => null);
  const logoTint = doc.createElement("canvas"); logoTint.width = logoTint.height = 650;
  const logoCtx = logoTint.getContext("2d")!;
  function paint() {
    // Tint only the decorative logo; the cover keeps its original colors.
    if (logo) {
      const shade = usePalette.checked ? Math.round(paletteLogoLightness * 255) : 0;
      logoCtx.clearRect(0, 0, 650, 650); logoCtx.drawImage(logo, 0, 0, 650, 650);
      logoCtx.globalCompositeOperation = "source-in";
      logoCtx.fillStyle = `rgb(${shade},${shade},${shade})`; logoCtx.fillRect(0, 0, 650, 650);
      logoCtx.globalCompositeOperation = "source-over";
    }
    fitsCard = renderQuoteCard(ctx, {
      template: template.value as QuoteTemplate, format: format.value,
      lines: [...picked].sort((a, b) => a - b).map(i => lines[i]),
      title: String(meta.title ?? "Unknown song"), artist: String(meta.artist_name ?? ""), author,
      cover, includeCover: useCover.checked, artworkBackground: useArtwork.checked,
      blur: Number(blur.value), darken: Number(darken.value),
      palette, usePalette: usePalette.checked, gradient: useGradient.checked,
      textColor: paletteText, mutedColor: paletteMuted, logo: logo ? logoTint : null,
    });
    counter.textContent = `${picked.size} / 12 lines`;
    dimensions.textContent = `1080 × ${canvas.height} · PNG`;
    save.disabled = !picked.size || !fitsCard;
    copy.disabled = copying || !picked.size || !fitsCard;
    const fitMessage = "This quote is too long for this format. Choose Portrait / Story or fewer lines.";
    if (!fitsCard) status.textContent = fitMessage;
    else if (status.textContent === fitMessage) status.textContent = "";
    blurLabel.hidden = darkenLabel.hidden = !useArtwork.checked;
    usePalette.disabled = useArtwork.checked || !paletteAvailable;
    useGradient.disabled = useArtwork.checked;
  }
  lines.forEach((line, index) => {
    const label = doc.createElement("label"); const input = doc.createElement("input"); input.type = "checkbox"; input.checked = picked.has(index);
    input.onchange = () => {
      if (input.checked) {
        const length = [...picked].reduce((n,i) => n + lines[i].length, 0) + line.length;
        if (picked.size >= 12 || length > 1800) { input.checked = false; status.textContent = "Choose up to 12 lines / 1800 characters."; return; }
        picked.add(index);
      } else picked.delete(index);
      status.textContent = ""; paint();
    };
    const text = doc.createElement("span"); text.textContent = line;
    const number = doc.createElement("span"); number.className="vv-quote-line-number"; number.textContent=String(index+1).padStart(2,"0");
    label.append(input, number, text); list.append(label);
  });
  const save = doc.createElement("button"); save.textContent = "Save PNG";
  save.onclick = () => {
    if (!fitsCard) { status.textContent = "Choose a taller format or fewer lines."; return; }
    if (!picked.size) { status.textContent = "Select at least one line."; return; }
    if ((useCover.checked || useArtwork.checked) && !cover) { status.textContent = "Cover unavailable. Turn off cover art and the artwork background to export."; return; }
    try { canvas.toBlob(blob => {
      if (!blob) { status.textContent = "PNG export failed"; return; }
      const url = URL.createObjectURL(blob); const link = doc.createElement("a"); link.href = url; link.download = "spicy-lyrics-quote.png"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, "image/png"); } catch { status.textContent = "Image export blocked. Turn off cover art and the artwork background, then try again."; }
  };
  const copy = doc.createElement("button"); copy.textContent = "Copy image"; copy.className = "vv-quote-copy";
  copy.onclick = () => {
    if (copying) return;
    if (!fitsCard || !picked.size) { status.textContent = "Choose lines that fit the card first."; return; }
    if ((useCover.checked || useArtwork.checked) && !cover) { status.textContent = "Cover unavailable. Turn off cover art and the artwork background to copy."; return; }
    const clipboardWindow = doc.defaultView as Window & typeof globalThis;
    if (!clipboardWindow?.navigator.clipboard?.write || !clipboardWindow.ClipboardItem) {
      status.textContent = "Image clipboard is unavailable in this window. Use Save PNG."; return;
    }
    copying = true; copy.disabled = true; copy.textContent = "Copying…";
    try {
      // Start the clipboard write during the click gesture; PNG encoding resolves asynchronously.
      const png = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG encoding failed")), "image/png");
      });
      void clipboardWindow.navigator.clipboard.write([new clipboardWindow.ClipboardItem({ "image/png": png })])
        .then(() => { status.textContent = "Image copied. Paste it with Ctrl+V."; })
        .catch(() => { status.textContent = "Could not copy the image. Check clipboard permissions or use Save PNG."; })
        .finally(() => { copying = false; copy.textContent = "Copy image"; copy.disabled = !picked.size || !fitsCard; });
    } catch {
      copying = false; copy.textContent = "Copy image"; copy.disabled = !picked.size || !fitsCard;
      status.textContent = "Copying is blocked in this window. Use Save PNG.";
    }
  };
  const close = doc.createElement("button"); close.textContent = "Close"; close.onclick = () => dialog.close();
  useCover.onchange = paint;
  usePalette.onchange = paint;
  useGradient.onchange = paint;
  useArtwork.onchange = paint;
  template.onchange = () => { status.textContent = ""; paint(); };
  format.onchange = () => { status.textContent=""; paint(); };
  const header = doc.createElement("header"); header.className="vv-quote-header";
  const titles = doc.createElement("div"); titles.append(heading,help); header.append(titles,close);
  const body = doc.createElement("div"); body.className="vv-quote-body";
  const editor = doc.createElement("section"); editor.className="vv-quote-editor"; editor.setAttribute("aria-label","Quote selection and appearance");
  const listHeader = doc.createElement("div"); listHeader.className="vv-quote-list-header";
  const clear = doc.createElement("button"); clear.textContent="Clear selection";
  clear.onclick=()=>{picked.clear();list.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.checked=false);status.textContent="";paint();};
  listHeader.append(counter,clear);
  const formatLabel=doc.createElement("label"); formatLabel.textContent="Format"; formatLabel.append(format);
  editor.append(listHeader,list,templateLabel,formatLabel,coverLabel,artworkLabel,blurLabel,darkenLabel,paletteLabel,gradientLabel);
  const preview=doc.createElement("section"); preview.className="vv-quote-preview"; preview.setAttribute("aria-label","Card preview");preview.append(canvas,dimensions);
  body.append(editor,preview);
  const footer=doc.createElement("footer");footer.className="vv-quote-footer";footer.append(status,copy,save);
  dialog.append(header,body,footer);
  dialog.addEventListener("close", () => { dialog.remove(); previous?.focus(); }, { once: true });
  doc.body.append(dialog); dialog.showModal(); paint();
  let url = meta.image_xlarge_url ?? meta.image_large_url ?? meta.image_url;
  if (typeof url === "string" && url.startsWith("spotify:image:")) url = `https://i.scdn.co/image/${url.split(":").pop()}`;
  if (url) {
    status.textContent = "Loading cover…";
    cover = await loadImage(doc, url).catch(error => { status.textContent = (error as Error).message; return null; });
    if (cover) {
      status.textContent = "";
      try {
        const sample = doc.createElement("canvas"); sample.width = sample.height = 32;
        const sampleCtx = sample.getContext("2d")!; sampleCtx.drawImage(cover, 0, 0, 32, 32);
        const pixels = sampleCtx.getImageData(0, 0, 32, 32).data;
        const colors = coverGradient(pixels);const rgb=colors.accent;
        palette = colors.background.map(color => `rgb(${color.join(',')})`);
        // Relative luminance of the actual darkened gradient near the watermark.
        const linear = colors.background[0].map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
        const darkness = Math.max(0, Math.min(1, 1 - luminance / .1));
        paletteLogoLightness = darkness * darkness * (3 - 2 * darkness);
        // Blend toward white to retain the cover hue on the dark palette background.
        paletteText = `rgb(${rgb.map(value => Math.round(220 + value * .13)).join(',')})`;
        paletteMuted = `rgb(${rgb.map(value => Math.round(165 + value * .23)).join(',')})`;

      } catch { usePalette.checked = false; paletteAvailable = false; usePalette.disabled = true; status.textContent = "Cover colors unavailable."; }
      paint();
    }
  }
  else status.textContent = "No cover art available. Turn off cover art and the artwork background to export.";
}

import { visibleInterval } from "../../utils/WindowActivity.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { coverGradient } from "./QuotePalette.ts";
import { renderQuoteCard, type QuoteTemplate } from "./QuoteCardRenderer.ts";
import { MAX_QUOTE_VIDEO_LINES, makeQuoteVideoClip, quoteSelection, quoteVideoFormats, quoteVideoMarkerBounds, recordQuoteVideo, type QuoteVideoTiming } from "./QuoteVideo.ts";
import { prepareQuoteVideo } from "./QuoteVideoScene.ts";
import { VIDEO_QUOTE_FRAMES } from "./QuoteVideoLayout.ts";
import { createQuoteVideoLayoutEditor } from "./QuoteVideoLayoutEditor.ts";
import { canCaptureSpotifyAudio, captureSpotifyAudio } from "./QuoteSpotifyAudio.ts";
import { QUOTE_AUDIO_UNAVAILABLE, trimQuoteAudio } from "./QuoteVideoAudio.ts";
import { $uiLanguage } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { hideKaraokeLine } from "./KaraokeTiming.ts";
import { toast } from "sonner";

import { LyricsObject, getLyricsBetweenShow } from "../../utils/Lyrics/lyrics.ts";
import GetProgress from "../../utils/Gets/GetProgress.ts";
import { Icons } from "../Styling/Icons.ts";

type Modes = { karaoke: boolean; recording: boolean };
const modes = new WeakMap<HTMLElement, Modes>();
/** Called by the host capture handler before any page/fullscreen Escape action. */
export function consumeRecordingEscape(event: KeyboardEvent, page: HTMLElement | null | undefined): boolean {
  if (event.key !== "Escape" || !page || !modes.get(page)?.recording) return false;
  event.preventDefault(); event.stopImmediatePropagation();
  modes.get(page)!.recording = false; page.classList.remove("VV_Recording");
  toast.success("Recording mode off"); return true;
}
function state(page: HTMLElement): Modes {
  const existing = modes.get(page); if (existing) return existing;
  const value = { karaoke: false, recording: false }; modes.set(page, value);
  const doc = page.ownerDocument; const win = doc.defaultView!;
  const stopRecording = (event: KeyboardEvent) => {
    if (event.key === "Escape" && value.recording) {
      consumeRecordingEscape(event, page);
    }
  };
  win.addEventListener("keydown", stopRecording, true);
  const timer = visibleInterval(win,() => {
    if (!page.isConnected) { timer(); win.removeEventListener("keydown", stopRecording, true); modes.delete(page); return; }
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
export async function quoteCard(doc: Document, initialLine?: number, supplied?:any) {
  const existing = doc.querySelector<HTMLDialogElement>(".vv-quote-dialog");
  if (existing) { existing.focus(); return; }
  const quoteUri = SpotifyPlayer.GetUri();
  const trackDuration = Math.floor(SpotifyPlayer.GetDuration());
  const lyrics = supplied ?? getDisplayedLyrics(quoteUri);
  if (!lyrics) throw new Error("Open a song with lyrics first");
  const snapshot = { Type: lyrics.Type, experimentalWordSync: Boolean(lyrics.experimentalWordSync), Content: structuredClone(lyrics.Content ?? []) };
  const entries = quoteSelection(snapshot, initialLine === undefined ? GetProgress() : 0, initialLine);
  const lines = entries.map(entry => entry.text);
  const tr = (message: string) => translateUi(message, $uiLanguage.get());
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
  const view = doc.defaultView as Window & typeof globalThis;
  const videoFormats = quoteVideoFormats(view);
  const mode = doc.createElement("select");
  mode.setAttribute("aria-label", tr("Quote format"));
  for (const [value, text] of [["image", "Image"], ["video", "Video"]]) {
    const option = doc.createElement("option");
    option.value = value; option.textContent = text; mode.append(option);
  }
  const modeLabel = doc.createElement("label");
  modeLabel.textContent = "Quote format"; modeLabel.append(mode);
  const playVideo = doc.createElement("button"); playVideo.textContent = "Play preview";
  const saveVideo = doc.createElement("button"); saveVideo.textContent = "Save video";
  const cancelVideo = doc.createElement("button"); cancelVideo.textContent = "Cancel export";
  const timeline = doc.createElement("fieldset");
  timeline.className = "vv-quote-timeline";
  const timelineLegend = doc.createElement("legend");
  timelineLegend.textContent = "Clip timeline";
  timeline.append(timelineLegend);
  const startMarker = createMarker("Start");
  const endMarker = createMarker("End");
  const loopPreview = doc.createElement("input"); loopPreview.type = "checkbox";
  const loopLabel = doc.createElement("label"); loopLabel.className = "vv-quote-option";
  const loopText = doc.createElement("span"); loopText.textContent = "Loop preview";
  loopLabel.append(loopText, loopPreview);
  const audioOptions = doc.createElement("div"); audioOptions.className = "vv-quote-audio";
  const audioPicker = doc.createElement("input"); audioPicker.type = "file"; audioPicker.accept = "audio/*"; audioPicker.hidden = true;
  const addAudio = doc.createElement("button"); addAudio.type = "button"; addAudio.textContent = "Add audio file";
  const canRecordSpotify = canCaptureSpotifyAudio(view);
  const captureAudio = doc.createElement("button"); captureAudio.type = "button"; captureAudio.textContent = "Record Spotify audio"; captureAudio.hidden = !canRecordSpotify;
  const cancelCapture = doc.createElement("button"); cancelCapture.type = "button"; cancelCapture.textContent = "Cancel audio recording"; cancelCapture.hidden = true;
  const removeAudio = doc.createElement("button"); removeAudio.type = "button"; removeAudio.textContent = "Remove audio"; removeAudio.hidden = true;
  const audioName = doc.createElement("span"); audioName.dataset.i18nIgnore = ""; audioName.hidden = true;
  const audioOffset = doc.createElement("input"); audioOffset.type = "number"; audioOffset.value = "0"; audioOffset.step = ".1";
  audioOffset.setAttribute("aria-label", "Audio offset (seconds)");
  const offsetLabel = doc.createElement("label"); offsetLabel.textContent = "Audio offset (seconds)"; offsetLabel.append(audioOffset); offsetLabel.hidden = true;
  offsetLabel.title = "A positive offset starts later in the audio file.";
  const audioHint = doc.createElement("small"); audioHint.textContent = canRecordSpotify
    ? "Share Spotify with audio, or choose a local audio file."
    : "This window cannot record Spotify audio. Choose a local audio file.";
  const audioStatus = doc.createElement("small"); audioStatus.setAttribute("role", "status"); audioStatus.hidden = true;
  audioOptions.append(audioPicker, captureAudio, addAudio, cancelCapture, removeAudio, audioName, offsetLabel, audioHint, audioStatus);
  let audioBuffer: AudioBuffer | null = null;
  let recordedAudioOrigin: number | null = null;
  let captureController: AbortController | undefined;
  let audioLoading = false;
  let previewAudio: AudioBufferSourceNode | null = null;
  let previewContext: AudioContext | undefined;
  let previewRequest = 0;
  let previewPlaying = false;
  let playbackFrame = 0;
  let exportController: AbortController | null = null;
  function stopPlayback() {
    previewRequest++;
    previewPlaying = false;
    if (previewAudio) {
      previewAudio.stop();
      previewAudio.disconnect();
      previewAudio = null;
    }
    view.cancelAnimationFrame(playbackFrame);
    playbackFrame = 0;
    playVideo.textContent = tr("Play preview");
  }
  function stopVideo() {
    stopPlayback();
    exportController?.abort();
    captureController?.abort();
  }
  let draftRange: QuoteVideoTiming | null = null;
  let timelineEnd = 0;
  let videoScene: ReturnType<typeof prepareQuoteVideo> = null;
  const currentTiming = () => draftRange && { start: draftRange.start, duration: draftRange.end - draftRange.start };
  const audioStart = (clipStart: number) => clipStart - (recordedAudioOrigin ?? 0) + (audioOffset.valueAsNumber || 0) * 1000;
  function audioFits(scene: { start: number; duration: number }) {
    if (!audioBuffer) return true;
    const start = Math.round(audioStart(scene.start) * audioBuffer.sampleRate / 1000);
    const length = Math.max(1, Math.round(scene.duration * audioBuffer.sampleRate / 1000));
    return start >= 0 && start + length <= audioBuffer.length;
  }
  function setQuoteAudio(buffer: AudioBuffer, label: string, origin: number | null = null) {
    audioBuffer = buffer;
    recordedAudioOrigin = origin;
    audioName.textContent = label;
    audioName.hidden = removeAudio.hidden = offsetLabel.hidden = false;
    audioOffset.value = "0";
    audioStatus.hidden = true;
  }
  cancelCapture.onclick = () => captureController?.abort();
  captureAudio.onclick = async () => {
    const timing = currentTiming();
    if (!videoScene || !timing || !quoteUri || audioLoading || captureController || exportController) return;
    const controller = new AbortController();
    captureController = controller;
    audioLoading = true;
    addAudio.disabled = removeAudio.disabled = true;
    cancelCapture.hidden = false;
    list.inert = true;
    paint();
    audioStatus.textContent = tr("Select Spotify or the screen, and enable audio sharing."); audioStatus.hidden = false;
    try {
      const audio = await captureSpotifyAudio(view, quoteUri, timing.start, timing.duration, controller.signal, () => {
        audioStatus.textContent = tr("Recording Spotify audio…");
      });
      if (dialog.open && !controller.signal.aborted) setQuoteAudio(audio.buffer, tr("Spotify recording"), audio.origin);
    } catch (error) {
      const known = error instanceof Error && [
        "Return to the quoted song to record its audio.", "The selected source did not share audio.",
        "Audio sharing ended before recording finished.", "Spotify did not reach the selected part of the song.",
        "No music was detected in the shared audio. Share Spotify or system audio.",
      ].includes(error.message);
      audioStatus.textContent = tr(controller.signal.aborted ? "Audio recording cancelled."
        : known ? (error as Error).message : "Could not record Spotify audio. Try adding a local audio file.");
    } finally {
      captureController = undefined;
      audioLoading = false;
      addAudio.disabled = removeAudio.disabled = false;
      cancelCapture.hidden = true;
      list.inert = false;
      if (dialog.open) paint();
    }
  };
  addAudio.onclick = () => { audioPicker.value = ""; audioPicker.click(); };
  audioPicker.onchange = async () => {
    const file = audioPicker.files?.[0];
    if (!file || audioLoading) return;
    audioLoading = true;
    addAudio.disabled = removeAudio.disabled = true;
    paint();
    audioStatus.textContent = tr("Loading audio…"); audioStatus.hidden = false;
    try {
      const decoder = new OfflineAudioContext(2, 1, 48_000);
      const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
      if (!dialog.open) return;
      setQuoteAudio(decoded, file.name);
    } catch {
      audioStatus.textContent = tr("Could not open the audio file.");
    } finally {
      audioLoading = false;
      addAudio.disabled = removeAudio.disabled = false;
      if (dialog.open) paint();
    }
  };
  removeAudio.onclick = () => {
    audioBuffer = null; recordedAudioOrigin = null; audioPicker.value = "";
    audioName.hidden = removeAudio.hidden = offsetLabel.hidden = audioStatus.hidden = true;
    paint();
  };
  audioOffset.onchange = () => paint();
  const format = doc.createElement("select"); format.setAttribute("aria-label", "Card format");
  for (const [value, label] of [["auto","Auto · fits your quote"],["1080","Square · 1:1"],["1440","Portrait · 3:4"],["1920","Story · 9:16"]]) {
    const option = doc.createElement("option"); option.value = value; option.textContent = label; format.append(option);
  }
  const counter = doc.createElement("span"); counter.className = "vv-quote-counter"; counter.setAttribute("aria-live", "polite");
  const dimensions = doc.createElement("span"); dimensions.className = "vv-quote-dimensions";
  let fitsCard = true;
  let copying = false;

  const selected = Math.max(0, entries.findIndex(entry => entry.selected));
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
  const template = doc.createElement("select"); template.setAttribute("aria-label", "Composition");
  const compositions: Record<"image" | "video", QuoteTemplate> = { image: "classic", video: "cover-top" };
  for (const [value, text] of [["classic", "Classic"], ["cover-top", "Cover on Top"], ["poster", "Poster"], ["type", "Typography"]]) {
    const option = doc.createElement("option"); option.value = value; option.textContent = text; template.append(option);
  }
  const templateLabel = doc.createElement("label"); templateLabel.textContent = "Composition"; templateLabel.append(template);
  const videoLayout = createQuoteVideoLayoutEditor(doc, () => paint());
  const artworkLabel = doc.createElement("label"); artworkLabel.className = "vv-quote-option";
  const useArtwork = doc.createElement("input"); useArtwork.type = "checkbox";
  const artworkText = doc.createElement("span"); artworkText.textContent = "Cover art as background";
  artworkLabel.append(artworkText, useArtwork);

  function createMarker(label: string) {
    const row = doc.createElement("label"); row.className = "vv-quote-marker";
    const text = doc.createElement("span"); text.textContent = label;
    const output = doc.createElement("span"); output.dataset.i18nIgnore = "";
    const input = doc.createElement("input"); input.type = "range";
    input.min = "0"; input.step = "1";
    input.setAttribute("aria-label", label);
    row.append(text, output, input);
    timeline.append(row);
    return { input, output };
  }

  function syncTimeline() {
    if (!draftRange) return;
    for (const [marker, time] of [[startMarker, draftRange.start], [endMarker, draftRange.end]] as const) {
      const minutes = Math.floor(time / 60_000);
      const seconds = ((time % 60_000) / 1000).toFixed(3).padStart(6, "0");
      marker.output.textContent = `${minutes}:${seconds}`;
      marker.input.max = String(timelineEnd);
      marker.input.value = String(time);
      marker.input.setAttribute("aria-valuetext", marker.output.textContent);
    }
  }

  function moveMarker(marker: keyof QuoteVideoTiming, value: number) {
    if (!draftRange || !videoScene || audioLoading || exportController) return;
    stopPlayback();
    const [min, max] = quoteVideoMarkerBounds(draftRange, marker, timelineEnd);
    draftRange[marker] = Math.min(max, Math.max(min, value));
    syncTimeline();
    videoScene.draw(draftRange[marker]);
    updateVideoActions();
  }

  for (const [marker, { input }] of [["start", startMarker], ["end", endMarker]] as const) {
    input.oninput = () => moveMarker(marker, input.valueAsNumber);
    input.onkeydown = event => {
      const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
        : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      moveMarker(marker, input.valueAsNumber + direction * (event.shiftKey ? 1000 : 100));
    };
  }
  loopPreview.onchange = () => { stopPlayback(); if (draftRange) videoScene?.draw(draftRange.start); };

  function updateVideoActions() {
    const timing = currentTiming();
    const needsCover = (useCover.checked || useArtwork.checked) && !cover;
    const badAudio = timing && !audioFits(timing);
    timeline.hidden = !videoScene;
    timeline.disabled = audioLoading;
    loopPreview.disabled = !videoScene || audioLoading;
    captureAudio.disabled = !videoScene || !quoteUri || audioLoading;
    saveVideo.textContent = tr(audioBuffer ? "Save video" : "Save without audio");
    playVideo.disabled = !videoScene || audioLoading || Boolean(badAudio);
    saveVideo.disabled = !videoScene || !videoFormats.length || needsCover || audioLoading || Boolean(badAudio);
    status.textContent = tr(!timing ? "Select timed lines within a 60-second range."
      : !videoScene ? "Choose fewer lines to fit the video."
      : badAudio ? recordedAudioOrigin !== null
        ? "The Spotify recording does not cover this clip. Record it again or narrow the range."
        : "The audio file does not cover the selected lines. Adjust its offset or choose a longer file."
      : !videoFormats.length ? "Video export is unavailable in this window."
      : needsCover ? "Cover unavailable. Turn off cover art and the artwork background to export." : "");
  }

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
  dialog.hidden = true;
  doc.body.append(dialog);
  await doc.fonts.load('700 52px "SpicyLyrics"').catch(() => []);

  const svg = Icons.LyricsPage.replace(/id="[^"]*"/g, "");
  const logo = await loadImage(doc, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).catch(() => null);
  const logoTint = doc.createElement("canvas"); logoTint.width = logoTint.height = 650;
  const logoCtx = logoTint.getContext("2d")!;
  function paint(exporting = false) {
    if (exportController) return;
    // Tint only the decorative logo; the cover keeps its original colors.
    if (logo) {
      const shade = usePalette.checked ? Math.round(paletteLogoLightness * 255) : 0;
      logoCtx.clearRect(0, 0, 650, 650); logoCtx.drawImage(logo, 0, 0, 650, 650);
      logoCtx.globalCompositeOperation = "source-in";
      logoCtx.fillStyle = `rgb(${shade},${shade},${shade})`; logoCtx.fillRect(0, 0, 650, 650);
      logoCtx.globalCompositeOperation = "source-over";
    }
    stopPlayback();
    videoScene?.destroy();
    videoScene = null;
    const isVideo = mode.value === "video";
    const indices = [...picked].sort((a, b) => a - b);
    const options = {
      template: template.value as QuoteTemplate, format: format.value,
      lines: indices.map(index => lines[index]),
      title: String(meta.title ?? "Unknown song"), artist: String(meta.artist_name ?? ""), author,
      cover, includeCover: useCover.checked, artworkBackground: useArtwork.checked,
      blur: Number(blur.value), darken: Number(darken.value),
      palette, usePalette: usePalette.checked, gradient: useGradient.checked,
      textColor: paletteText, mutedColor: paletteMuted, logo: logo ? logoTint : null,
    };
    videoLayout.configure(isVideo, options.template, Boolean(options.includeCover && cover));
    const lineLimit = isVideo ? MAX_QUOTE_VIDEO_LINES : 12;
    counter.textContent = tr(indices.length + " / " + lineLimit + " lines");
    formatLabel.hidden = isVideo;
    save.hidden = copy.hidden = isVideo;
    audioOptions.hidden = !isVideo;
    timeline.hidden = loopLabel.hidden = !isVideo;
    playVideo.hidden = saveVideo.hidden = !isVideo;
    cancelVideo.hidden = !isVideo || !exportController;
    blurLabel.hidden = darkenLabel.hidden = !useArtwork.checked;
    usePalette.disabled = useArtwork.checked || !paletteAvailable;
    useGradient.disabled = useArtwork.checked;
    if (isVideo) {
      const clip = makeQuoteVideoClip(snapshot, indices.map(index => entries[index].index), getLyricsBetweenShow() * 1000);
      if (clip) {
        timelineEnd = trackDuration > 0 ? trackDuration : Math.ceil(clip.end);
        const end = Math.min(timelineEnd, Math.round(clip.end));
        const start = Math.max(0, Math.round(clip.start));
        if (end <= start) draftRange = null;
        else draftRange ??= { start, end };
      } else draftRange = null;
      const ratio = videoLayout.ratio();
      const { width, height } = VIDEO_QUOTE_FRAMES[ratio];
      videoScene = clip && draftRange && prepareQuoteVideo(ctx, clip, options, ratio, videoLayout.layout(), exporting ? 1 : .5);
      if (videoScene && draftRange) {
        syncTimeline();
        videoScene.draw(draftRange.start);
      }
      else {
        canvas.width = width / (exporting ? 1 : 2); canvas.height = height / (exporting ? 1 : 2);
        ctx.fillStyle = "#211735"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      dimensions.textContent = `${width} × ${height} · ` + (videoFormats[0]?.extension.toUpperCase() ?? tr("Video"));
      updateVideoActions();
      return;
    }
    videoScene = null;
    const validPngSelection = indices.length <= lineLimit && options.lines.reduce((length, line) => length + line.length, 0) <= 1800;
    fitsCard = renderQuoteCard(ctx, options) && validPngSelection;
    dimensions.textContent = `1080 × ${canvas.height} · PNG`;
    save.disabled = !picked.size || !fitsCard;
    copy.disabled = copying || !picked.size || !fitsCard;
    const fitMessage = "This quote is too long for this format. Choose Portrait / Story or fewer lines.";
    const selectionMessage = "Choose up to 12 lines / 1800 characters.";
    if (!validPngSelection) status.textContent = tr(selectionMessage);
    else if (!fitsCard) status.textContent = tr(fitMessage);
    else if (status.textContent === tr(fitMessage) || status.textContent === tr(selectionMessage)) status.textContent = "";
  }
  lines.forEach((line, index) => {
    const label = doc.createElement("label"); const input = doc.createElement("input"); input.type = "checkbox"; input.checked = picked.has(index);
    input.onchange = () => {
      if (input.checked) {
        const isVideo = mode.value === "video";
        const limit = isVideo ? MAX_QUOTE_VIDEO_LINES : 12;
        const tooLongForPng = !isVideo && [...picked].reduce((length, i) => length + lines[i].length, line.length) > 1800;
        if (picked.size >= limit || tooLongForPng) {
          input.checked = false;
          status.textContent = tr(isVideo ? "Choose up to 24 lines." : "Choose up to 12 lines / 1800 characters.");
          return;
        }
        picked.add(index);
      } else picked.delete(index);
      draftRange = null;
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
  cancelVideo.onclick = () => exportController?.abort();
  playVideo.onclick = async () => {
    if (!videoScene) return;
    if (previewPlaying) { paint(); return; }
    paint();
    const scene = videoScene;
    const timing = currentTiming();
    if (!scene || !timing || !audioFits(timing)) return;
    const looping = loopPreview.checked;
    const request = previewRequest;
    previewPlaying = true;
    playVideo.textContent = tr("Stop preview");
    const started = view.performance.now();
    let elapsedTime = () => view.performance.now() - started;
    if (audioBuffer) {
      try {
        const context = previewContext ??= new view.AudioContext();
        await context.resume();
        if (!dialog.open || request !== previewRequest || !audioBuffer) return;
        const node = context.createBufferSource();
        node.buffer = audioBuffer;
        node.connect(context.destination);
        const offset = audioStart(timing.start) / 1000;
        const duration = timing.duration / 1000;
        const scheduled = context.currentTime + .03;
        if (looping) {
          node.loop = true;
          node.loopStart = offset;
          node.loopEnd = offset + duration;
          node.start(scheduled, offset);
        } else node.start(scheduled, offset, duration);
        previewAudio = node;
        elapsedTime = () => (context.currentTime - scheduled) * 1000;
      } catch {
        if (request === previewRequest) {
          stopPlayback();
          status.textContent = tr("Could not play the audio file.");
        }
        return;
      }
    }
    const tick = () => {
      const elapsed = Math.max(0, elapsedTime());
      const position = looping ? elapsed % timing.duration : Math.min(timing.duration, elapsed);
      scene.draw(timing.start + position);
      if (looping || elapsed < timing.duration) playbackFrame = view.requestAnimationFrame(tick);
      else stopPlayback();
    };
    playbackFrame = view.requestAnimationFrame(tick);
  };
  saveVideo.onclick = async () => {
    if (!videoScene || exportController) return;
    paint(true);
    const scene = videoScene;
    const timing = currentTiming();
    if (!scene || !timing || !audioFits(timing)) return;
    const controller = new AbortController();
    exportController = controller;
    cancelVideo.hidden = false;
    saveVideo.disabled = playVideo.disabled = true;
    editor.inert = true;
    videoLayout.overlay.inert = true;
    let failed: string | null = null;
    try {
      const audio = audioBuffer && trimQuoteAudio(audioBuffer, audioStart(timing.start), timing.duration);
      if (audioBuffer && !audio) throw new Error("The audio file does not cover the selected lines. Adjust its offset or choose a longer file.");
      const { blob, extension } = await recordQuoteVideo(canvas, timing.duration, elapsed => scene.draw(timing.start + elapsed), controller.signal, (ratio, format) => {
        status.textContent = tr("Exporting video…") + " " + Math.round(ratio * 100) + "% · " + format.toUpperCase();
      }, audio ?? undefined);
      if (!dialog.open || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = "spicy-lyrics-quote." + extension;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      if (!controller.signal.aborted) failed = error instanceof Error && error.message === QUOTE_AUDIO_UNAVAILABLE
        ? QUOTE_AUDIO_UNAVAILABLE : "Video export failed.";
      if (failed) console.error("Quote video export failed", error);
    } finally {
      exportController = null;
      editor.inert = false;
      videoLayout.overlay.inert = false;
      cancelVideo.hidden = true;
      if (dialog.open) {
        paint();
        if (failed) status.textContent = tr(failed);
        else if (controller.signal.aborted) status.textContent = tr("Video export cancelled.");
      }
    }
  };
  mode.onchange = () => {
    template.value = compositions[mode.value === "video" ? "video" : "image"];
    status.textContent = "";
    paint();
  };
  const close = doc.createElement("button"); close.textContent = "Close"; close.onclick = () => dialog.close();
  useCover.onchange = () => paint();
  usePalette.onchange = () => paint();
  useGradient.onchange = () => paint();
  useArtwork.onchange = () => paint();
  template.onchange = () => {
    compositions[mode.value === "video" ? "video" : "image"] = template.value as QuoteTemplate;
    status.textContent = "";
    paint();
  };
  format.onchange = () => { status.textContent=""; paint(); };
  const header = doc.createElement("header"); header.className="vv-quote-header";
  const titles = doc.createElement("div"); titles.append(heading,help); header.append(titles,close);
  const body = doc.createElement("div"); body.className="vv-quote-body";
  const editor = doc.createElement("section"); editor.className="vv-quote-editor"; editor.setAttribute("aria-label","Quote selection and appearance");
  const listHeader = doc.createElement("div"); listHeader.className="vv-quote-list-header";
  const clear = doc.createElement("button"); clear.textContent="Clear selection";
  clear.onclick=()=>{picked.clear();draftRange=null;list.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.checked=false);status.textContent="";paint();};
  listHeader.append(counter,clear);
  const formatLabel=doc.createElement("label"); formatLabel.textContent="Format"; formatLabel.append(format);
  editor.append(modeLabel,templateLabel,videoLayout.options,listHeader,list,timeline,loopLabel,formatLabel,coverLabel,artworkLabel,blurLabel,darkenLabel,paletteLabel,gradientLabel,audioOptions);
  const preview=doc.createElement("section"); preview.className="vv-quote-preview"; preview.setAttribute("aria-label","Card preview");
  videoLayout.frame.prepend(canvas);
  preview.append(videoLayout.frame,dimensions);
  body.append(editor,preview);
  const footer=doc.createElement("footer");footer.className="vv-quote-footer";footer.append(status,copy,save,playVideo,saveVideo,cancelVideo);
  dialog.append(header,body,footer);
  const stopOnHide = () => { if (doc.hidden) stopPlayback(); };
  doc.addEventListener("visibilitychange", stopOnHide);
  view.addEventListener("pagehide", stopVideo, { once: true });
  dialog.addEventListener("close", () => {
    stopVideo();
    videoLayout.destroy();
    videoScene?.destroy();
    void previewContext?.close().catch(() => {});
    doc.removeEventListener("visibilitychange", stopOnHide);
    view.removeEventListener("pagehide", stopVideo);
    dialog.remove();
    previous?.focus();
  }, { once: true });
  dialog.hidden = false; dialog.showModal(); paint();
  const initial = list.querySelector("input:checked")?.parentElement;
  if (initial) list.scrollTop += Math.max(0, initial.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom);
  let url = meta.image_xlarge_url ?? meta.image_large_url ?? meta.image_url;
  if (typeof url === "string" && url.startsWith("spotify:image:")) url = `https://i.scdn.co/image/${url.split(":").pop()}`;
  if (url) {
    status.textContent = "Loading cover…";
    cover = await loadImage(doc, url).catch(error => { status.textContent = (error as Error).message; return null; });
    if (!dialog.open) return;
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

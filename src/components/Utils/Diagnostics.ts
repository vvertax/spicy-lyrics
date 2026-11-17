import { safeDiagnosticValue, formatDiagnosticText, type DiagnosticData } from "../../utils/DiagnosticReport.ts";
import { GetLastLyricsFailure, GetLyricsAnsweredFrom, getActiveLyricsSourceOrder } from "../../utils/Lyrics/fetchLyrics.ts";
import { IsOpen as IsBreakerOpen, RetryAfterMs } from "../../utils/API/CircuitBreaker.ts";
import { $ttmlReviewer } from "../../utils/ttmlReviewer.ts";
import { Icons } from "../Styling/Icons.ts";
import { getExperiments,isExperimentEnabled } from "../../utils/experiments.ts";
import { diagnosticErrors,redactDiagnostic } from "../../utils/DiagnosticLog.ts";
import { settingsHistory } from "../../utils/SettingsHistory.ts";
import { ProjectVersion } from "../../../project/config.ts";
import { $spicyLyricsVersion, $showVolumeSliderFullscreen, $playbackOffset, $songPlaybackOffsets, $rendererVisualStyle, $lyricsSize, $ctrlWheelLyricsZoom, $lyricsRendererPaused, $currentlyFetching, $buildChannel,$uiLanguage } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { getDisplayedLyrics } from "../../utils/Lyrics/DisplayedLyrics.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
const read = <T>(fn: () => T, fallback: T): T => { try { return fn() ?? fallback; } catch { return fallback; } };
const rect = (element: Element | null | undefined) => {
  if (!element) return null;
  const bounds = element.getBoundingClientRect();
  return Object.fromEntries(["left","top","right","bottom","width","height"].map(key => [key, Math.round(bounds[key as keyof DOMRect] as number)]));
};
export function buildDiagnosticData(doc: Document = document) {
  const win = doc.defaultView!;
  const page = doc.querySelector<HTMLElement>("#SpicyLyricsPage");
  const classes = page?.classList;
  const uri = read(() => SpotifyPlayer.GetUri(), null);
  const lyrics = getDisplayedLyrics(uri);
  const rows = lyrics?.Type === "Static" ? lyrics.Lines ?? lyrics.Content ?? [] : lyrics?.Content ?? [];
  const vocals = rows.filter((row: any) => row.Type !== "Interlude");
  const words = vocals.flatMap((row: any) => row.Lead?.Syllables ?? []);
  const volume = page?.querySelector<HTMLElement>(".FullscreenVolumeSlider");
  const volumeBounds = rect(volume);
  const pageBounds = rect(page);
  const viewportWidth = doc.documentElement.clientWidth || win.innerWidth;
  const settings = Object.fromEntries([...settingsHistory.stores].flatMap(([key,store]) => {
    if (key.startsWith("experiment:")) return [];
    if (/token|secret|password|cookie|auth|songPlaybackOffsets|quickControlIds|favorite|hiddenSetting|font(?!Enabled)|url|file|saved|selected|settingsMenuLocation/i.test(key)) return [];
    const value = read(() => store.get(), null);
    if (typeof value === "boolean" || typeof value === "number" || value == null || typeof value === "string" && /renderer|style|mode|position|fullscreen|channel|language|escape|sourceorder|disabledlyricssources/i.test(key)) return [[key,value]];
    return [];
  }));
  const findings: string[] = [];
  if (volumeBounds && (Number(volumeBounds.left) < 0 || Number(volumeBounds.right) > viewportWidth)) findings.push("Fullscreen volume slider is outside the viewport");
  const failure = read(() => GetLastLyricsFailure(uri ?? undefined), null);
  if (failure) findings.push(`Lyrics request failed at ${failure.source}`);
  if (!win.navigator.onLine) findings.push("Network is offline");
  const experiments = Object.fromEntries(getExperiments().map(exp => [exp.id,isExperimentEnabled(exp.id)]));
  return safeDiagnosticValue({
    schemaVersion: 2, version: ProjectVersion, capturedAt: new Date().toISOString(), channel: $buildChannel.get(),
    runtime: {
      loadedVersion: $spicyLyricsVersion.get(), language: $uiLanguage.get(),
      spicetifyVersion: read(() => (Spicetify as any).Config?.version, "unknown"),
      spotifyVersion: read(() => (Spicetify as any).Platform?.version ?? win.navigator.userAgent.match(/Spotify[\/ ]([\d.]+)/i)?.[1], "unknown"),
      platform: win.navigator.platform, online: win.navigator.onLine, visibility: doc.visibilityState,
      hostVisibility: typeof document !== "undefined" ? document.visibilityState : "unknown", pixelRatio: win.devicePixelRatio,
      reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
      cpuThreads: win.navigator.hardwareConcurrency,
      heapUsedMb: read(() => Math.round((win.performance as any).memory.usedJSHeapSize / 1048576), null),
    },
    window: {
      viewport: { width: viewportWidth, height: doc.documentElement.clientHeight || win.innerHeight },
      mode: classes?.contains("CardMode") ? "sidebar" : page?.closest(".spicy-pip-wrapper") ? "popup" : classes?.contains("Fullscreen") ? doc.fullscreenElement ? "fullscreen" : "cinema" : "page",
      compact: !!classes?.contains("CompactMode") || !!classes?.contains("ForcedCompactMode"),
      coverSide: classes?.contains("NowBarSide__Left") ? "left" : "right", volumePlacement: $showVolumeSliderFullscreen.get(),
      page: pageBounds, artwork: rect(page?.querySelector(".MediaBox")), volumeSlider: volumeBounds,
      lyricsColumn: rect(page?.querySelector(".LyricsContainer")),
      canvasStage: !!classes?.contains("CanvasImmersive"), queueOpen: !!classes?.contains("QueueOpen"),
    },
    playback: { playing: read(() => Spicetify.Player.isPlaying(), false), positionMs: read(() => SpotifyPlayer.GetPosition(), null), durationMs: read(() => SpotifyPlayer.GetDuration(), null), contentType: read(() => SpotifyPlayer.GetContentType(), "unknown"), volumePercent: read(() => Math.round(Spicetify.Player.getVolume()*100), null), globalOffsetMs: $playbackOffset.get(), songOffsetMs: uri ? $songPlaybackOffsets.get()[uri] ?? 0 : 0 },
    lyrics: lyrics ? { type: lyrics.Type, source: String(lyrics.sourceDisplayName ?? lyrics.fetchProvider ?? lyrics.source ?? "unknown"), answeredFrom: read(() => GetLyricsAnsweredFrom(uri ?? undefined), null), cache: !!lyrics.fromCache, local: !!lyrics.fromLocal, lines: vocals.length, syllables: words.length, backingGroups: vocals.reduce((sum: number,row: any) => sum + (row.Background?.length ?? 0),0), romanizationAvailable: !!lyrics.HasTransliterations, translationsAvailable: !!lyrics.HasTranslations } : { state: "No displayed lyrics" },
    rendering: { renderer: $rendererVisualStyle.get(), lyricsSizePercent: $lyricsSize.get(), wheelZoom: $ctrlWheelLyricsZoom.get(), rendererPaused: $lyricsRendererPaused.get(), fetching: $currentlyFetching.get(), fontsReady: doc.fonts?.status ?? "unknown", mountedLines: page?.querySelectorAll(".LyricsContent .line").length ?? 0, mountedWords: page?.querySelectorAll(".LyricsContent .word").length ?? 0, activeAnimations: read(() => doc.getAnimations().length, 0), reviewer: $ttmlReviewer.get() },
    network: { enabledSources: read(() => getActiveLyricsSourceOrder(), []), lastFailure: failure ? { stage: failure.source, detail: failure.detail } : null, circuitBreakerOpen: read(() => IsBreakerOpen(), false), retryAfterMs: read(() => RetryAfterMs(), 0) },
    settings, experiments, errors: diagnosticErrors(), findings: findings.length ? findings : ["No issues detected by the automatic checks"],
  }) as DiagnosticData;
}
export function buildDiagnosticReport(doc: Document = document) { return JSON.stringify(buildDiagnosticData(doc), null, 2); }
export function openDiagnostics(doc:Document=document){
  const t=(s:string)=>translateUi(s,$uiLanguage.get());const previous=doc.activeElement as HTMLElement|null;
  const root=doc.createElement('dialog');root.className='vv-review-dialog vv-diagnostics';root.setAttribute('data-i18n-ignore','');
  const mark=doc.createElement('img');mark.className='vv-diagnostics-mark';mark.alt='';mark.setAttribute('aria-hidden','true');mark.src=`data:image/svg+xml,${encodeURIComponent(Icons.LyricsPage.replace(/id="[^"]*"/g,""))}`;
  const header=doc.createElement('header');header.className='vv-diagnostics-header';
  const brand=doc.createElement('span');brand.className='vv-diagnostics-brand';brand.textContent='Spicy Lyrics';
  const heading=doc.createElement('h2');heading.id='vv-diagnostics-title';heading.textContent=t('Diagnostic report');root.setAttribute('aria-labelledby',heading.id);
  const text=doc.createElement('p');text.textContent=t('Review or edit the report before copying. Lyrics, account details and tokens are not included. Nothing is sent automatically.');
  const meta=doc.createElement('div');meta.className='vv-diagnostics-meta';
  for(const label of [`v${ProjectVersion}`,$buildChannel.get()]){const badge=doc.createElement('span');badge.textContent=label;meta.append(badge);}
  header.append(brand,heading,text,meta);
  const editor=doc.createElement('section');editor.className='vv-diagnostics-editor';
  const editorLabel=doc.createElement('div');editorLabel.className='vv-diagnostics-editor-label';
  const label=doc.createElement('label');label.htmlFor='vv-diagnostics-report';label.textContent=t('Report contents');const formats=doc.createElement("div");formats.className="vv-diagnostics-formats";editorLabel.append(label,formats);
  const preview=doc.createElement('textarea');preview.id=label.htmlFor;const report=buildDiagnosticData(doc); const drafts={readable:formatDiagnosticText(report),json:JSON.stringify(report,null,2)}; let selected:"readable"|"json"="readable"; preview.value=drafts.readable;preview.setAttribute('aria-label',t('Diagnostic report'));preview.spellcheck=false;preview.wrap='soft';editor.append(editorLabel,preview);
  const formatButtons: HTMLButtonElement[] = [];
  for (const [id,title] of [["readable","Readable report"],["json","JSON"]] as const) {
    const button=doc.createElement("button"); button.type="button"; button.textContent=t(title); button.setAttribute("aria-pressed",String(id===selected));
    button.onclick=()=>{ drafts[selected]=preview.value; selected=id; preview.value=drafts[id]; preview.scrollTop=0; formatButtons.forEach(control=>control.setAttribute("aria-pressed",String(control===button))); };
    formats.append(button); formatButtons.push(button);
  }

  const footer=doc.createElement('footer');footer.className='vv-diagnostics-footer';
  const actions=doc.createElement('div');actions.className='vv-review-actions';const status=doc.createElement('p');status.className='vv-diagnostics-status';status.role='status';
  const copy=doc.createElement('button');copy.type='button';copy.className='vv-diagnostics-copy';copy.textContent=t('Copy report');copy.onclick=()=>{void doc.defaultView!.navigator.clipboard.writeText(preview.value).then(()=>{status.textContent=t('Report copied');status.dataset.error='false';}).catch(()=>{status.textContent=t('Clipboard unavailable.');status.dataset.error='true';});};
  const close=doc.createElement('button');close.type='button';close.textContent=t('Close');close.onclick=()=>root.close();
  const dismiss=doc.createElement('button');dismiss.type='button';dismiss.className='vv-diagnostics-close';dismiss.textContent='×';dismiss.setAttribute('aria-label',t('Close'));dismiss.onclick=()=>root.close();
  actions.append(close,copy);footer.append(status,actions);root.append(mark,header,editor,footer,dismiss);root.addEventListener('close',()=>{root.remove();previous?.focus();},{once:true});doc.body.append(root);root.showModal();dismiss.focus();preview.scrollTop=0;

}

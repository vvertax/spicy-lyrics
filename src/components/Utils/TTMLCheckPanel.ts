import { inspectTTML, type TTMLIssue } from "./TTMLCheck.ts";
import { ParseTTML } from "../../utils/Lyrics/manager/parseTTML.ts";
import { renderComparisonLyrics } from "./ComparisonRenderer.ts";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { localizeDocument } from "../../utils/i18n/runtime.ts";

export function openTTMLCheck(doc: Document = document) {
  const existing = doc.querySelector<HTMLDialogElement>(".vv-ttml-check");
  if (existing) { existing.focus(); return; }
  localizeDocument(doc);
  const previous = doc.activeElement as HTMLElement | null;
  const dialog = doc.createElement("dialog"); dialog.className = "vv-ttml-check";
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, value = "") => { const node = doc.createElement(tag); node.textContent = value; return node; };
  const header = make("header"), title = make("h2", "Check TTML"), pick = make("button", "Choose TTML"), close = make("button", "Close");
  for (const button of [pick, close]) button.type = "button";
  header.append(title, pick, close);
  const input = make("input"); input.type = "file"; input.accept = ".ttml"; input.hidden = true;
  pick.onclick = () => { input.value = ""; input.click(); }; close.onclick = () => dialog.close();
  const fileName = make("p"); fileName.className = "vv-check-file"; fileName.dataset.i18nIgnore = "";
  const status = make("p", "Choose a TTML file to inspect. Nothing is saved or applied to the song."); status.role = "status";
  const body = make("div"); body.className = "vv-check-body";
  const findings = make("section"), preview = make("section"); findings.className = "vv-check-findings"; preview.className = "vv-check-preview LyricsContent";
  findings.setAttribute("aria-label", "TTML findings"); preview.setAttribute("aria-label", "TTML preview");
  const excerpt = make("p"); excerpt.className = "vv-check-excerpt"; excerpt.dataset.i18nIgnore = "";
  const controls = make("footer"), seek = make("button", "Seek in Spotify"), position = make("input"), clock = make("output");
  seek.type = "button"; seek.disabled = true;
  position.type = "range"; position.min = "0"; position.max = "0"; position.step = "10"; position.value = "0"; position.disabled = true;
  position.setAttribute("aria-label", "Preview position"); controls.append(position, clock, seek);
  body.append(findings, preview); dialog.append(header, input, fileName, status, body, excerpt, controls);
  let session: ReturnType<typeof renderComparisonLyrics> | undefined, unsubscribe: (() => void) | undefined;
  let generation = 0, ended = false, trackUri: string | undefined, previewTime = 0;
  const timeLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const setPosition = (ms: number) => {
    previewTime = Math.max(0, Math.min(Number(position.max), ms)); position.value = String(previewTime);
    clock.value = timeLabel(previewTime); session?.animate(previewTime);
  };
  position.oninput = () => setPosition(Number(position.value));
  seek.onclick = () => { if (trackUri && SpotifyPlayer.GetUri() === trackUri) SpotifyPlayer.Seek(previewTime); };
  const selectIssue = (issue: TTMLIssue, lines: { text: string }[]) => {
    setPosition(issue.time * 1000); excerpt.textContent = lines[issue.line]?.text ?? "";
    preview.querySelectorAll(".vv-check-selected").forEach(node => node.classList.remove("vv-check-selected"));
    const row = session?.rows.find(line => line.start <= previewTime && line.end >= previewTime);
    row?.element.classList.add("vv-check-selected");
    (row ?? session?.rows.find(line => line.start >= previewTime))?.element.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    const token = ++generation; trackUri = SpotifyPlayer.GetUri();
    session?.destroy(); session = undefined; unsubscribe?.(); unsubscribe = undefined;
    findings.replaceChildren(); preview.replaceChildren(); excerpt.textContent = ""; position.disabled = true; seek.disabled = true;
    position.value = position.max = "0"; clock.value = "0:00"; previewTime = 0;
    fileName.textContent = file.name;
    if (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".ttml")) { status.textContent = "Choose a TTML file smaller than 5 MB."; return; }
    status.textContent = "Checking TTML…";
    try {
      const text = await file.text();
      if (ended || token !== generation) return;
      const report = inspectTTML(text);
      status.textContent = report.issues.length ? "Findings below are suggestions. Instrumental gaps can be intentional." : "No issues found by these checks.";
      const count = make("p"); count.className = "vv-check-count";
      count.append(make("span", "Lyric lines"), `: ${report.lines.length} · `, make("span", "Findings"), `: ${report.issues.length}`);
      count.setAttribute("aria-label", "Lyric lines and findings"); findings.append(count);
      for (const issue of report.issues.slice(0, 300)) {
        const button = make("button"); button.type = "button"; button.className = `vv-check-issue vv-check-${issue.severity}`;
        const location = make("span", `${issue.line + 1} · ${timeLabel(issue.time * 1000)}`); location.dataset.i18nIgnore = "";
        button.append(location, make("strong", issue.code)); button.onclick = () => selectIssue(issue, report.lines); findings.append(button);
      }
      if (report.issues.length > 300) findings.append(make("p", "Showing the first 300 findings."));
      const parsed = await ParseTTML(text);
      if (ended || token !== generation) return;
      if (parsed?.Result?.Content?.length && parsed.Result.Type !== "Static") {
        session = renderComparisonLyrics(preview, parsed.Result, (_index, start) => setPosition(start));
        position.max = String(session.rows.reduce((end, row) => Math.max(end, row.end), 0)); position.disabled = false;
        setPosition(report.issues[0]?.time ? report.issues[0].time * 1000 : 0);
        if (report.issues[0]) selectIssue(report.issues[0], report.lines);
        // Keep the production springs settling even when preview time is held still.
        unsubscribe = onAnimationFrame(() => { session?.animate(previewTime); seek.disabled = !trackUri || SpotifyPlayer.GetUri() !== trackUri; }, doc.defaultView ?? window);
      } else preview.append(make("p", "No synced preview available. Findings still refer to the original file."));
    } catch (error) { if (!ended && token === generation) status.textContent = error instanceof Error && ["Invalid TTML XML", "TTML has no body", "No lyric paragraphs in TTML"].includes(error.message) ? error.message : "Could not inspect this TTML file."; }
  };
  dialog.addEventListener("close", () => { ended = true; generation++; unsubscribe?.(); session?.destroy(); dialog.remove(); previous?.isConnected && previous.focus(); }, { once: true });
  doc.body.append(dialog); dialog.showModal();
}

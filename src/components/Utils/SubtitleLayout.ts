import { $subtitleLayout, $uiLanguage, type SubtitleLayout } from "../../utils/stores.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { Icons } from "../Styling/Icons.ts";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function normalizedSubtitleLayout(value: any): SubtitleLayout {
  const finite = (n: unknown, fallback: number) => typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return { anchor: ["player", "top", "corner", "free"].includes(value?.anchor) ? value.anchor : "player",
    width: clamp(finite(value?.width, 780), 320, 1200), x: clamp(finite(value?.x, .5), 0, 1), y: clamp(finite(value?.y, .5), 0, 1) };
}
export function bindSubtitleLayout(bar: HTMLElement, handle: HTMLElement, close: HTMLButtonElement) {
  const doc = bar.ownerDocument, win = doc.defaultView!;
  const t = (text: string) => translateUi(text, $uiLanguage.get());
  const actions = doc.createElement("div"); actions.className = "sl-subtitle-actions";
  const gear = doc.createElement("button"); gear.type = "button"; gear.className = "sl-subtitle-close"; gear.innerHTML = Icons.Settings;
  gear.setAttribute("aria-label", t("Subtitle layout")); gear.title = t("Subtitle layout");
  close.before(actions); actions.append(gear, close);
  const panel = doc.createElement("div"); panel.className = "sl-subtitle-layout"; panel.hidden = true;
  panel.setAttribute("role", "region"); panel.setAttribute("aria-label", t("Subtitle layout"));
  const heading = doc.createElement("div"); heading.className = "sl-subtitle-layout-heading";
  const title = doc.createElement("strong"); title.textContent = t("Subtitle layout"); heading.append(title);
  const presets = doc.createElement("div"); presets.className = "sl-subtitle-presets"; presets.setAttribute("role", "group"); presets.setAttribute("aria-label", t("Position"));
  const save = (patch: Partial<SubtitleLayout>) => $subtitleLayout.set({ ...normalizedSubtitleLayout($subtitleLayout.get()), ...patch });
  const presetButtons = new Map<string, HTMLButtonElement>();
  const frame = '<rect x="3" y="3" width="18" height="18" rx="4"/>';
  for (const [value, label, drawing] of [
    ["player", "Above player", frame + '<path d="M7 17h10M8 12h8"/>'],
    ["top", "Top", frame + '<path d="M7 7h10M8 11h8"/>'],
    ["corner", "Corner", frame + '<path d="M12 7h5v5"/>'],
    ["free", "Custom position", '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'],
  ]) {
    const button = doc.createElement("button"); button.type = "button";
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing}</svg>`;
    const labelNode = doc.createElement("span"); labelNode.textContent = t(label); button.append(labelNode);
    button.onclick = () => save({ anchor: value as SubtitleLayout["anchor"] });
    presets.append(button); presetButtons.set(value, button);
  }
  const sizing = doc.createElement("label"); sizing.className = "sl-subtitle-sizing";
  const sizeLabel = doc.createElement("span"); sizeLabel.textContent = t("Subtitle width");
  const output = doc.createElement("output"); output.setAttribute("data-i18n-ignore", "");
  const range = doc.createElement("input"); range.type = "range"; range.min = "320"; range.max = "1200"; range.step = "10";
  range.setAttribute("aria-label", t("Subtitle width"));
  range.oninput = () => save({ width: Number(range.value) }); sizing.append(sizeLabel, output, range);
  const reset = doc.createElement("button"); reset.type = "button"; reset.className = "sl-subtitle-layout-reset";
  reset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg>';
  const resetLabel = doc.createElement("span"); resetLabel.textContent = t("Reset layout"); reset.append(resetLabel);
  reset.onclick = () => $subtitleLayout.set({ anchor: "player", width: 780, x: .5, y: .5 });
  const hint = doc.createElement("p"); hint.className = "sl-subtitle-layout-hint"; hint.textContent = t("Drag the artwork to move subtitles.");
  const footer = doc.createElement("div"); footer.className = "sl-subtitle-layout-footer"; footer.append(hint, reset);
  panel.append(heading, presets, sizing, footer); bar.append(panel);
  gear.setAttribute("aria-expanded", "false");
  gear.onclick = () => {
    panel.hidden = !panel.hidden; gear.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden && !win.matchMedia("(prefers-reduced-motion: reduce)").matches)
      panel.animate([{ opacity: 0, transform: "translateY(-5px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
  };
  const grip = doc.createElement("button"); grip.type = "button"; grip.className = "sl-subtitle-resize";
  grip.textContent = "↔"; grip.setAttribute("aria-label", t("Resize subtitles")); bar.append(grip);
  handle.title = t("Drag subtitles"); handle.tabIndex = 0; handle.role = "button"; handle.setAttribute("aria-label", t("Drag subtitles")); handle.style.touchAction = grip.style.touchAction = "none";
  handle.ondragstart = e => e.preventDefault();
  let drag: { id: number; node: HTMLElement; resize: boolean; x: number; y: number; left: number; top: number; width: number } | undefined;
  const down = (e: PointerEvent, resize: boolean) => {
    if (e.button !== 0) return; e.preventDefault(); const rect = bar.getBoundingClientRect();
    const node = resize ? grip : handle; node.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, node, resize, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, width: rect.width };
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.resize) save({ width: clamp(drag.width + e.clientX - drag.x, 320, 1200) });
    else save({ anchor: "free", x: clamp((drag.left + e.clientX - drag.x - 12) / Math.max(1, win.innerWidth - bar.offsetWidth - 24), 0, 1),
      y: clamp((drag.top + e.clientY - drag.y - 12) / Math.max(1, win.innerHeight - bar.offsetHeight - 24), 0, 1) });
  };
  const up = () => { drag = undefined; };
  handle.onpointerdown = e => down(e, false); grip.onpointerdown = e => down(e, true);
  for (const node of [handle, grip]) { node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up); node.addEventListener("lostpointercapture", up); }
  handle.onkeydown = e => { if (!e.key.startsWith("Arrow")) return; e.preventDefault(); const rect = bar.getBoundingClientRect(); save({ anchor: "free", x: clamp((rect.left - 12 + (e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0)) / Math.max(1, win.innerWidth - bar.offsetWidth - 24), 0, 1), y: clamp((rect.top - 12 + (e.key === "ArrowDown" ? 20 : e.key === "ArrowUp" ? -20 : 0)) / Math.max(1, win.innerHeight - bar.offsetHeight - 24), 0, 1) }); };
  grip.onkeydown = e => { if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return; e.preventDefault(); save({ width: clamp(normalizedSubtitleLayout($subtitleLayout.get()).width + (e.key === "ArrowRight" ? 20 : -20), 320, 1200) }); };
  const position = () => {
    const value = normalizedSubtitleLayout($subtitleLayout.get());
    bar.style.width = `${Math.min(value.width, Math.max(0, win.innerWidth - 24))}px`;
    const width = bar.offsetWidth, height = bar.offsetHeight;
    const player = doc.querySelector(".Root__now-playing-bar, .main-nowPlayingBar-nowPlayingBar");
    let x = (win.innerWidth - width) / 2, y = (player?.getBoundingClientRect().top ?? win.innerHeight) - height - 10;
    if (value.anchor === "top") y = 16;
    if (value.anchor === "corner") { y = 16; x = win.innerWidth - width - 16; }
    if (value.anchor === "free") { x = 12 + value.x * Math.max(0, win.innerWidth - width - 24); y = 12 + value.y * Math.max(0, win.innerHeight - height - 24); }
    bar.style.translate = "none"; bar.style.bottom = "auto";
    bar.style.left = `${clamp(x, 12, Math.max(12, win.innerWidth - width - 12))}px`; bar.style.top = `${clamp(y, 12, Math.max(12, win.innerHeight - height - 12))}px`;
    presetButtons.forEach((button, anchor) => { const pressed = String(anchor === value.anchor); if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed); });
    range.value = String(value.width); const sizeText = `${Math.round(value.width)} px`; if (output.textContent !== sizeText) output.textContent = sizeText;
    range.style.setProperty("--subtitle-range-progress", `${(value.width - 320) / 880 * 100}%`);
  };
  const unsubscribe = $subtitleLayout.subscribe(position);
  return { position, destroy() { unsubscribe(); panel.remove(); grip.remove(); } };
}

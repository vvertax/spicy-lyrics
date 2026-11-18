import type { QuoteTemplate } from "./QuoteCardRenderer.ts";
import { defaultVideoLayout, resolveVideoLayout, VIDEO_QUOTE_FRAMES, type QuoteLayoutOffsets, type QuoteRegion, type VideoQuoteFormat } from "./QuoteVideoLayout.ts";

export function createQuoteVideoLayoutEditor(doc: Document, redraw: () => void) {
  const view = doc.defaultView!;
  const options = doc.createElement("fieldset");
  options.className = "vv-quote-layout-options";
  const label = doc.createElement("label");
  label.textContent = "Video aspect ratio";
  const format = doc.createElement("select");
  for (const ratio of Object.keys(VIDEO_QUOTE_FRAMES)) {
    const option = doc.createElement("option");
    option.value = option.textContent = ratio;
    format.append(option);
  }
  label.append(format);
  const toggle = doc.createElement("button");
  toggle.type = "button";
  const reset = doc.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset composition layout";
  const safeLabel = doc.createElement("label");
  const safe = doc.createElement("input");
  safe.type = "checkbox";
  const safeText = doc.createElement("span");
  safeText.textContent = "Safe zones";
  safeLabel.title = "Approximate areas covered by Stories or Shorts controls.";
  safeLabel.append(safe, safeText);
  options.append(label, toggle, reset, safeLabel);

  const frame = doc.createElement("div");
  frame.className = "vv-quote-frame";
  const overlay = doc.createElement("div");
  overlay.className = "vv-quote-layout-overlay";
  const guide = doc.createElement("div");
  guide.className = "vv-quote-safe-zones";
  guide.setAttribute("aria-hidden", "true");
  overlay.append(guide);
  const handles = new Map<QuoteRegion, HTMLButtonElement>();
  const regions = { cover: "Cover", title: "Title and artist", lyrics: "Lyrics area" };
  const offsets = new Map<string, QuoteLayoutOffsets>();
  let editing = false;
  let active = false;
  let hasCover = false;
  let composition: QuoteTemplate = "cover-top";
  let pendingFrame = 0;
  const ratio = () => format.value as VideoQuoteFormat;
  const key = () => ratio() + "/" + composition;
  const base = () => defaultVideoLayout(ratio(), composition, hasCover);
  const layout = () => resolveVideoLayout(ratio(), base(), offsets.get(key()) ?? {});

  function queueRedraw() {
    if (pendingFrame) return;
    pendingFrame = view.requestAnimationFrame(() => { pendingFrame = 0; redraw(); });
  }
  function shift(region: QuoteRegion, delta: { x: number; y: number }) {
    const original = base();
    const next = { ...offsets.get(key()), [region]: delta };
    const selected = resolveVideoLayout(ratio(), original, next)[region];
    next[region] = { x: selected.x - original[region].x, y: selected.y - original[region].y };
    offsets.set(key(), next);
    syncOverlay();
    queueRedraw();
  }
  for (const [regionName, text] of Object.entries(regions)) {
    const region = regionName as QuoteRegion;
    const handle = doc.createElement("button");
    handle.type = "button";
    handle.dataset.region = region;
    const caption = doc.createElement("span");
    caption.textContent = text;
    handle.append(caption);
    let drag: { id: number; x: number; y: number; offset: { x: number; y: number }; key: string } | null = null;
    const offset = () => offsets.get(key())?.[region] ?? { x: 0, y: 0 };
    handle.onpointerdown = event => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: offset(), key: key() };
    };
    handle.onpointermove = event => {
      if (!drag || drag.id !== event.pointerId || drag.key !== key()) return;
      const rect = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { width, height } = VIDEO_QUOTE_FRAMES[ratio()];
      shift(region, {
        x: Math.round(drag.offset.x + (event.clientX - drag.x) * width / rect.width),
        y: Math.round(drag.offset.y + (event.clientY - drag.y) * height / rect.height),
      });
    };
    handle.onpointerup = event => { if (drag?.id === event.pointerId) drag = null; };
    const cancel = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      if (drag.key === key()) shift(region, drag.offset);
      drag = null;
    };
    handle.onpointercancel = handle.onlostpointercapture = cancel;
    handle.onkeydown = event => {
      const step = event.shiftKey ? 24 : 8;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (!dx && !dy) return;
      event.preventDefault(); event.stopPropagation();
      const current = offset();
      shift(region, { x: current.x + dx, y: current.y + dy });
    };
    overlay.append(handle);
    handles.set(region, handle);
  }
  frame.append(overlay);

  function syncOverlay() {
    const { width, height } = VIDEO_QUOTE_FRAMES[ratio()];
    const positions = layout();
    guide.hidden = !active || ratio() !== "9:16" || !safe.checked;
    for (const [region, handle] of handles) {
      const box = positions[region];
      handle.hidden = !active || !editing || (region === "cover" && !hasCover);
      handle.style.left = box.x * 100 / width + "%";
      handle.style.top = box.y * 100 / height + "%";
      handle.style.width = box.width * 100 / width + "%";
      handle.style.height = box.height * 100 / height + "%";
    }
    frame.classList.toggle("vv-quote-frame--video", active);
    frame.style.setProperty("--quote-frame-ratio", String(width / height));
    toggle.setAttribute("aria-pressed", String(editing));
    toggle.textContent = editing ? "Finish layout editing" : "Edit composition layout";
    reset.hidden = !editing;
    safeLabel.hidden = ratio() !== "9:16";
  }
  format.onchange = redraw;
  toggle.onclick = () => { editing = !editing; syncOverlay(); };
  reset.onclick = () => { offsets.delete(key()); redraw(); };
  safe.onchange = syncOverlay;
  return {
    options, frame, overlay, ratio, layout,
    configure(video: boolean, template: QuoteTemplate, art: boolean) {
      active = video; composition = template; hasCover = art;
      options.hidden = !video;
      syncOverlay();
    },
    destroy() { view.cancelAnimationFrame(pendingFrame); },
  };
}

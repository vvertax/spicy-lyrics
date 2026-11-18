import React, { useEffect, useId, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import { DEFAULT_CUSTOM_COLOR, normalizePaletteHex, paletteHexToHsv, paletteHsvToHex, type HSV } from "../../../utils/CustomPalette.ts";
import { translateUi } from "../../../utils/i18n/translate.ts";
import { $uiLanguage, $vvertaxYouCustomColor } from "../../../utils/stores.ts";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function CustomPaletteColor() {
  const color = normalizePaletteHex(useStore($vvertaxYouCustomColor)) ?? DEFAULT_CUSTOM_COLOR;
  const language = useStore($uiLanguage);
  const t = (text: string) => translateUi(text, language);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color.slice(1));
  const [hsv, setHsv] = useState(() => paletteHexToHsv(color));
  const applied = useRef(color);
  const trigger = useRef<HTMLButtonElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const capturedPointer = useRef<number | null>(null);
  const regionId = useId();

  useEffect(() => {
    if (color === applied.current) return;
    applied.current = color;
    setHex(color.slice(1));
    setHsv(previous => paletteHexToHsv(color, previous.hue));
  }, [color]);
  useEffect(() => {
    if (open) plane.current?.focus({ preventScroll: true });
  }, [open]);

  const save = (valid: string) => {
    applied.current = valid;
    $vvertaxYouCustomColor.set(valid);
  };
  const updateColor = (value: HSV) => {
    setHsv(value);
    const valid = paletteHsvToHex(value);
    setHex(valid.slice(1));
    save(valid);
  };
  const editHex = (value: string) => {
    const trimmed = value.trim().replace(/^#/, "").toUpperCase();
    const valid = normalizePaletteHex(trimmed);
    setHex(trimmed);
    if (valid) {
      setHsv(previous => paletteHexToHsv(valid, previous.hue));
      save(valid);
    }
  };
  const pickAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    updateColor({ hue: hsv.hue, saturation: clamp((event.clientX - rect.left) / rect.width), value: clamp(1 - (event.clientY - rect.top) / rect.height) });
  };
  const copy = (event: React.MouseEvent<HTMLButtonElement>) => {
    const clipboard = event.currentTarget.ownerDocument.defaultView?.navigator.clipboard;
    if (!clipboard) { toast.error(t("Could not copy HEX")); return; }
    void clipboard.writeText(color).then(() => toast.success(t("HEX copied")), () => toast.error(t("Could not copy HEX")));
  };
  const invalid = !normalizePaletteHex(hex);
  return <div className="sl-sp-custom-palette" style={{ "--palette-picked": color } as React.CSSProperties}
    onKeyDown={event => {
      if (!open || event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      setOpen(false); trigger.current?.focus();
    }}>
    <div className="sl-sp-color-field">
      <button ref={trigger} type="button" className="sl-sp-color-swatch" aria-label={t("Open color picker")}
        aria-controls={regionId} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true" />
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <label className="sl-sp-hex-field">
        <span aria-hidden="true">#</span>
        <input type="text" aria-label={t("HEX color")} aria-invalid={invalid} autoComplete="off" spellCheck={false}
          value={hex} onChange={event => editHex(event.target.value)} />
      </label>
      <button type="button" className="sl-sp-copy-color" aria-label={t("Copy HEX")} title={t("Copy HEX")} onClick={copy}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M13 5V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v7a1 1 0 0 0 1 1h1" />
        </svg>
      </button>
    </div>
    {invalid && <small role="status">Enter a six-digit HEX color.</small>}
    <div id={regionId} className="sl-sp-palette-picker" hidden={!open}
      style={{ "--palette-hue": `hsl(${hsv.hue}deg 100% 50%)` } as React.CSSProperties}>
      <div className="sl-sp-palette-plane" ref={plane} role="group" tabIndex={0} aria-label={t("Saturation and brightness")}
        onPointerDown={event => {
          if (event.button !== 0 || capturedPointer.current !== null) return;
          capturedPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus({ preventScroll: true });
          pickAt(event);
        }}
        onPointerMove={event => { if (capturedPointer.current === event.pointerId) pickAt(event); }}
        onPointerUp={event => { if (capturedPointer.current === event.pointerId) pickAt(event); }}
        onLostPointerCapture={event => { if (capturedPointer.current === event.pointerId) capturedPointer.current = null; }}
        onKeyDown={event => {
          const step = event.shiftKey ? .1 : .02;
          const deltaX = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
          const deltaY = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
          if (!deltaX && !deltaY) return;
          event.preventDefault(); event.stopPropagation();
          updateColor({ hue: hsv.hue, saturation: clamp(hsv.saturation + deltaX), value: clamp(hsv.value + deltaY) });
        }}>
        <span aria-hidden="true" style={{ left: hsv.saturation * 100 + "%", top: (1 - hsv.value) * 100 + "%" }} />
      </div>
      <input className="sl-sp-palette-hue" type="range" min="0" max="359" step="1" value={Math.min(359, Math.round(hsv.hue))}
        aria-label={t("Hue")} onChange={event => updateColor({ ...hsv, hue: event.target.valueAsNumber })} />
    </div>
  </div>;
}

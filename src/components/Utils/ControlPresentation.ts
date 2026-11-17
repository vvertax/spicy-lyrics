/** Convert renderer toggle decoration into one ordinary menu icon and an accessible state. */
export function prepareMenuButton(button: HTMLButtonElement): string | null {
  const pressed = button.getAttribute("aria-pressed");
  button.querySelectorAll(":scope > svg.SL_KnockoutDisc").forEach(icon => icon.remove());
  button.querySelectorAll("svg.SL_IconSwapIn").forEach(icon => icon.classList.remove("SL_IconSwapIn"));
  button.removeAttribute("aria-pressed");
  if (pressed !== null) button.setAttribute("aria-checked", pressed);
  return pressed;
}

export function controlMenuPlacement(anchor: { left: number; right: number; top: number; bottom: number }, width: number, height: number, viewport: { width: number; height: number }) {
  const gap = 10, inset = 12;
  const below = Math.max(0, viewport.height - anchor.bottom - gap - inset);
  const above = Math.max(0, anchor.top - gap - inset);
  const opensAbove = below < height && above > below;
  const maxHeight = Math.max(1, Math.min(viewport.height - inset * 2, opensAbove ? above : below));
  const usedHeight = Math.min(height, maxHeight);
  return {
    left: Math.max(inset, Math.min(anchor.right - width, viewport.width - width - inset)),
    top: Math.max(inset, Math.min(opensAbove ? anchor.top - gap - usedHeight : anchor.bottom + gap, viewport.height - usedHeight - inset)),
    maxHeight, opensAbove,
  };
}

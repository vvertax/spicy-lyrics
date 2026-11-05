/** Owns panel visibility without interrupting lyric-word transforms. */
export function createSubtitlePresence(panel: HTMLElement, text: HTMLElement, onHidden: () => void) {
  let wanted = false, revision = 0;
  let animations: Animation[] = [];
  let pending: Promise<void> = Promise.resolve();
  let settle: (() => void) | undefined;
  const cancel = () => {
    animations.forEach(animation => animation.cancel()); animations = [];
    settle?.(); settle = undefined;
  };
  const setVisible = (visible: boolean) => {
    if (wanted === visible) return pending;
    wanted = visible;
    const token = ++revision;
    const wasHidden = panel.hidden;
    const view = panel.ownerDocument.defaultView!;
    const opacity = wasHidden ? "0" : view.getComputedStyle(panel).opacity;
    const transform = wasHidden ? "translateY(12px) scale(.985)" : view.getComputedStyle(panel).transform;
    const textOpacity = wasHidden ? "0" : view.getComputedStyle(text).opacity;
    cancel(); panel.hidden = false; panel.inert = !visible;
    const finish = () => {
      if (token !== revision) return;
      if (!visible) { panel.hidden = true; onHidden(); }
      cancel();
    };
    if (view.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish(); pending = Promise.resolve(); return pending;
    }
    pending = new Promise<void>(resolve => { settle = resolve; });
    const panelAnimation = panel.animate([
      { opacity, transform },
      { opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(10px) scale(.985)" },
    ], { duration: visible ? 360 : 280, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    const textAnimation = text.animate([
      { opacity: textOpacity }, { opacity: visible ? 1 : 0 },
    ], { duration: visible ? 320 : 180, easing: "ease-out", fill: "both" });
    animations = [panelAnimation, textAnimation];
    panelAnimation.onfinish = finish;
    return pending;
  };
  return { show: () => setVisible(true), hide: () => setVisible(false),
    get visible() { return wanted; },
    destroy() { revision++; wanted = false; cancel(); panel.hidden = true; onHidden(); },
  };
}

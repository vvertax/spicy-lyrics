// Compatibility exports for existing credit callers. Profiles no longer use iframes.
import { createAuthorCard, knownAuthor } from "../../Utils/AuthorProfile.ts";
import { translateUi } from "../../../utils/i18n/translate.ts";
import { $uiLanguage } from "../../../utils/stores.ts";
export interface ProfileIdentity { username: string; displayName?: string }
export function resolveProfileIdentity(userId: string): Promise<ProfileIdentity | null> {
  return Promise.resolve(knownAuthor(userId, true) ?? null);
}
export function resolveProfileUsername(userId: string): Promise<string | null> {
  return resolveProfileIdentity(userId).then(profile => profile?.username ?? null);
}
type ProfileState = "loading" | "ready" | "failed" | "closed";
interface ProfileOptions { signal: AbortSignal; onState: (state: ProfileState) => void }
let active: { userId: string; close: () => void } | undefined;
export function closeIframeProfileModal(userId?: string) {
  if (!userId || active?.userId === userId) active?.close();
}
export function showIframeProfileModal(userId: string, doc: Document, options: ProfileOptions) {
  if (options.signal.aborted) return;
  closeIframeProfileModal();
  const person = knownAuthor(userId, true);
  if (!person) { options.onState("failed"); return; }
  const win = doc.defaultView!, previous = doc.activeElement as HTMLElement | null;
  const overlay = doc.createElement("div"); overlay.className = "vv-author-overlay";
  const dialog = doc.createElement("div"); dialog.className = "sl-profile-dialog vv-author-profile"; dialog.role = "dialog"; dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", translateUi("TTML profile", $uiLanguage.get()));
  const closeButton = doc.createElement("button"); closeButton.type = "button"; closeButton.className = "vv-author-close"; closeButton.textContent = "×"; closeButton.setAttribute("aria-label", translateUi("Close profile", $uiLanguage.get()));
  let closed = false;
  const close = () => { if (closed) return; closed = true; win.removeEventListener("keydown", keys, true); overlay.remove(); if (active?.close === close) active = undefined; if (previous?.isConnected) previous.focus(); options.onState("closed"); };
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.key === "Tab") { const buttons = [closeButton, ...Array.from(dialog.querySelectorAll<HTMLAnchorElement>("a"))]; const index = buttons.indexOf(doc.activeElement as HTMLButtonElement); e.preventDefault(); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); }
  };
  closeButton.onclick = close; overlay.onclick = e => { if (e.target === overlay) close(); };
  dialog.append(closeButton, createAuthorCard(doc, person)); overlay.append(dialog); doc.body.append(overlay);
  active = { userId, close }; win.addEventListener("keydown", keys, true); closeButton.focus(); options.onState("ready");
}

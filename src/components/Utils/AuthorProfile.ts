import { authorHandle } from "./ReviewModel.ts";
import { translateUi } from "../../utils/i18n/translate.ts";
import { $uiLanguage } from "../../utils/stores.ts";
export type AuthorProfile = { id?: string; username: string; displayName?: string; avatar?: string };
const people = new Map<string, AuthorProfile>();
export function rememberAuthor(profile: AuthorProfile) {
  const name = authorHandle(profile.username); if (!name) return;
  const person = { ...profile, username: name };
  if (person.id) people.set(`id:${person.id}`, person);
  people.set(`name:${name.toLowerCase()}`, person);
  while (people.size > 200) people.delete(people.keys().next().value!);
}
export function knownAuthor(value: string, byId = false) {
  return people.get(byId ? `id:${value}` : `name:${value.toLowerCase()}`);
}
export function authorProfileUrl(person: AuthorProfile) {
  if (person.id && /^\d+$/.test(person.id)) return `https://spicylyrics.org/uid/${encodeURIComponent(person.id)}`;
  const name = authorHandle(person.username);
  if (!name) throw new Error("Invalid author username");
  return `https://spicylyrics.org/${encodeURIComponent(name)}`;
}
export function createAuthorCard(doc: Document, person: AuthorProfile) {
  const t = (text: string) => translateUi(text, $uiLanguage.get());
  const card = doc.createElement("section"); card.className = "vv-author-card";
  const avatar = doc.createElement("div"); avatar.className = "vv-author-avatar"; avatar.textContent = (person.displayName || person.username).slice(0, 1).toUpperCase(); avatar.setAttribute("aria-hidden", "true");
  if (person.avatar) {
    try { const url = new URL(person.avatar); if (url.protocol === "https:") {
      const image = doc.createElement("img"); image.alt = ""; image.referrerPolicy = "no-referrer"; image.src = url.href; image.onerror = () => image.remove(); avatar.append(image);
    } } catch { /* Keep the monogram for malformed metadata. */ }
  }
  const identity = doc.createElement("div"); identity.className = "vv-author-identity"; identity.setAttribute("data-i18n-ignore", "");
  const name = doc.createElement("h3"); name.textContent = person.displayName || person.username;
  const handle = doc.createElement("span"); handle.textContent = `@${person.username}`; identity.append(name, handle);
  const note = doc.createElement("p"); note.textContent = t("The full profile and all works are available on spicylyrics.org.");
  const open = doc.createElement("a"); open.className = "vv-author-open"; open.href = authorProfileUrl(person); open.target = "_blank"; open.rel = "noopener noreferrer"; open.textContent = t("Open profile in browser");
  card.append(avatar, identity, note, open); return card;
}

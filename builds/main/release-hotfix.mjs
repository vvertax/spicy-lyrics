const PRODUCTION_HOST = "lrc.vvrtx.lol";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** @param {unknown} value */
export function parseHotfix(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value.trim())) throw new Error("Invalid hotfix counter");
  const hotfix = Number(value.trim());
  if (!Number.isSafeInteger(hotfix)) throw new Error("Invalid hotfix counter");
  return hotfix;
}

/** @param {{ name?: string, apiHost: string, storageHost?: string, fixedVersion?: string | null }} channel */
export function usesForkHotfix(channel) {
  if (channel.fixedVersion || channel.apiHost !== channel.storageHost) return false;
  return channel.apiHost === PRODUCTION_HOST || channel.name === "vvertax Edition Dev";
}

/** @param {string} version @param {number} hotfix */
export function hotfixBundleName(version, hotfix) {
  if (!VERSION_PATTERN.test(version)) throw new Error("Invalid fork version");
  if (!Number.isSafeInteger(hotfix) || hotfix < 0) throw new Error("Invalid hotfix counter");
  return `spicy-lyrics@${version}${hotfix > 0 ? "-r" + hotfix : ""}.mjs`;
}

/** @param {string} host @param {AbortSignal} signal @param {typeof fetch} [request] */
export async function fetchHotfix(host, signal, request = fetch) {
  const response = await request(`https://${host}/hotfix`, { cache: "no-store", signal });
  if (response.status === 404 || response.status === 410) return undefined;
  if (!response.ok) throw new Error(`Hotfix request failed with HTTP ${response.status}`);
  // Some legacy static hosts serve their HTML landing page for missing paths.
  if (response.headers.get("content-type")?.includes("text/html")) return undefined;
  return parseHotfix(await response.text());
}

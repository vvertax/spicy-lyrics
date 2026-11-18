import { DEFAULT_API_HOST, selectedChannel } from "./SelectedChannel.ts";
import { fetchHotfix, usesForkHotfix } from "../../../builds/main/release-hotfix.mjs";
const VERSION_TIMEOUT_MS = 5000;

export async function fetchSelectedChannelRelease() {
  const channel = selectedChannel();
  if (channel.fixedVersion) return undefined;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);
  try {
    const official = channel.apiHost === DEFAULT_API_HOST && channel.storageHost === "public.storage.spicylyrics.org";
    const response = await fetch(`https://${channel.apiHost}${official ? '/bp/loader/grabClientInfo' : '/version'}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Version request failed with HTTP ${response.status}`);
    const info = official ? await response.json() : null;
    const version = official
      ? (Array.isArray(info?.branches) ? info.branches.find((branch: { tag?: string; version?: unknown }) => branch?.tag === 'public')?.version : undefined)
      : (await response.text()).trim();
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      throw new Error(`Unexpected version response: ${JSON.stringify(String(version).slice(0, 40))}`);
    }
    const hotfix = usesForkHotfix(channel) ? await fetchHotfix(channel.apiHost, controller.signal) : undefined;
    return { version, hotfix, host: channel.apiHost };
  } finally {
    window.clearTimeout(timeout);
  }
}

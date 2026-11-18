import { forkReleaseHost } from "./ForkReleaseHost.ts";
const CHANNEL_PREFIX = "SpicyLyrics-";
export const DEFAULT_API_HOST = "api.spicylyrics.org";

type ChannelHosts = [string, string] | [string, string, string];

export function selectedChannel(): { name: string; apiHost: string; fixedVersion: string | null; storageHost?: string } {
  const name = Spicetify.LocalStorage.get(`${CHANNEL_PREFIX}buildChannel`) ?? "vvertax Edition";
  const production = { name: "vvertax Edition", apiHost: forkReleaseHost(), storageHost: forkReleaseHost(), fixedVersion: null };
  if (name === production.name || name === "SL") return production;
  if (name === "Stable" || name === "Beta") return { name, apiHost: DEFAULT_API_HOST, storageHost: "public.storage.spicylyrics.org", fixedVersion: null };

  try {
    const custom = JSON.parse(Spicetify.LocalStorage.get(`${CHANNEL_PREFIX}customChannels`) ?? "{}");
    const hosts = custom?.[name] as ChannelHosts | undefined;
    if (Array.isArray(hosts) && typeof hosts[0] === "string" && typeof hosts[1] === "string" && hosts[0].trim() && hosts[1].trim()) {
      return {
        name,
        apiHost: hosts[0].trim(),
        storageHost: hosts[1].trim(),
        fixedVersion: typeof hosts[2] === "string" && hosts[2].trim() ? hosts[2].trim() : null,
      };
    }
  } catch {
    // Match the entrypoint's SL fallback when stored channels are invalid.
  }
  return production;
}

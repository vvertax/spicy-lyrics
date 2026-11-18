import { ApplyLyricsIfCurrent } from "../../../../utils/Lyrics/Global/Applyer.ts";
import fetchLyrics from "../../../../utils/Lyrics/fetchLyrics.ts";
import { $currentLyricsData } from "../../../../utils/stores.ts";
import { $lastFetchedUri } from "../../../../utils/uiState.ts";
import { SpotifyPlayer } from "../../../Global/SpotifyPlayer.ts";

export async function refreshLocalLyrics(uri: string) {
  if (SpotifyPlayer.GetUri() !== uri) return;
  $lastFetchedUri.set(null);
  $currentLyricsData.set("");
  const lyrics = await fetchLyrics(uri, { reloadLocalLyrics: true });
  await ApplyLyricsIfCurrent(uri, lyrics);
}

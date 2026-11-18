import { useCallback, useEffect, useState } from "react";
import { LocalLyricsManager } from "../../../../utils/Lyrics/manager";
import { refreshLocalLyrics } from "../utils/refreshLocalLyrics.ts";

export type UseLyricsDBResult = {
  uris: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  remove: (uri: string) => Promise<void>;
};

export function useLyricsDB(): UseLyricsDBResult {
  const [uris, setUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await LocalLyricsManager.listKeys();
      setUris(keys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(async (uri: string) => {
    await LocalLyricsManager.remove(uri);
    await refresh();
    await refreshLocalLyrics(uri).catch(error => console.error("Could not refresh local lyrics", error));
  }, [refresh]);

  return { uris, loading, refresh, remove };
}

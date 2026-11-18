import { LocalLyricsManager } from "../../../utils/Lyrics/manager";
import { refreshLocalLyrics } from "./utils/refreshLocalLyrics.ts";
import { translateUi } from "../../../utils/i18n/translate.ts";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { useLyricsDB } from "./hooks/useLyricsDB";
import { useTracks } from "./hooks/useTracks";
import { useCurrentUri } from "./hooks/useCurrentUri";
import { SearchBar } from "./components/SearchBar";
import { TrackRow } from "./components/TrackRow";
import { IconButton } from "./components/IconButton";
import { ArrowLeftIcon, DownloadIcon, ResetIcon, UploadIcon } from "./components/Icons";
import { SpotifyPlayer } from "../../Global/SpotifyPlayer";
import fetchLyrics, { getSongKey, SessionTTMLStore } from "../../../utils/Lyrics/fetchLyrics";
import { ApplyLyricsIfCurrent } from "../../../utils/Lyrics/Global/Applyer";
import { $currentLyricsData, $uiLanguage } from "../../../utils/stores";
import { $lastFetchedUri } from "../../../utils/uiState";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- .]/g, "_").slice(0, 100);
}

type LyricsDBPanelProps = {
  onBack: () => void;
};

export default function LyricsDBPanel({ onBack }: LyricsDBPanelProps) {
  const [query, setQuery] = useState("");
  const { uris, loading: dbLoading, refresh, remove } = useLyricsDB();
  const [backupBusy, setBackupBusy] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  const { tracksByUri, loading: tracksLoading } = useTracks(uris);
  const currentUri = useCurrentUri();

  const loading = dbLoading || (uris.length > 0 && tracksLoading && tracksByUri.size === 0);

  function matchesQuery(uri: string): boolean {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const track = tracksByUri.get(uri);
    if (track) {
      if (track.name.toLowerCase().includes(q)) return true;
      if (track.artists.some((a) => a.name.toLowerCase().includes(q))) return true;
    }
    return uri.toLowerCase().includes(q);
  }

  const filtered = uris.filter(matchesQuery);

  // Pin the currently playing track to the top of the list.
  const currentIndex = currentUri ? filtered.indexOf(currentUri) : -1;
  if (currentIndex > 0) {
    filtered.unshift(filtered.splice(currentIndex, 1)[0]);
  }

  function download(doc: Document, name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = doc.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function handleDownload(uri: string) {
    try {
      const file = await LocalLyricsManager.getFile(uri);
      if (!file) throw new Error("Missing file");
      const name = sanitizeFilename(tracksByUri.get(uri)?.name ?? uri);
      download(restoreInput.current?.ownerDocument ?? document, name + "." + file.format, file.text, "text/plain");
    } catch { toast.error("Could not retrieve the saved lyrics."); }
  }

  async function exportBackup(doc: Document) {
    setBackupBusy(true);
    try {
      download(doc, "spicy-lyrics-library.json", await LocalLyricsManager.exportBackup(), "application/json");
    } catch { toast.error("Could not export the lyrics backup."); }
    finally { setBackupBusy(false); }
  }

  async function restoreBackup(file: File) {
    setBackupBusy(true);
    try {
      const { restored, skipped } = await LocalLyricsManager.restoreBackup(await file.text());
      await refresh();
      const uri = SpotifyPlayer.GetUri();
      if (uri && restored.includes(uri)) void refreshLocalLyrics(uri).catch(console.error);
      const label = translateUi("Restored: {restored} · Skipped: {skipped}", $uiLanguage.get());
      toast.success(label.replace("{restored}", String(restored.length)).replace("{skipped}", String(skipped)));
    } catch { toast.error("Could not restore the lyrics backup."); }
    finally { setBackupBusy(false); }
  }
  async function handleDelete(uri: string) {
    try {
      await remove(uri);
      toast.success("Removed from Local DB.", { duration: 3000 });
    } catch {
      toast.error("Failed to remove entry.", { duration: 4000 });
    }
  }

  function handlePlay(uri: string) {
    Spicetify.Player.playUri(uri);
  }

  function handleResetTTML() {
    const uri = SpotifyPlayer.GetUri();
    if (!uri) {
      toast.error("No track is currently playing.", { duration: 4000 });
      return;
    }
    const songKey = getSongKey(uri);
    if (songKey) SessionTTMLStore.delete(songKey);
    $lastFetchedUri.set(null);
    $currentLyricsData.set("");
    toast("TTML has been reset.", { duration: 4000 });
    setTimeout(() => {
      fetchLyrics(uri)
        .then((lyrics) => ApplyLyricsIfCurrent(uri, lyrics))
        .catch((err) => {
          toast.error("Error applying lyrics", { duration: 4000 });
          console.error("Error applying lyrics:", err);
        });
    }, 25);
  }

  return (
    <div className="sl-ldb-root">
      <div className="sl-ldb-toolbar">
        <IconButton
          icon={<ArrowLeftIcon size={14} />}
          label="Back"
          variant="default"
          onClick={onBack}
          title="Back to lyrics upload"
        />
        <SearchBar value={query} onChange={setQuery} placeholder="Search saved lyrics…" />
        <IconButton
          icon={<ResetIcon size={14} />}
          label="Reset TTML"
          variant="danger"
          onClick={handleResetTTML}
          title="Clear loaded TTML for the currently playing song"
        />
      </div>

      <div className="sl-ldb-upload-actions">
        <button type="button" className="sl-ldb-database-link" disabled={backupBusy} onClick={event => void exportBackup(event.currentTarget.ownerDocument)}><DownloadIcon size={14} /><span>Export backup</span></button>
        <button type="button" className="sl-ldb-database-link" disabled={backupBusy} onClick={() => restoreInput.current?.click()}><UploadIcon size={14} /><span>Restore backup</span></button>
        <input ref={restoreInput} type="file" accept=".json" hidden onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void restoreBackup(file);
        }} />
      </div>
      <div className="sl-ldb-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TrackRow
              key={i}
              uri=""
              track={null}
              loading={true}
              onPlay={() => {}}
              onDownload={() => {}}
              onDelete={() => {}}
            />
          ))
        ) : filtered.length === 0 ? (
          <div className="sl-ldb-empty">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 8v14M20 27.5v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="20" cy="20" r="16.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <p>{query.trim() ? "No matching entries" : "No lyrics saved yet"}</p>
          </div>
        ) : (
          filtered.map((uri) => (
            <TrackRow
              key={uri}
              uri={uri}
              track={tracksByUri.get(uri) ?? null}
              loading={tracksLoading}
              isCurrentlyPlaying={uri === currentUri}
              onPlay={() => handlePlay(uri)}
              onDownload={() => handleDownload(uri)}
              onDelete={() => handleDelete(uri)}
            />
          ))
        )}
      </div>
    </div>
  );
}

import { openTTMLCheck } from "../../../Utils/TTMLCheckPanel.ts";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { SpotifyPlayer } from "../../../../components/Global/SpotifyPlayer";
import fetchLyrics, { getSongKey, SessionTTMLStore } from "../../../../utils/Lyrics/fetchLyrics";
import { ApplyLyricsIfCurrent } from "../../../../utils/Lyrics/Global/Applyer";
import { isTrackUri, parseLocalLyrics, type LocalLyricsEntry } from "../../../../utils/Lyrics/manager/LocalLyricsFile.ts";
import { useCurrentUri } from "../hooks/useCurrentUri.ts";
import { refreshLocalLyrics } from "../utils/refreshLocalLyrics.ts";
import { ProcessLyrics } from "../../../../utils/Lyrics/ProcessLyrics";
import { $currentLyricsData } from "../../../../utils/stores";
import { $lastFetchedUri } from "../../../../utils/uiState";
import { LocalLyricsManager } from "../../../../utils/Lyrics/manager";
import { DatabaseIcon, GuideIcon, ResetIcon, UploadIcon } from "./Icons";

type UploadMode = "persistent" | "session" | "temporary";

type UploadTTMLModalProps = {
  onOpenDB: () => void;
  onDone: (mode: UploadMode) => void;
};

export default function UploadTTMLModal({ onOpenDB, onDone }: UploadTTMLModalProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingModeRef = useRef<UploadMode>("persistent");

  const activeUri = useCurrentUri();
  const pendingUri = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const [replacement, setReplacement] = useState<LocalLyricsEntry | null>(null);
  const songName = SpotifyPlayer.GetName() ?? "Unknown Song";

  function openFilePicker(mode: UploadMode) {
    if (busy.current || replacement) return;
    pendingUri.current = SpotifyPlayer.GetUri();
    pendingModeRef.current = mode;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    void handleUpload(file, pendingModeRef.current, pendingUri.current);
  }

  function handleOpenGuide() {
    window.open("https://lyrprep.spicylyrics.org/guide", "_blank", "noopener,noreferrer");
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

  async function savePersistent(entry: LocalLyricsEntry, replace: boolean) {
    await LocalLyricsManager.saveFile(entry.uri, { format: entry.format, text: entry.text }, replace);
    SessionTTMLStore.delete(getSongKey(entry.uri));
    try { await refreshLocalLyrics(entry.uri); } catch (error) {
      console.error("Could not refresh saved lyrics", error);
    }
    toast.success("Lyrics saved to Local DB!");
    onDone("persistent");
  }

  async function handleUpload(file: File, mode: UploadMode, uri: string | undefined) {
    if (busy.current || replacement) return;
    const extension = file.name.toLowerCase().split(".").at(-1);
    if (extension !== "ttml" && extension !== "lrc") { toast.error("Choose a TTML or LRC file."); return; }
    if (!isTrackUri(uri) || SpotifyPlayer.GetUri() !== uri) { toast.error("Open the target song first."); return; }
    const duration = SpotifyPlayer.GetDuration();
    busy.current = true;
    setUploading(true);
    try {
      const entry: LocalLyricsEntry = { uri, format: extension, text: await file.text() };
      const lyrics = await parseLocalLyrics(entry, duration);
      if (!lyrics) { toast.error("No valid lyrics found in the file."); return; }
      if (SpotifyPlayer.GetUri() !== uri) { toast.error("Track changed before the file finished loading."); return; }
      if (mode === "persistent") {
        if (await LocalLyricsManager.getFile(uri)) setReplacement(entry);
        else await savePersistent(entry, false);
        return;
      }
      const songKey = getSongKey(uri);
      const data = { ...lyrics, id: uri.startsWith("spotify:local:") ? songKey : SpotifyPlayer.GetId(), uri, userUploaded: true };
      await ProcessLyrics(data);
      if (SpotifyPlayer.GetUri() !== uri) { toast.error("Track changed before the file finished loading."); return; }
      if (mode === "session") SessionTTMLStore.set(songKey, data);
      $currentLyricsData.set(JSON.stringify(data));
      await ApplyLyricsIfCurrent(uri, [data, 200]);
      toast.success(mode === "session" ? "Lyrics applied for this session!" : "Lyrics parsed and applied!");
      onDone(mode);
    } catch (error) {
      toast.error("Upload failed.");
      console.error("Local lyrics upload failed", error);
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }

  async function confirmReplacement() {
    if (!replacement || busy.current || SpotifyPlayer.GetUri() !== replacement.uri) return;
    busy.current = true;
    setUploading(true);
    try {
      await savePersistent(replacement, true);
      setReplacement(null);
    } catch (error) {
      toast.error("Upload failed.");
      console.error("Local lyrics replacement failed", error);
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }
  return (
    <div className="sl-ldb-upload-root">
      <div className="sl-ldb-upload-header">
        <p className="sl-ldb-upload-subtitle">For: {songName}</p>
        <div className="sl-ldb-upload-actions">
          <button type="button" className="sl-ldb-database-link" onClick={event => openTTMLCheck(event.currentTarget.ownerDocument)}>Check TTML</button>
          <button
            type="button"
            className="sl-ldb-database-link"
            onClick={handleOpenGuide}
            disabled={uploading}
          >
            <GuideIcon size={14} />
            <span>Guide</span>
          </button>
          <button
            type="button"
            className="sl-ldb-database-link"
            onClick={handleResetTTML}
            disabled={uploading}
          >
            <ResetIcon size={14} />
            <span>Reset TTML</span>
          </button>
          <button
            type="button"
            className="sl-ldb-database-link"
            onClick={onOpenDB}
            disabled={uploading}
          >
            <DatabaseIcon size={14} />
            <span>Local Lyrics Library</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ttml,.lrc"
        id="sl-ldb-file-input"
        className="sl-ldb-file-input"
        onChange={handleFileChange}
      />

      {replacement && <div role="group" className="sl-ldb-upload-actions">
        <span>{activeUri === replacement.uri ? "Replace the saved lyrics for this track?" : "Track changed. Select the file again."}</span>
        <button type="button" className="sl-ldb-database-link" onClick={confirmReplacement} disabled={uploading || activeUri !== replacement.uri}>Replace</button>
        <button type="button" className="sl-ldb-database-link" onClick={() => setReplacement(null)} disabled={uploading}>Cancel</button>
      </div>}
      <div className="sl-ldb-upload-mode-section"
        onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
        onDrop={event => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void handleUpload(file, "persistent", SpotifyPlayer.GetUri());
        }}>
        <p className="sl-ldb-drop-hint">Drop a TTML or LRC file here to save it for this track.</p>
        <div className="sl-ldb-upload-modes">
          <button
            type="button"
            className="sl-ldb-upload-mode-card"
            onClick={() => openFilePicker("persistent")}
            disabled={uploading || Boolean(replacement)}
          >
            <span className="sl-ldb-upload-mode-icon"><UploadIcon size={16} /></span>
            <span className="sl-ldb-upload-mode-copy">
              <span className="sl-ldb-upload-mode-title">Persistent Load</span>
              <span className="sl-ldb-upload-mode-desc">Stored in local DB, survives restarts</span>
            </span>
          </button>
          <button
            type="button"
            className="sl-ldb-upload-mode-card"
            onClick={() => openFilePicker("temporary")}
            disabled={uploading || Boolean(replacement)}
          >
            <span className="sl-ldb-upload-mode-icon"><UploadIcon size={16} /></span>
            <span className="sl-ldb-upload-mode-copy">
              <span className="sl-ldb-upload-mode-title">Temporary Load</span>
              <span className="sl-ldb-upload-mode-desc">Applied only to current song until refresh</span>
            </span>
          </button>
          <button
            type="button"
            className="sl-ldb-upload-mode-card"
            onClick={() => openFilePicker("session")}
            disabled={uploading || Boolean(replacement)}
          >
            <span className="sl-ldb-upload-mode-icon"><UploadIcon size={16} /></span>
            <span className="sl-ldb-upload-mode-copy">
              <span className="sl-ldb-upload-mode-title">Session Load</span>
              <span className="sl-ldb-upload-mode-desc">Used for this track until Spotify restarts</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

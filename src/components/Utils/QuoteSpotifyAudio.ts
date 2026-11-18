import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";

type CaptureWindow = Window & typeof globalThis;

export function canCaptureSpotifyAudio(view: CaptureWindow) {
  return Boolean(view.navigator.mediaDevices?.getDisplayMedia
    && view.MediaRecorder?.isTypeSupported("audio/webm;codecs=opus"));
}

async function waitForPosition(check: () => boolean, timeout: number, verify: () => void) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    verify();
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 24));
  }
  throw new Error("Spotify did not reach the selected part of the song.");
}

function hasAudioInRange(buffer: AudioBuffer, startMs: number, durationMs: number) {
  const start = Math.max(0, Math.floor(startMs * buffer.sampleRate / 1000));
  const end = Math.min(buffer.length, Math.ceil((startMs + durationMs) * buffer.sampleRate / 1000));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = start; i < end; i += 19) if (Math.abs(samples[i]) > .0001) return true;
  }
  return false;
}

export async function captureSpotifyAudio(
  view: CaptureWindow, uri: string, start: number, duration: number, signal: AbortSignal,
  onRecording: () => void,
) {
  const player = Spicetify.Player;
  const position = () => player.getProgress();
  const verifyTrack = () => {
    signal.throwIfAborted();
    if (uri !== SpotifyPlayer.GetUri()) throw new Error("Return to the quoted song to record its audio.");
  };
  verifyTrack();
  const constraints: DisplayMediaStreamOptions & { systemAudio: "include"; windowAudio: "window" } = {
    video: true, audio: true, systemAudio: "include", windowAudio: "window",
  };
  const shared = await view.navigator.mediaDevices.getDisplayMedia(constraints);
  let recorder: MediaRecorder | undefined;
  let previous: { position: number; playing: boolean } | undefined;
  const stop = () => { if (recorder?.state === "recording") recorder.stop(); };
  try {
    verifyTrack();
    const tracks = shared.getAudioTracks();
    if (!tracks.some(track => track.readyState === "live")) throw new Error("The selected source did not share audio.");
    const verify = () => {
      verifyTrack();
      if (tracks.every(track => track.readyState === "ended")) throw new Error("Audio sharing ended before recording finished.");
    };
    previous = { position: position(), playing: player.isPlaying() };
    if (previous.playing) player.togglePlay();
    await waitForPosition(() => !player.isPlaying(), 2_500, verify);
    SpotifyPlayer.Seek(start);
    await waitForPosition(() => Math.abs(position() - start) < 180, 4_000, verify);
    const mimeType = "audio/webm;codecs=opus";
    recorder = new view.MediaRecorder(new view.MediaStream(tracks), { mimeType, audioBitsPerSecond: 160_000 });
    const chunks: Blob[] = [];
    let started = false;
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder!.onstart = () => { started = true; };
      recorder!.onerror = () => reject(new Error("Could not record Spotify audio."));
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    void finished.catch(() => {});
    signal.addEventListener("abort", stop, { once: true });
    recorder.start();
    await waitForPosition(() => started, 2_500, verify);
    const clockStart = performance.now();
    // Keep a small lead-in so the captured source can be aligned to Spotify's clock.
    await new Promise(resolve => setTimeout(resolve, 180));
    verify();
    onRecording();
    if (!player.isPlaying()) player.togglePlay();
    let cue = performance.now() - clockStart;
    await waitForPosition(() => {
      const elapsed = position() - start;
      if (!player.isPlaying() || elapsed < 32) return false;
      cue = Math.max(0, performance.now() - clockStart - elapsed);
      return true;
    }, 4_000, verify);
    const clipEnd = start + duration;
    const trackDuration = player.getDuration();
    const recordingEnd = trackDuration > clipEnd
      ? Math.min(clipEnd + 180, trackDuration - 30)
      : clipEnd;
    await waitForPosition(() => position() >= recordingEnd, duration + 5_000, verify);
    stop();
    const recording = await finished;
    verifyTrack();
    const decoder = new OfflineAudioContext(2, 1, 48_000);
    const buffer = await decoder.decodeAudioData(await recording.arrayBuffer());
    if (buffer.duration * 1000 < duration || cue + duration > buffer.duration * 1000 + 30
      || !hasAudioInRange(buffer, cue, duration)) {
      throw new Error("No music was detected in the shared audio. Share Spotify or system audio.");
    }
    // Take MediaRecorder's frame rounding into account when the end is close.
    return { buffer, origin: start - Math.min(cue, buffer.duration * 1000 - duration) };
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
    shared.getTracks().forEach(track => track.stop());
    if (previous && SpotifyPlayer.GetUri() === uri) {
      try {
        if (player.isPlaying() !== previous.playing) player.togglePlay();
        SpotifyPlayer.Seek(previous.position);
      } catch (error) { console.warn("Could not restore Spotify playback", error); }
    }
  }
}

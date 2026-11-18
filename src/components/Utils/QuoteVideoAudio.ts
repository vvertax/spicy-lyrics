import {
  AudioBufferSource, BlobSource, EncodedAudioPacketSource, EncodedPacketSink,
  Input, WebMInputFormat, canEncodeAudio, type AudioSource,
} from "mediabunny";

export const QUOTE_AUDIO_UNAVAILABLE = "Audio export is unavailable in this window.";

export function trimQuoteAudio(buffer: AudioBuffer, startMs: number, durationMs: number): AudioBuffer | null {
  const start = Math.round(startMs * buffer.sampleRate / 1000);
  const length = Math.max(1, Math.round(durationMs * buffer.sampleRate / 1000));
  if (start < 0 || start + length > buffer.length) return null;
  const trimmed = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, length });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.getChannelData(channel).set(buffer.getChannelData(channel).subarray(start, start + length));
  }
  return trimmed;
}

function audioConfig(buffer: AudioBuffer) {
  return { numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, bitrate: 128_000 };
}

export function canEncodeQuoteAac(buffer: AudioBuffer) {
  return canEncodeAudio("aac", audioConfig(buffer));
}

async function captureOpus(buffer: AudioBuffer, signal: AbortSignal) {
  const mimeType = "audio/webm;codecs=opus";
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(QUOTE_AUDIO_UNAVAILABLE);
  }
  const ctx = new AudioContext({ sampleRate: buffer.sampleRate });
  const destination = ctx.createMediaStreamDestination();
  try {
    signal.throwIfAborted();
    await ctx.resume();
    signal.throwIfAborted();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(destination);
    const recorder = new MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 128_000 });
    let tailTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      clearTimeout(tailTimer);
      if (recorder.state === "recording") recorder.stop();
    };
    try {
      return await new Promise<Blob>((resolve, reject) => {
        const chunks: Blob[] = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error(QUOTE_AUDIO_UNAVAILABLE));
        recorder.onstop = () => signal.aborted
          ? reject(signal.reason) : resolve(new Blob(chunks, { type: mimeType }));
        recorder.onstart = () => { if (!signal.aborted) node.start(); };
        // Give the recorder time to flush its last Opus packets. The muxer trims
        // any captured tail back to the cut's duration.
        node.onended = () => { tailTimer = setTimeout(abort, 180); };
        signal.addEventListener("abort", abort, { once: true });
        recorder.start();
      });
    } finally {
      signal.removeEventListener("abort", abort);
      abort();
      node.disconnect();
    }
  } finally {
    destination.stream.getTracks().forEach(track => track.stop());
    await ctx.close().catch(() => {});
  }
}

export async function quoteAudioTrack(
  buffer: AudioBuffer, codec: "aac" | "opus", signal: AbortSignal,
): Promise<{ source: AudioSource; write: () => Promise<void>; dispose?: () => void }> {
  if (await canEncodeAudio(codec, audioConfig(buffer))) {
    const source = new AudioBufferSource({ codec, bitrate: 128_000 });
    return { source, async write() { signal.throwIfAborted(); await source.add(buffer); source.close(); } };
  }
  if (codec !== "opus") throw new Error(QUOTE_AUDIO_UNAVAILABLE);
  const blob = await captureOpus(buffer, signal);
  const input = new Input({ formats: [new WebMInputFormat()], source: new BlobSource(blob) });
  try {
    const track = await input.getPrimaryAudioTrack();
    const config = await track?.getDecoderConfig();
    if (!track || !config) throw new Error(QUOTE_AUDIO_UNAVAILABLE);
    const source = new EncodedAudioPacketSource("opus");
    return { source, dispose: () => input.dispose(), async write() {
      let first: number | undefined;
      for await (const packet of new EncodedPacketSink(track).packets()) {
        signal.throwIfAborted();
        const timestamp = packet.timestamp - (first ??= packet.timestamp);
        if (timestamp >= buffer.duration) break;
        await source.add(packet.clone({ timestamp, duration: Math.min(packet.duration, buffer.duration - timestamp) }),
          timestamp === 0 ? { decoderConfig: config } : undefined);
      }
      if (first === undefined) throw new Error(QUOTE_AUDIO_UNAVAILABLE);
      source.close();
    } };
  } catch (error) {
    input.dispose();
    throw error;
  }
}

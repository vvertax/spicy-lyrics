import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeVideo } from "mediabunny";
import { canEncodeQuoteAac, quoteAudioTrack } from "./QuoteVideoAudio.ts";

export async function encodeQuoteFrames(
  canvas: HTMLCanvasElement, duration: number, fps: number, draw: (elapsed: number) => void,
  signal: AbortSignal, onProgress: (ratio: number, extension: "mp4" | "webm") => void, audio?: AudioBuffer,
) {
  const config = { width: canvas.width, height: canvas.height, frameRate: fps, bitrate: 6_000_000 };
  const codecs = ["avc", "vp8", "vp9"] as const;
  let codec: (typeof codecs)[number] | undefined;
  for (const candidate of codecs) {
    signal.throwIfAborted();
    if (audio && candidate === "avc" && !(await canEncodeQuoteAac(audio))) continue;
    if (await canEncodeVideo(candidate, config)) { codec = candidate; break; }
  }
  if (!codec) return null;
  const extension = codec === "avc" ? "mp4" : "webm";
  const format = codec === "avc" ? new Mp4OutputFormat() : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  // A Document PiP canvas belongs to a different window than the encoder.
  const copy = canvas instanceof HTMLCanvasElement ? null : new OffscreenCanvas(config.width, config.height);
  const copyContext = copy?.getContext("2d");
  const source = new CanvasSource(copy ?? canvas, { codec, bitrate: config.bitrate });
  output.addVideoTrack(source, { frameRate: fps });
  const audioTrack = audio && await quoteAudioTrack(audio, extension === "mp4" ? "aac" : "opus", signal);
  if (audioTrack) output.addAudioTrack(audioTrack.source);
  const abort = () => { void output.cancel().catch(() => {}); };
  signal.throwIfAborted();
  signal.addEventListener("abort", abort, { once: true });
  const frames = Math.max(1, Math.ceil(duration * fps / 1000));
  try {
    await output.start();
    const audioWriting = audioTrack?.write();
    void audioWriting?.catch(abort);
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      const time = frame / fps;
      draw(time * 1000);
      copyContext?.drawImage(canvas, 0, 0);
      await source.add(time, 1 / fps);
      if (frame % 4 === 0) {
        onProgress(frame / frames, extension);
        // Let the editor paint progress and handle Cancel even with a fast encoder.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    source.close();
    await audioWriting;
    await output.finalize();
    signal.throwIfAborted();
    if (!target.buffer?.byteLength) throw new Error("Video export produced no frames.");
    onProgress(1, extension);
    return { blob: new Blob([target.buffer], { type: "video/" + extension }), extension };
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    audioTrack?.dispose?.();
  }
}

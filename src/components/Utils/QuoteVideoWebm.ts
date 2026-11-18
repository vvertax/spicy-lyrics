import {
  BlobSource, BufferTarget, EncodedPacketSink, EncodedVideoPacketSource,
  Input, Output, WebMInputFormat, WebMOutputFormat,
} from "mediabunny";
import { quoteAudioTrack } from "./QuoteVideoAudio.ts";

type RecordingWindow = Window & typeof globalThis;
const WEBM_TYPES = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];

function waitForCapture(view: RecordingWindow, milliseconds: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const timer = view.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => { view.clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function captureFrames(
  canvas: HTMLCanvasElement, frames: number, fps: number, pacing: number,
  draw: (elapsed: number) => void, signal: AbortSignal, progress: (ratio: number) => void,
) {
  const doc = canvas.ownerDocument;
  const view = doc.defaultView as RecordingWindow;
  const mimeType = WEBM_TYPES.find(type => view.MediaRecorder?.isTypeSupported(type));
  if (!mimeType || !canvas.captureStream) throw new Error("Video export is unavailable in this window.");
  const surface = doc.createElement("canvas");
  surface.width = canvas.width;
  surface.height = canvas.height;
  const ctx = surface.getContext("2d")!;
  const stream = surface.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  let recorder: MediaRecorder | undefined;
  const chunks: Blob[] = [];
  const abort = () => { if (recorder?.state === "recording") recorder.stop(); };
  try {
    signal.throwIfAborted();
    if (!track?.requestFrame) throw new Error("Manual video frame capture is unavailable.");
    recorder = new view.MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const completed = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => reject(new Error("WebM recording failed."));
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    void completed.catch(() => {});
    signal.addEventListener("abort", abort, { once: true });
    recorder.start();
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      if (doc.hidden) throw new Error("Keep the quote window visible while exporting.");
      if (recorder.state !== "recording") throw new Error("WebM recording stopped prematurely.");
      draw(frame * 1000 / fps);
      track.requestFrame();
      ctx.drawImage(canvas, 0, 0);
      if (frame % 4 === 0) progress((frame + 1) / frames * .95);
      await waitForCapture(view, pacing, signal);
    }
    recorder.stop();
    return await completed;
  } finally {
    signal.removeEventListener("abort", abort);
    abort();
    stream.getTracks().forEach(track => track.stop());
  }
}

async function writeConstantFrameRate(blob: Blob, frameCount: number, fps: number, signal: AbortSignal, audio?: AudioBuffer) {
  const input = new Input({ formats: [new WebMInputFormat()], source: new BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const codec = await track.getCodec();
    const config = await track.getDecoderConfig();
    if ((codec !== "vp8" && codec !== "vp9") || !config) return null;
    const sink = new EncodedPacketSink(track);
    const packets = [];
    for await (const packet of sink.packets()) {
      signal.throwIfAborted();
      packets.push(packet);
    }
    if (packets.length !== frameCount) return null;

    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const video = new EncodedVideoPacketSource(codec);
    output.addVideoTrack(video, { frameRate: fps });
    const audioTrack = audio && await quoteAudioTrack(audio, "opus", signal);
    if (audioTrack) output.addAudioTrack(audioTrack.source);
    try {
      await output.start();
      const audioWriting = audioTrack?.write();
      void audioWriting?.catch(() => output.cancel().catch(() => {}));
      for (const [index, packet] of packets.entries()) {
        signal.throwIfAborted();
        await video.add(packet.clone({ timestamp: index / fps, duration: 1 / fps }),
          index === 0 ? { decoderConfig: config } : undefined);
      }
      video.close();
      await audioWriting;
      await output.finalize();
      return target.buffer && new Blob([target.buffer], { type: "video/webm" });
    } catch (error) {
      await output.cancel().catch(() => {});
      throw error;
    } finally {
      audioTrack?.dispose?.();
    }
  } finally {
    input.dispose();
  }
}

export async function encodeQuoteWebmFallback(
  canvas: HTMLCanvasElement, duration: number, fps: number, draw: (elapsed: number) => void,
  signal: AbortSignal, onProgress: (ratio: number, extension: "webm") => void, audio?: AudioBuffer,
) {
  const frames = Math.max(1, Math.ceil(duration * fps / 1000));
  const progress = (ratio: number) => onProgress(ratio, "webm");
  // Give MediaRecorder extra time per frame, then assign the actual clip's clock.
  // Retry at a slower pace if the recorder still dropped a frame.
  for (const pacing of [50, 75]) {
    progress(0);
    const capture = await captureFrames(canvas, frames, fps, pacing, draw, signal, progress);
    const blob = await writeConstantFrameRate(capture, frames, fps, signal, audio);
    if (blob) {
      progress(1);
      return { blob, extension: "webm" as const };
    }
  }
  throw new Error("WebM export could not capture all frames.");
}

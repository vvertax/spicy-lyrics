export function checkRequest(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Lyrics request cancelled", "AbortError");
}
/** Cosmos has no abort API: detach promptly and discard its late response. */
export function abortable<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) { void request.catch(() => {}); checkRequest(signal); }
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Lyrics request cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    request.then(value => { signal.removeEventListener("abort", abort); if (!signal.aborted) resolve(value); }, error => {
      signal.removeEventListener("abort", abort); reject(error);
    });
  });
}

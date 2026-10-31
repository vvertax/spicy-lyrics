// A font the listener picked from a file (Font → From a File), for fonts that aren't on
// Google Fonts and that they'd rather not install on the computer. The file is kept in
// IndexedDB, since a font can be several MB, and registered under one family name.
const DB_NAME = "SL_ForkFonts";
const STORE = "fonts";
const KEY = "lyricsFont";
/** The family the file's font goes by in the page's CSS. */
export const FONT_FILE_FAMILY = "SL Font File";
// Bigger than any reasonable single font file; keeps a wrong pick (a video) out of the DB.
const MAX_BYTES = 20 * 1024 * 1024;

type Stored = { name: string; data: ArrayBuffer };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

let stored: Promise<Stored | null> | null = null;

export function GetFontFile(): Promise<Stored | null> {
  stored ??= withStore<Stored | undefined>("readonly", (s) => s.get(KEY))
    .then((v) => v ?? null)
    .catch(() => null);
  return stored;
}

/**
 * Checks the file is a font the browser can use, then keeps it. Throws with a message
 * fit to show when it isn't.
 */
export async function SaveFontFile(file: File): Promise<Stored> {
  if (file.size > MAX_BYTES) throw new Error("That file is too big to be a font.");
  const data = await file.arrayBuffer();
  try {
    await new FontFace("SL Font Check", data.slice(0)).load();
  } catch {
    throw new Error("That file isn't a font Spotify can use. Try a .ttf, .otf, .woff or .woff2.");
  }
  const entry = { name: file.name, data };
  await withStore("readwrite", (s) => s.put(entry, KEY));
  stored = Promise.resolve(entry);
  return entry;
}

const registered = new WeakMap<Document, ArrayBuffer>();

/** Adds the font file's face to `doc` (the main window, or Popup Lyrics' own). */
export async function RegisterFontFile(doc: Document): Promise<boolean> {
  const entry = await GetFontFile();
  const win = doc.defaultView as (Window & typeof globalThis) | null;
  if (!entry || !win) return false;
  if (registered.get(doc) === entry.data) return true;
  // A file picked earlier is still registered under the same family; it has to go first.
  for (const old of doc.fonts) {
    if (old.family.replace(/"/g, "") === FONT_FILE_FAMILY) doc.fonts.delete(old);
  }
  const face = new win.FontFace(FONT_FILE_FAMILY, entry.data.slice(0));
  doc.fonts.add(face);
  await face.load();
  registered.set(doc, entry.data);
  return true;
}

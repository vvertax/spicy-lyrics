import { dbPromise, ObjectStores } from "../../db";
import Logger from "../../Logger";
import { isTrackUri, parseLocalLyrics, parseLyricsBackup, readLocalLyricsFile, type LocalLyricsFile } from "./LocalLyricsFile.ts";

const logger = new Logger("Local Lyrics Manager");

const objStore = ObjectStores.LyricsStore;

function logCaught(operation: string, error: unknown, context?: Record<string, unknown>) {
  const detail =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  logger.error(`${operation} failed:`, detail, context);
}

async function put(uri: string, ttml: unknown) {
  try {
    const db = await dbPromise;
    return await db.put(objStore, ttml, uri);
  } catch (error) {
    logCaught("put", error, { uri });
    throw error;
  }
}

async function get(uri: string, durationMs?: number): Promise<any | null> {
  try {
    const db = await dbPromise;
    const data = await db.get(objStore, uri);
    const file = readLocalLyricsFile(data);
    return file ? await parseLocalLyrics(file, durationMs) : null;
  } catch (error) {
    logCaught("get", error, { uri });
    return null;
  }
}

async function listKeys(): Promise<Array<string>> {
  try {
    const db = await dbPromise;
    const keys = await db.getAllKeys(objStore);
    return keys.filter((key): key is string => typeof key === "string");
  } catch (error) {
    logCaught("listKeys", error);
    return [];
  }
}

async function getRaw(uri: string): Promise<string | null> {
  try {
    const db = await dbPromise;
    const data = await db.get(objStore, uri);
    if (data == null) return null;
    return typeof data === "string" ? data : null;
  } catch (error) {
    logCaught("getRaw", error, { uri });
    return null;
  }
}

async function remove(uri: string): Promise<void> {
  try {
    const db = await dbPromise;
    await db.delete(objStore, uri);
  } catch (error) {
    logCaught("remove", error, { uri });
    throw error;
  }
}

async function getFile(uri: string) {
  return readLocalLyricsFile(await (await dbPromise).get(objStore, uri));
}

async function saveFile(uri: string, file: LocalLyricsFile, replace: boolean) {
  const db = await dbPromise;
  const value = file.format === "ttml" ? file.text : file;
  if (replace) await db.put(objStore, value, uri);
  else await db.add(objStore, value, uri);
}

async function exportBackup() {
  const db = await dbPromise;
  let cursor = await db.transaction(objStore).store.openCursor();
  const entries = [];
  while (cursor) {
    const file = readLocalLyricsFile(cursor.value);
    if (isTrackUri(cursor.key) && file) entries.push({ uri: cursor.key, ...file });
    cursor = await cursor.continue();
  }
  return JSON.stringify({ version: 1, entries }, null, 2);
}

async function restoreBackup(source: string) {
  const entries = await parseLyricsBackup(source);
  const transaction = (await dbPromise).transaction(objStore, "readwrite");
  const done = transaction.done;
  void done.catch(() => {});
  const restored: string[] = [];
  try {
    for (const { uri, format, text } of entries) {
      if (await transaction.store.getKey(uri) !== undefined) continue;
      await transaction.store.add(format === "ttml" ? text : { format, text }, uri);
      restored.push(uri);
    }
    await done;
  } catch (error) {
    try { transaction.abort(); } catch { /* Already aborted by IndexedDB. */ }
    await done.catch(() => {});
    throw error;
  }
  return { restored, skipped: entries.length - restored.length };
}

export const LocalLyricsManager = {
  getFile,
  saveFile,
  exportBackup,
  restoreBackup,
  put,
  get,
  getRaw,
  listKeys,
  remove,
};

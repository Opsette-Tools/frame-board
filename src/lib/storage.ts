import { openDB, type IDBPDatabase } from "idb";
import type { Board } from "@/types";
import { createBoard, fitFramesToLayout, DEFAULT_FRAME_BG, LAYOUTS, type LayoutKind } from "@/types";

// Frame Board persistence.
//
// - Board metadata (layout, frames, captions, image ids) → localStorage. Small
//   and synchronous, so the current board restores instantly on open.
// - Image blobs → IndexedDB (localStorage can't hold binary efficiently). Keyed
//   by the imageId stored on each frame.

const BOARD_KEY = "frame-board:current";

const DB_NAME = "frame-board";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ---- Board metadata (localStorage) ----------------------------------------

/** Load the saved board, or a fresh one if none exists / it's unreadable. */
export function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return createBoard();
    const parsed = JSON.parse(raw) as Board & { layout: string };
    if (parsed?.schema !== 1 || !Array.isArray(parsed.frames)) return createBoard();
    // Backfill / migrate fields added after a board was first saved.
    const layout: LayoutKind = parsed.layout in LAYOUTS ? (parsed.layout as LayoutKind) : "two-up";
    const frames = parsed.frames.map((f) => ({ ...f, background: f.background ?? DEFAULT_FRAME_BG }));
    return {
      ...parsed,
      layout,
      orientation: parsed.orientation ?? "horizontal",
      // Ensure frame count matches the (possibly migrated) layout.
      frames: fitFramesToLayout(frames, layout),
    };
  } catch {
    return createBoard();
  }
}

export function saveBoard(board: Board): void {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify({ ...board, updatedAt: Date.now() }));
  } catch {
    // Quota or private-mode failures are non-fatal; the in-memory board still works.
  }
}

// ---- Image blobs (IndexedDB) ----------------------------------------------

export async function saveImage(id: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(IMAGE_STORE, blob, id);
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  return (await db.get(IMAGE_STORE, id)) as Blob | undefined;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(IMAGE_STORE, id);
}

export async function getImageUrl(id?: string): Promise<string | undefined> {
  if (!id) return undefined;
  const blob = await getImage(id);
  if (!blob) return undefined;
  return URL.createObjectURL(blob);
}

/** Remove any image blobs not referenced by the given board (e.g. after replace/new). */
export async function pruneImages(keepIds: string[]): Promise<void> {
  const db = await getDb();
  const keep = new Set(keepIds);
  const allKeys = (await db.getAllKeys(IMAGE_STORE)) as string[];
  await Promise.all(allKeys.filter((k) => !keep.has(k)).map((k) => db.delete(IMAGE_STORE, k)));
}

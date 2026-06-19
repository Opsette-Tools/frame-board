// Core data model for Frame Board.
//
// A Board is a single comparison the user is working on: a set of frames
// (each an image + a caption) arranged in a layout. Everything lives locally
// — board metadata in localStorage, image blobs in IndexedDB. There is no
// "projects" concept; the app restores the last board on open.

export type LayoutKind = "two-up" | "three-up" | "grid-2x2";

/** For two-up: lay the pair across (row) or stacked (column) in the export. */
export type Orientation = "horizontal" | "vertical";

export interface Frame {
  id: string;
  /** Key of the image blob in IndexedDB, if an image has been uploaded. */
  imageId?: string;
  /** Editable caption shown under the frame and on the export. */
  caption: string;
  /**
   * Background color behind the image, baked into the export. Lets a logo with
   * white or transparent areas sit on a contrasting color independently of the
   * other frames. Defaults to white.
   */
  background: string;
}

/** Default background for a frame's image area. */
export const DEFAULT_FRAME_BG = "#ffffff";

/** Quick-pick swatches offered in the frame background picker. */
export const FRAME_BG_PRESETS: { color: string; label: string }[] = [
  { color: "#ffffff", label: "White" },
  { color: "#f1f5f9", label: "Light gray" },
  { color: "#1f2937", label: "Charcoal" },
  { color: "#2f4f46", label: "Opsette green" },
  { color: "#0f172a", label: "Navy" },
];

export interface Board {
  /** Schema version, so future migrations can detect old saved boards. */
  schema: 1;
  layout: LayoutKind;
  /** Only meaningful for two-up; ignored by multi-frame layouts. */
  orientation: Orientation;
  frames: Frame[];
  updatedAt: number;
}

/** How many frames each layout shows, and its CSS grid spec. */
export const LAYOUTS: Record<
  LayoutKind,
  { label: string; frameCount: number; columns: number }
> = {
  "two-up": { label: "2-up", frameCount: 2, columns: 2 },
  "three-up": { label: "3-up", frameCount: 3, columns: 3 },
  "grid-2x2": { label: "2×2 grid", frameCount: 4, columns: 2 },
};

/** Default captions used when frames are auto-added. */
const DEFAULT_CAPTIONS = ["Before", "After", "Then", "Now"];

export function makeFrame(caption = ""): Frame {
  return { id: crypto.randomUUID(), caption, background: DEFAULT_FRAME_BG };
}

/**
 * Add or remove frames so the board has exactly the count its layout needs.
 * Filled frames are kept ahead of empty ones when trimming, so switching to a
 * smaller layout never silently drops a photo you uploaded.
 */
export function fitFramesToLayout(frames: Frame[], layout: LayoutKind): Frame[] {
  const target = LAYOUTS[layout].frameCount;
  if (frames.length === target) return frames;
  if (frames.length < target) {
    const added = Array.from({ length: target - frames.length }, (_, i) =>
      makeFrame(DEFAULT_CAPTIONS[frames.length + i] ?? ""),
    );
    return [...frames, ...added];
  }
  // Trimming: keep frames with images first, then by original order, up to target.
  const ordered = [...frames].sort((a, b) => Number(!!b.imageId) - Number(!!a.imageId));
  const keep = new Set(ordered.slice(0, target).map((f) => f.id));
  return frames.filter((f) => keep.has(f.id));
}

/** A fresh two-frame before/after board. */
export function createBoard(): Board {
  return {
    schema: 1,
    layout: "two-up",
    orientation: "horizontal",
    frames: [makeFrame("Before"), makeFrame("After")],
    updatedAt: Date.now(),
  };
}

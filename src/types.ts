// Core data model for Frame Board.
//
// A Board is a single comparison the user is working on: a set of frames
// (each an image + a caption) arranged in a layout. Everything lives locally
// — board metadata in localStorage, image blobs in IndexedDB. There is no
// "projects" concept; the app restores the last board on open.

export type LayoutKind = "side-by-side";

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
  frames: Frame[];
  updatedAt: number;
}

/** A fresh two-frame before/after board. */
export function createBoard(): Board {
  return {
    schema: 1,
    layout: "side-by-side",
    frames: [
      { id: crypto.randomUUID(), caption: "Before", background: DEFAULT_FRAME_BG },
      { id: crypto.randomUUID(), caption: "After", background: DEFAULT_FRAME_BG },
    ],
    updatedAt: Date.now(),
  };
}

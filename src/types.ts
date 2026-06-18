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
}

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
      { id: crypto.randomUUID(), caption: "Before" },
      { id: crypto.randomUUID(), caption: "After" },
    ],
    updatedAt: Date.now(),
  };
}

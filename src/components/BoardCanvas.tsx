import { forwardRef } from "react";
import type { Board } from "@/types";
import FrameCard from "./FrameCard";

interface BoardCanvasProps {
  board: Board;
  /** imageId → object URL, for frames that have an uploaded image. */
  imageUrls: Record<string, string>;
  isDark: boolean;
  isMobile: boolean;
  onUpload: (frameId: string, file: File) => void;
  onRemoveImage: (frameId: string) => void;
  onCaptionChange: (frameId: string, caption: string) => void;
  onBackgroundChange: (frameId: string, background: string) => void;
  /** Render in export mode (no controls, plain captions). */
  exporting?: boolean;
}

/**
 * BoardCanvas — the comparison surface. Renders the board's frames in its
 * layout. The forwarded ref points at the capture root so the page can hand it
 * to html2canvas for export.
 */
const BoardCanvas = forwardRef<HTMLDivElement, BoardCanvasProps>(function BoardCanvas(
  { board, imageUrls, isDark, isMobile, onUpload, onRemoveImage, onCaptionChange, onBackgroundChange, exporting = false },
  ref,
) {
  // side-by-side: row on desktop, stacked on mobile. Export always uses a row
  // so the comparison reads left-to-right regardless of the screen it was made on.
  const direction = exporting ? "row" : isMobile ? "column" : "row";

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        flexDirection: direction,
        gap: 16,
        padding: exporting ? 24 : 0,
        background: exporting ? (isDark ? "#000" : "#fafafa") : "transparent",
        width: "100%",
      }}
    >
      {board.frames.map((frame) => (
        <div key={frame.id} style={{ flex: 1, minWidth: 0 }}>
          <FrameCard
            frame={frame}
            imageUrl={frame.imageId ? imageUrls[frame.imageId] : undefined}
            isDark={isDark}
            exporting={exporting}
            onUpload={(file) => onUpload(frame.id, file)}
            onRemoveImage={() => onRemoveImage(frame.id)}
            onCaptionChange={(caption) => onCaptionChange(frame.id, caption)}
            onBackgroundChange={(background) => onBackgroundChange(frame.id, background)}
          />
        </div>
      ))}
    </div>
  );
});

export default BoardCanvas;

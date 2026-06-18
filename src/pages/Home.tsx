import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, App as AntApp } from "antd";
import { PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import html2canvas from "html2canvas";
import { useThemeMode } from "@/lib/theme";
import {
  loadBoard,
  saveBoard,
  saveImage,
  getImageUrl,
  pruneImages,
} from "@/lib/storage";
import { createBoard, type Board } from "@/types";
import BoardCanvas from "@/components/BoardCanvas";

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}

interface HomeProps {
  /** Lets the page hand its header controls up to the Shell header. */
  setHeaderActions: (node: React.ReactNode) => void;
}

export default function Home({ setHeaderActions }: HomeProps) {
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const { message, modal } = AntApp.useApp();
  const vpW = useViewportWidth();
  const isMobile = vpW < 768;

  const [board, setBoard] = useState<Board>(() => loadBoard());
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Persist board metadata whenever it changes.
  useEffect(() => {
    saveBoard(board);
  }, [board]);

  // Resolve object URLs for any image ids referenced by the board that we
  // haven't loaded yet (e.g. on first mount after a refresh).
  useEffect(() => {
    let active = true;
    const needed = board.frames.map((f) => f.imageId).filter((id): id is string => !!id);
    const missing = needed.filter((id) => !imageUrls[id]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => [id, await getImageUrl(id)] as const),
      );
      if (!active) return;
      setImageUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, [board.frames, imageUrls]);

  // Revoke all object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = useCallback(
    async (frameId: string, file: File) => {
      if (!file.type.startsWith("image/")) {
        message.error("Please choose an image file.");
        return;
      }
      const imageId = crypto.randomUUID();
      await saveImage(imageId, file);
      const url = URL.createObjectURL(file);
      setBoard((prev) => {
        const frame = prev.frames.find((f) => f.id === frameId);
        const oldId = frame?.imageId;
        // Revoke the URL of any replaced image.
        if (oldId && imageUrls[oldId]) URL.revokeObjectURL(imageUrls[oldId]);
        return {
          ...prev,
          frames: prev.frames.map((f) => (f.id === frameId ? { ...f, imageId } : f)),
        };
      });
      setImageUrls((prev) => ({ ...prev, [imageId]: url }));
    },
    [imageUrls, message],
  );

  const handleRemoveImage = useCallback(
    (frameId: string) => {
      setBoard((prev) => ({
        ...prev,
        frames: prev.frames.map((f) => (f.id === frameId ? { ...f, imageId: undefined } : f)),
      }));
    },
    [],
  );

  const handleCaptionChange = useCallback((frameId: string, caption: string) => {
    setBoard((prev) => ({
      ...prev,
      frames: prev.frames.map((f) => (f.id === frameId ? { ...f, caption } : f)),
    }));
  }, []);

  const handleNew = useCallback(() => {
    modal.confirm({
      title: "Start a new board?",
      content: "This clears the current photos and captions. This can't be undone.",
      okText: "New board",
      onOk: async () => {
        const fresh = createBoard();
        setBoard(fresh);
        Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
        setImageUrls({});
        await pruneImages([]);
      },
    });
  }, [imageUrls, modal]);

  const hasAnyImage = board.frames.some((f) => f.imageId);

  const handleExport = useCallback(async () => {
    if (!hasAnyImage) {
      message.info("Add at least one photo before exporting.");
      return;
    }
    setExporting(true);
    // Let the offscreen export node render before capturing.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const node = exportRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, {
        backgroundColor: isDark ? "#000000" : "#fafafa",
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "frame-board-comparison.png";
      a.click();
      message.success("Comparison exported");
    } catch (e) {
      console.error(e);
      message.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [hasAnyImage, isDark, message]);

  // Publish header controls to the Shell header.
  const headerActions = useMemo(
    () => (
      <>
        <Button icon={<PlusOutlined />} onClick={handleNew}>
          {isMobile ? "" : "New"}
        </Button>
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
          {isMobile ? "" : "Export"}
        </Button>
      </>
    ),
    [handleNew, handleExport, isMobile],
  );

  useEffect(() => {
    setHeaderActions(headerActions);
    return () => setHeaderActions(null);
  }, [headerActions, setHeaderActions]);

  return (
    <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: 16 }}>
      <BoardCanvas
        board={board}
        imageUrls={imageUrls}
        isDark={isDark}
        isMobile={isMobile}
        onUpload={handleUpload}
        onRemoveImage={handleRemoveImage}
        onCaptionChange={handleCaptionChange}
      />

      {/* Offscreen export render: a clean, row-oriented capture target. */}
      <div style={{ position: "fixed", left: -99999, top: 0, width: 1000, pointerEvents: "none" }} aria-hidden>
        {exporting && (
          <BoardCanvas
            ref={exportRef}
            board={board}
            imageUrls={imageUrls}
            isDark={isDark}
            isMobile={false}
            exporting
            onUpload={() => {}}
            onRemoveImage={() => {}}
            onCaptionChange={() => {}}
          />
        )}
      </div>
    </div>
  );
}

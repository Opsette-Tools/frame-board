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
  // Tracks every object URL we've created, so we can revoke only on real
  // unmount — never as a side effect of state changes (which would blank live
  // <img> tags under React StrictMode's double-invoked effects).
  const urlsRef = useRef<Record<string, string>>({});

  // Persist board metadata whenever it changes.
  useEffect(() => {
    saveBoard(board);
  }, [board]);

  // Resolve object URLs for any image ids referenced by the board that we
  // haven't loaded yet (e.g. on first mount after a refresh). Keyed only on the
  // set of imageIds — NOT on imageUrls — so adding a URL doesn't re-trigger it.
  const imageIdKey = board.frames.map((f) => f.imageId ?? "").join(",");
  useEffect(() => {
    let active = true;
    const needed = board.frames.map((f) => f.imageId).filter((id): id is string => !!id);
    const missing = needed.filter((id) => !urlsRef.current[id]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => [id, await getImageUrl(id)] as const),
      );
      if (!active) return;
      const resolved = entries.filter((e): e is [string, string] => !!e[1]);
      for (const [id, url] of resolved) urlsRef.current[id] = url;
      setImageUrls({ ...urlsRef.current });
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIdKey]);

  // Revoke every created URL only when the page truly unmounts.
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
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
      urlsRef.current[imageId] = url;
      setBoard((prev) => {
        const frame = prev.frames.find((f) => f.id === frameId);
        const oldId = frame?.imageId;
        // Revoke + drop the URL of any replaced image.
        if (oldId && urlsRef.current[oldId]) {
          URL.revokeObjectURL(urlsRef.current[oldId]);
          delete urlsRef.current[oldId];
        }
        return {
          ...prev,
          frames: prev.frames.map((f) => (f.id === frameId ? { ...f, imageId } : f)),
        };
      });
      setImageUrls({ ...urlsRef.current });
    },
    [message],
  );

  const handleRemoveImage = useCallback(
    (frameId: string) => {
      setBoard((prev) => {
        const frame = prev.frames.find((f) => f.id === frameId);
        const oldId = frame?.imageId;
        if (oldId && urlsRef.current[oldId]) {
          URL.revokeObjectURL(urlsRef.current[oldId]);
          delete urlsRef.current[oldId];
        }
        return {
          ...prev,
          frames: prev.frames.map((f) => (f.id === frameId ? { ...f, imageId: undefined } : f)),
        };
      });
      setImageUrls({ ...urlsRef.current });
    },
    [],
  );

  const handleCaptionChange = useCallback((frameId: string, caption: string) => {
    setBoard((prev) => ({
      ...prev,
      frames: prev.frames.map((f) => (f.id === frameId ? { ...f, caption } : f)),
    }));
  }, []);

  const handleBackgroundChange = useCallback((frameId: string, background: string) => {
    setBoard((prev) => ({
      ...prev,
      frames: prev.frames.map((f) => (f.id === frameId ? { ...f, background } : f)),
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
        Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
        urlsRef.current = {};
        setImageUrls({});
        await pruneImages([]);
      },
    });
  }, [modal]);

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
        onBackgroundChange={handleBackgroundChange}
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
            onBackgroundChange={() => {}}
          />
        )}
      </div>
    </div>
  );
}

import { useRef } from "react";
import { Button, ColorPicker, Input, Upload } from "antd";
import { PlusOutlined, SwapOutlined, DeleteOutlined } from "@ant-design/icons";
import { FRAME_BG_PRESETS, type Frame } from "@/types";

interface FrameCardProps {
  frame: Frame;
  /** Object URL for the frame's image, if uploaded. */
  imageUrl?: string;
  isDark: boolean;
  onUpload: (file: File) => void;
  onRemoveImage: () => void;
  onCaptionChange: (caption: string) => void;
  onBackgroundChange: (background: string) => void;
  /** When true (export render), hide interactive controls and show plain text. */
  exporting?: boolean;
}

export default function FrameCard({
  frame,
  imageUrl,
  isDark,
  onUpload,
  onRemoveImage,
  onCaptionChange,
  onBackgroundChange,
  exporting = false,
}: FrameCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const surface = isDark ? "#141414" : "#ffffff";
  const border = isDark ? "#303030" : "#e5e7eb";

  const pickFile = () => fileRef.current?.click();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 12,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          borderRadius: 8,
          overflow: "hidden",
          // The frame's chosen background sits behind the image, so a logo with
          // white/transparent areas reads against it — and bakes into the export.
          background: frame.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={frame.caption}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          !exporting && (
            <Upload.Dragger
              openFileDialogOnClick
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => {
                onUpload(file);
                return false;
              }}
              style={{ width: "100%", height: "100%", border: "none", background: "transparent" }}
            >
              <p style={{ margin: 0 }}>
                <PlusOutlined style={{ fontSize: 24, color: isDark ? "#cfae60" : "#2f4f46" }} />
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: isDark ? "#94A3B8" : "#64748B" }}>
                Click or drop a photo
              </p>
            </Upload.Dragger>
          )
        )}

        {/* Always-visible background picker (hidden only in export render). */}
        {!exporting && (
          <div style={{ position: "absolute", top: 8, left: 8 }}>
            <ColorPicker
              value={frame.background}
              onChangeComplete={(c) => onBackgroundChange(c.toHexString())}
              presets={[{ label: "Backgrounds", colors: FRAME_BG_PRESETS.map((p) => p.color) }]}
              size="small"
              title="Frame background"
            />
          </div>
        )}

        {/* Replace / remove controls when an image is present. */}
        {imageUrl && !exporting && (
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
            <Button size="small" icon={<SwapOutlined />} onClick={pickFile} title="Replace photo" />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={onRemoveImage} title="Remove photo" />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />

      {exporting ? (
        <div
          style={{
            textAlign: "center",
            fontSize: 15,
            fontWeight: 600,
            color: isDark ? "#e5e7eb" : "#1a1a1a",
            padding: "2px 0",
            minHeight: 22,
          }}
        >
          {frame.caption}
        </div>
      ) : (
        <Input
          value={frame.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Caption (e.g. Before, a date, an address…)"
          variant="borderless"
          style={{ textAlign: "center", fontWeight: 600 }}
          maxLength={60}
        />
      )}
    </div>
  );
}

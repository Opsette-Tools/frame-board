import { useEffect, useRef, useState, type RefObject } from "react";
import { Stage, Layer, Image as KImage, Rect, Circle, Group, Text as KText, Line, Transformer } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";
import { PIN_KIND_META, STATUS_META, type Annotation, type ImageSide, type PinKind } from "@/types";

interface Props {
  imageUrl?: string;
  side: ImageSide;
  annotations: Annotation[];
  selectedId: string | null;
  activeTool: string;
  onSelect: (id: string | null) => void;
  onAdd: (a: Annotation) => void;
  onUpdate: (a: Annotation) => void;
  width: number;
  height: number;
  stageRef?: RefObject<Konva.Stage | null>;
  emptyHint?: string;
}

export interface CanvasHandle {
  toDataURL: () => string | undefined;
}

export function MarkupCanvas({
  imageUrl,
  side,
  annotations,
  selectedId,
  activeTool,
  onSelect,
  onAdd,
  onUpdate,
  width,
  height,
  stageRef: externalStageRef,
  emptyHint,
}: Props) {
  const [image] = useImage(imageUrl ?? "", "anonymous");
  const internalStageRef = useRef<Konva.Stage>(null);
  const stageRef = externalStageRef ?? internalStageRef;
  const transformerRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [drawingZone, setDrawingZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Fit image to viewport on load / size change
  useEffect(() => {
    if (!image || !width || !height) return;
    const s = Math.min(width / image.width, height / image.height);
    setScale(s);
    setPos({
      x: (width - image.width * s) / 2,
      y: (height - image.height * s) / 2,
    });
  }, [image, width, height]);

  // Wire transformer to selected zone
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const stage = stageRef.current;
    if (!stage) return;
    const sel = annotations.find((a) => a.id === selectedId);
    if (sel && sel.type === "zone") {
      const node = stage.findOne(`#zone-${sel.id}`);
      if (node) {
        tr.nodes([node as Konva.Node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
  }, [selectedId, annotations, stageRef]);

  const screenToImage = (px: number, py: number) => ({
    x: (px - pos.x) / scale,
    y: (py - pos.y) / scale,
  });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    const clamped = Math.max(0.1, Math.min(8, newScale));
    const mousePointTo = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    };
    setScale(clamped);
    setPos({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (activeTool === "select" || activeTool === "pan") {
      // clicks on empty stage clear selection
      if (e.target === e.target.getStage()) {
        onSelect(null);
      }
      return;
    }
    if (!image) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const { x, y } = screenToImage(pointer.x, pointer.y);

    // Pin placement tools
    const pinTools: Record<string, PinKind> = {
      pin: "standard",
      "pin-numbered": "numbered",
      "pin-warning": "warning",
      "pin-check": "check",
      "pin-issue": "issue",
    };
    if (pinTools[activeTool]) {
      const kind = pinTools[activeTool];
      const existingNumbered = annotations.filter((a) => a.type === "pin" && a.pinKind === "numbered" && a.imageSide === side);
      const ann: Annotation = {
        id: crypto.randomUUID(),
        imageSide: side,
        type: "pin",
        pinKind: kind,
        pinNumber: kind === "numbered" ? existingNumbered.length + 1 : undefined,
        x,
        y,
        title: kind === "numbered" ? `Pin ${existingNumbered.length + 1}` : PIN_KIND_META[kind].label,
        note: "",
        status: kind === "warning" ? "attention" : kind === "check" ? "completed" : kind === "issue" ? "attention" : "included",
        color: PIN_KIND_META[kind].color,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onAdd(ann);
      onSelect(ann.id);
      return;
    }

    if (activeTool === "callout") {
      const ann: Annotation = {
        id: crypto.randomUUID(),
        imageSide: side,
        type: "callout",
        x,
        y,
        labelX: x + 80,
        labelY: y - 60,
        title: "Callout",
        note: "",
        status: "included",
        color: STATUS_META.included.color,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onAdd(ann);
      onSelect(ann.id);
      return;
    }

    if (activeTool === "zone-rect" || activeTool === "zone-rounded") {
      setDrawingZone({ x, y, w: 0, h: 0 });
      return;
    }
  };

  const handleStageMouseMove = () => {
    if (!drawingZone) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const { x, y } = screenToImage(pointer.x, pointer.y);
    setDrawingZone({ ...drawingZone, w: x - drawingZone.x, h: y - drawingZone.y });
  };

  const handleStageMouseUp = () => {
    if (!drawingZone) return;
    const w = Math.abs(drawingZone.w);
    const h = Math.abs(drawingZone.h);
    if (w > 5 && h > 5) {
      const ann: Annotation = {
        id: crypto.randomUUID(),
        imageSide: side,
        type: "zone",
        zoneShape: activeTool === "zone-rounded" ? "roundedRect" : "rect",
        x: drawingZone.w < 0 ? drawingZone.x + drawingZone.w : drawingZone.x,
        y: drawingZone.h < 0 ? drawingZone.y + drawingZone.h : drawingZone.y,
        width: w,
        height: h,
        opacity: 0.25,
        title: "Zone",
        note: "",
        status: "included",
        color: STATUS_META.included.color,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onAdd(ann);
      onSelect(ann.id);
    }
    setDrawingZone(null);
  };

  const isPanMode = activeTool === "select" || activeTool === "pan";

  return (
    <div style={{ width, height, background: "#000", position: "relative", overflow: "hidden", touchAction: "none" }}>
      {!imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            textAlign: "center",
            padding: 24,
            pointerEvents: "none",
          }}
        >
          {emptyHint ?? "Upload an image to start marking up."}
        </div>
      )}
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={isPanMode}
        x={pos.x}
        y={pos.y}
        scaleX={1}
        scaleY={1}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onTouchStart={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onTouchMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchEnd={handleStageMouseUp}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setPos({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>
          {image && (
            <KImage image={image} x={0} y={0} scaleX={scale} scaleY={scale} listening={false} />
          )}

          {/* Zones */}
          {annotations
            .filter((a) => a.type === "zone")
            .map((a) => {
              const statusColor = STATUS_META[a.status].color;
              return (
                <Rect
                  key={a.id}
                  id={`zone-${a.id}`}
                  x={a.x * scale}
                  y={a.y * scale}
                  width={(a.width ?? 0) * scale}
                  height={(a.height ?? 0) * scale}
                  fill={statusColor}
                  opacity={a.opacity ?? 0.25}
                  stroke={a.status === "excluded" ? "#8c8c8c" : statusColor}
                  strokeWidth={selectedId === a.id ? 3 : 2}
                  dash={a.status === "excluded" ? [8, 4] : a.status === "optional" ? [4, 4] : undefined}
                  cornerRadius={a.zoneShape === "roundedRect" ? 16 : 0}
                  draggable={isPanMode}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                  onDragEnd={(e) => {
                    onUpdate({
                      ...a,
                      x: e.target.x() / scale,
                      y: e.target.y() / scale,
                      updatedAt: Date.now(),
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Rect;
                    const sx = node.scaleX();
                    const sy = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdate({
                      ...a,
                      x: node.x() / scale,
                      y: node.y() / scale,
                      width: (node.width() * sx) / scale,
                      height: (node.height() * sy) / scale,
                      updatedAt: Date.now(),
                    });
                  }}
                />
              );
            })}

          {/* Drawing preview */}
          {drawingZone && (
            <Rect
              x={(drawingZone.w < 0 ? drawingZone.x + drawingZone.w : drawingZone.x) * scale}
              y={(drawingZone.h < 0 ? drawingZone.y + drawingZone.h : drawingZone.y) * scale}
              width={Math.abs(drawingZone.w) * scale}
              height={Math.abs(drawingZone.h) * scale}
              fill={STATUS_META.included.color}
              opacity={0.2}
              stroke={STATUS_META.included.color}
              strokeWidth={2}
              dash={[4, 4]}
              listening={false}
              cornerRadius={activeTool === "zone-rounded" ? 16 : 0}
            />
          )}

          {/* Callouts */}
          {annotations
            .filter((a) => a.type === "callout")
            .map((a) => {
              const sx = a.x * scale;
              const sy = a.y * scale;
              const lx = (a.labelX ?? a.x + 80) * scale;
              const ly = (a.labelY ?? a.y - 40) * scale;
              const statusColor = STATUS_META[a.status].color;
              const text = a.title || "Callout";
              const padding = 6;
              const charWidth = 7;
              const boxW = Math.min(220, Math.max(60, text.length * charWidth + padding * 2));
              const boxH = 26;
              return (
                <Group
                  key={a.id}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                >
                  <Line
                    points={[sx, sy, lx + boxW / 2, ly + boxH / 2]}
                    stroke={statusColor}
                    strokeWidth={selectedId === a.id ? 2.5 : 1.5}
                    listening={false}
                  />
                  <Circle
                    x={sx}
                    y={sy}
                    radius={5}
                    fill={statusColor}
                    stroke="#fff"
                    strokeWidth={1.5}
                    draggable={isPanMode}
                    onDragEnd={(e) => {
                      onUpdate({ ...a, x: e.target.x() / scale, y: e.target.y() / scale, updatedAt: Date.now() });
                    }}
                  />
                  <Group
                    x={lx}
                    y={ly}
                    draggable={isPanMode}
                    onDragEnd={(e) => {
                      onUpdate({ ...a, labelX: e.target.x() / scale, labelY: e.target.y() / scale, updatedAt: Date.now() });
                    }}
                  >
                    <Rect
                      width={boxW}
                      height={boxH}
                      fill={statusColor}
                      cornerRadius={6}
                      stroke={selectedId === a.id ? "#fff" : "transparent"}
                      strokeWidth={2}
                    />
                    <KText
                      text={text}
                      width={boxW}
                      height={boxH}
                      align="center"
                      verticalAlign="middle"
                      fill="#fff"
                      fontSize={13}
                      fontStyle="bold"
                      padding={padding}
                      ellipsis
                      wrap="none"
                    />
                  </Group>
                </Group>
              );
            })}

          {/* Pins */}
          {annotations
            .filter((a) => a.type === "pin")
            .map((a) => {
              const sx = a.x * scale;
              const sy = a.y * scale;
              const statusColor = a.status !== "included" ? STATUS_META[a.status].color : a.color;
              const isSelected = selectedId === a.id;
              return (
                <Group
                  key={a.id}
                  x={sx}
                  y={sy}
                  draggable={isPanMode}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelect(a.id);
                  }}
                  onDragEnd={(e) => {
                    onUpdate({ ...a, x: e.target.x() / scale, y: e.target.y() / scale, updatedAt: Date.now() });
                  }}
                >
                  <Circle
                    radius={isSelected ? 16 : 14}
                    fill={statusColor}
                    stroke="#fff"
                    strokeWidth={isSelected ? 3 : 2}
                    shadowColor="black"
                    shadowBlur={4}
                    shadowOpacity={0.4}
                  />
                  {a.pinKind === "numbered" && (
                    <KText
                      text={String(a.pinNumber ?? "")}
                      fontSize={14}
                      fontStyle="bold"
                      fill="#fff"
                      width={32}
                      height={32}
                      offsetX={16}
                      offsetY={16}
                      align="center"
                      verticalAlign="middle"
                    />
                  )}
                  {a.pinKind === "warning" && (
                    <KText text="!" fontSize={18} fontStyle="bold" fill="#fff" width={32} height={32} offsetX={16} offsetY={16} align="center" verticalAlign="middle" />
                  )}
                  {a.pinKind === "check" && (
                    <KText text="✓" fontSize={16} fontStyle="bold" fill="#fff" width={32} height={32} offsetX={16} offsetY={16} align="center" verticalAlign="middle" />
                  )}
                  {a.pinKind === "issue" && (
                    <KText text="✕" fontSize={16} fontStyle="bold" fill="#fff" width={32} height={32} offsetX={16} offsetY={16} align="center" verticalAlign="middle" />
                  )}
                </Group>
              );
            })}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            anchorSize={10}
            borderStroke="#1677ff"
            anchorStroke="#1677ff"
            anchorFill="#fff"
          />
        </Layer>
      </Stage>
    </div>
  );
}

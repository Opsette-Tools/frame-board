import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Layout,
  Button,
  Segmented,
  Space,
  Typography,
  Upload,
  Drawer,
  Dropdown,
  FloatButton,
  Tooltip,
  Spin,
  App as AntApp,
} from "antd";
import {
  ArrowLeftOutlined,
  UploadOutlined,
  BulbOutlined,
  BulbFilled,
  ExportOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  BorderOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined,
  NumberOutlined,
  SelectOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type Konva from "konva";
import jsPDF from "jspdf";
import { getProject, saveProject, saveImage, getImageUrl, exportProjectJson } from "@/lib/storage";
import { STATUS_META, type Annotation, type ImageSide, type Project } from "@/types";
import { useThemeMode } from "@/lib/theme";
import { MarkupCanvas } from "@/components/MarkupCanvas";
import { NotesPanel } from "@/components/NotesPanel";
import { AnnotationEditor } from "@/components/AnnotationEditor";

const { Header, Content } = Layout;
const { Title } = Typography;

type ViewMode = "before" | "after" | "compare";

function useDebouncedSave(project: Project | null) {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!project) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveProject({ ...project, updatedAt: Date.now() });
    }, 400);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [project]);
}

function useViewportSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode, toggle } = useThemeMode();
  const { message, modal } = AntApp.useApp();
  const { w: vpW } = useViewportSize();
  const isMobile = vpW < 768;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("before");
  const [activeTool, setActiveTool] = useState<string>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [beforeUrl, setBeforeUrl] = useState<string | undefined>();
  const [afterUrl, setAfterUrl] = useState<string | undefined>();
  const beforeStageRef = useRef<Konva.Stage>(null);
  const afterStageRef = useRef<Konva.Stage>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  useDebouncedSave(project);

  // Load project + image URLs
  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const p = await getProject(id);
      if (!active) return;
      if (!p) {
        message.error("Project not found");
        navigate("/");
        return;
      }
      setProject(p);
      setLoading(false);
      const [b, a] = await Promise.all([getImageUrl(p.beforeImageId), getImageUrl(p.afterImageId)]);
      if (!active) return;
      setBeforeUrl(b);
      setAfterUrl(a);
    })();
    return () => {
      active = false;
    };
  }, [id, navigate, message]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      if (afterUrl) URL.revokeObjectURL(afterUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track canvas container size
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const el = canvasContainerRef.current;
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [view, isMobile, loading]);

  const updateProject = useCallback((updater: (p: Project) => Project) => {
    setProject((prev) => (prev ? updater(prev) : prev));
  }, []);

  const upsertAnnotation = useCallback(
    (a: Annotation) => {
      updateProject((p) => {
        const exists = p.annotations.some((x) => x.id === a.id);
        return {
          ...p,
          annotations: exists
            ? p.annotations.map((x) => (x.id === a.id ? a : x))
            : [...p.annotations, a],
        };
      });
    },
    [updateProject],
  );

  const deleteAnnotation = useCallback(
    (annId: string) => {
      updateProject((p) => ({ ...p, annotations: p.annotations.filter((x) => x.id !== annId) }));
      setSelectedId((cur) => (cur === annId ? null : cur));
    },
    [updateProject],
  );

  const duplicateAnnotation = useCallback(
    (a: Annotation) => {
      const copy: Annotation = { ...a, id: crypto.randomUUID(), x: a.x + 20, y: a.y + 20, createdAt: Date.now(), updatedAt: Date.now() };
      updateProject((p) => ({ ...p, annotations: [...p.annotations, copy] }));
      setSelectedId(copy.id);
    },
    [updateProject],
  );

  const handleUpload = async (side: ImageSide, file: File) => {
    if (!project) return;
    const imgId = crypto.randomUUID();
    await saveImage(imgId, file);
    const url = URL.createObjectURL(file);
    if (side === "before") {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      setBeforeUrl(url);
      updateProject((p) => ({ ...p, beforeImageId: imgId }));
    } else {
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      setAfterUrl(url);
      updateProject((p) => ({ ...p, afterImageId: imgId }));
    }
    return false; // prevent antd auto upload
  };

  const handleSelect = useCallback((annId: string | null) => {
    setSelectedId(annId);
  }, []);

  const handleEditFromNotes = useCallback((a: Annotation) => {
    setSelectedId(a.id);
    setEditorOpen(true);
  }, []);

  // Open editor when an annotation is selected via canvas tap (only if select tool)
  useEffect(() => {
    if (selectedId && (activeTool === "select")) {
      // mobile: don't auto-open; open via double-tap or notes
    }
  }, [selectedId, activeTool]);

  const selected = useMemo(
    () => project?.annotations.find((a) => a.id === selectedId) ?? null,
    [project, selectedId],
  );

  const visibleAnnotations = useMemo(() => {
    if (!project) return [];
    if (view === "compare") return project.annotations;
    return project.annotations.filter((a) => a.imageSide === view);
  }, [project, view]);

  // Export helpers
  const exportPng = () => {
    const stage = view === "after" ? afterStageRef.current : beforeStageRef.current;
    const target = view === "compare" ? null : stage;
    if (!target) {
      // Compare: render side-by-side
      exportComparePng();
      return;
    }
    const url = target.toDataURL({ pixelRatio: 2 });
    downloadDataUrl(url, `${project?.name ?? "project"}-${view}.png`);
  };

  const exportComparePng = async () => {
    const b = beforeStageRef.current?.toCanvas({ pixelRatio: 2 });
    const a = afterStageRef.current?.toCanvas({ pixelRatio: 2 });
    if (!b && !a) {
      message.warning("Nothing to export");
      return;
    }
    const w = (b?.width ?? 0) + (a?.width ?? 0) + 20;
    const h = Math.max(b?.height ?? 0, a?.height ?? 0);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (b) ctx.drawImage(b, 0, 0);
    if (a) ctx.drawImage(a, (b?.width ?? 0) + 20, 0);
    const url = canvas.toDataURL("image/png");
    downloadDataUrl(url, `${project?.name ?? "project"}-compare.png`);
  };

  const exportPdf = async () => {
    if (!project) return;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const stage = view === "after" ? afterStageRef.current : beforeStageRef.current;
    if (stage) {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));
      const ratio = Math.min((pageW - 40) / img.width, (pageH - 80) / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      pdf.setFontSize(14);
      pdf.text(project.name, 20, 28);
      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, 50, w, h);
    }
    if (project.annotations.length > 0) {
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text(`${project.name} — Notes`, 20, 36);
      pdf.setFontSize(11);
      let y = 60;
      project.annotations.forEach((a, idx) => {
        if (y > pageH - 40) {
          pdf.addPage();
          y = 40;
        }
        const header = `${idx + 1}. [${a.imageSide.toUpperCase()}] ${a.type.toUpperCase()} — ${a.title || "Untitled"} (${STATUS_META[a.status].label})`;
        pdf.text(header, 20, y);
        y += 16;
        if (a.note) {
          const wrapped = pdf.splitTextToSize(a.note, pageW - 60);
          pdf.text(wrapped, 32, y);
          y += wrapped.length * 14 + 6;
        }
      });
    }
    pdf.save(`${project.name}.pdf`);
  };

  const exportJson = async () => {
    if (!project) return;
    const json = await exportProjectJson(project.id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${project.name}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading || !project) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const renderUploadButton = (side: ImageSide) => (
    <Upload
      accept="image/*"
      beforeUpload={(f) => handleUpload(side, f)}
      showUploadList={false}
    >
      <Button icon={<UploadOutlined />} size="small">
        {(side === "before" ? beforeUrl : afterUrl) ? "Replace" : "Upload"} {side}
      </Button>
    </Upload>
  );

  const toolItems = [
    { key: "select", icon: <SelectOutlined />, label: "Select / pan" },
    { key: "pin", icon: <EnvironmentOutlined style={{ color: "#1677ff" }} />, label: "Pin" },
    { key: "pin-numbered", icon: <NumberOutlined style={{ color: "#1677ff" }} />, label: "Numbered pin" },
    { key: "pin-warning", icon: <WarningOutlined style={{ color: "#faad14" }} />, label: "Warning" },
    { key: "pin-check", icon: <CheckOutlined style={{ color: "#52c41a" }} />, label: "Complete" },
    { key: "pin-issue", icon: <CloseOutlined style={{ color: "#ff4d4f" }} />, label: "Issue" },
    { key: "callout", icon: <MessageOutlined />, label: "Callout" },
    { key: "zone-rect", icon: <BorderOutlined />, label: "Zone (rect)" },
    { key: "zone-rounded", icon: <BorderOutlined style={{ transform: "rotate(45deg)" }} />, label: "Zone (rounded)" },
  ];

  const sideLabel = (side: ImageSide) =>
    side === "before" ? "Before" : "After";

  const compareLayout = isMobile ? "column" : "row";

  return (
    <Layout style={{ height: "100dvh", overflow: "hidden" }}>
      <Header
        style={{
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 10,
          flexWrap: "nowrap",
        }}
      >
        <Link to="/">
          <Button type="text" icon={<ArrowLeftOutlined style={{ color: "#fff" }} />} />
        </Link>
        <Title level={5} style={{ color: "#fff", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </Title>
        <Segmented
          size={isMobile ? "small" : "middle"}
          value={view}
          onChange={(v) => { setView(v as ViewMode); setSelectedId(null); }}
          options={[
            { label: "Before", value: "before" },
            { label: "After", value: "after" },
            { label: "Compare", value: "compare" },
          ]}
        />
        <Tooltip title={mode === "dark" ? "Light" : "Dark"}>
          <Button
            type="text"
            icon={mode === "dark" ? <BulbFilled style={{ color: "#fff" }} /> : <BulbOutlined style={{ color: "#fff" }} />}
            onClick={toggle}
          />
        </Tooltip>
        <Dropdown
          menu={{
            items: [
              { key: "png", label: "Export PNG (current view)", onClick: exportPng },
              { key: "compare", label: "Export comparison PNG", onClick: exportComparePng },
              { key: "pdf", label: "Export PDF", onClick: exportPdf },
              { type: "divider" },
              { key: "json", label: "Export project JSON", onClick: exportJson },
            ],
          }}
        >
          <Button type="primary" icon={<ExportOutlined />}>{isMobile ? "" : "Export"}</Button>
        </Dropdown>
      </Header>

      <Layout style={{ flex: 1, minHeight: 0 }}>
        <Content style={{ display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
          {/* Side upload toolbars */}
          <div style={{ display: "flex", padding: 8, gap: 8, justifyContent: "center", background: "var(--ant-color-bg-elevated, transparent)", borderBottom: "1px solid rgba(127,127,127,0.2)" }}>
            {(view === "before" || view === "compare") && renderUploadButton("before")}
            {(view === "after" || view === "compare") && renderUploadButton("after")}
          </div>

          <div
            ref={canvasContainerRef}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: view === "compare" ? compareLayout : "row",
              gap: view === "compare" ? 4 : 0,
              background: "#000",
            }}
          >
            {view === "before" && (
              <MarkupCanvas
                imageUrl={beforeUrl}
                side="before"
                annotations={visibleAnnotations}
                selectedId={selectedId}
                activeTool={activeTool}
                onSelect={handleSelect}
                onAdd={upsertAnnotation}
                onUpdate={upsertAnnotation}
                width={canvasSize.w}
                height={canvasSize.h}
                stageRef={beforeStageRef}
                emptyHint="Upload a before image to start marking up."
              />
            )}
            {view === "after" && (
              <MarkupCanvas
                imageUrl={afterUrl}
                side="after"
                annotations={visibleAnnotations}
                selectedId={selectedId}
                activeTool={activeTool}
                onSelect={handleSelect}
                onAdd={upsertAnnotation}
                onUpdate={upsertAnnotation}
                width={canvasSize.w}
                height={canvasSize.h}
                stageRef={afterStageRef}
                emptyHint="Upload an after image to start marking up."
              />
            )}
            {view === "compare" && (
              <>
                <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                  <div style={{ position: "absolute", top: 6, left: 8, zIndex: 2, color: "#fff", fontSize: 12, padding: "2px 8px", background: "rgba(0,0,0,0.5)", borderRadius: 4 }}>
                    {sideLabel("before")}
                  </div>
                  <MarkupCanvas
                    imageUrl={beforeUrl}
                    side="before"
                    annotations={project.annotations.filter((a) => a.imageSide === "before")}
                    selectedId={selectedId}
                    activeTool={activeTool}
                    onSelect={handleSelect}
                    onAdd={upsertAnnotation}
                    onUpdate={upsertAnnotation}
                    width={isMobile ? canvasSize.w : Math.floor((canvasSize.w - 4) / 2)}
                    height={isMobile ? Math.floor((canvasSize.h - 4) / 2) : canvasSize.h}
                    stageRef={beforeStageRef}
                    emptyHint="Upload a before image."
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                  <div style={{ position: "absolute", top: 6, left: 8, zIndex: 2, color: "#fff", fontSize: 12, padding: "2px 8px", background: "rgba(0,0,0,0.5)", borderRadius: 4 }}>
                    {sideLabel("after")}
                  </div>
                  <MarkupCanvas
                    imageUrl={afterUrl}
                    side="after"
                    annotations={project.annotations.filter((a) => a.imageSide === "after")}
                    selectedId={selectedId}
                    activeTool={activeTool}
                    onSelect={handleSelect}
                    onAdd={upsertAnnotation}
                    onUpdate={upsertAnnotation}
                    width={isMobile ? canvasSize.w : Math.floor((canvasSize.w - 4) / 2)}
                    height={isMobile ? Math.floor((canvasSize.h - 4) / 2) : canvasSize.h}
                    stageRef={afterStageRef}
                    emptyHint="Upload an after image."
                  />
                </div>
              </>
            )}
          </div>

          {/* Floating tools */}
          <FloatButton.Group
            shape="square"
            style={{ insetInlineEnd: 16, insetBlockEnd: 80 }}
            trigger="click"
            icon={<SelectOutlined />}
            tooltip={<div>Tools</div>}
          >
            {toolItems.map((t) => (
              <FloatButton
                key={t.key}
                icon={t.icon}
                tooltip={<div>{t.label}{activeTool === t.key ? " (active)" : ""}</div>}
                type={activeTool === t.key ? "primary" : "default"}
                onClick={() => setActiveTool(t.key)}
              />
            ))}
          </FloatButton.Group>

          <FloatButton
            icon={<UnorderedListOutlined />}
            type="primary"
            tooltip={<div>Notes</div>}
            style={{ insetInlineEnd: 16, insetBlockEnd: 24 }}
            onClick={() => {
              if (selected) setEditorOpen(true);
              else setNotesOpen(true);
            }}
          />

          {/* Edit selected via FAB when something is selected */}
          {selected && (
            <FloatButton
              icon={<EnvironmentOutlined />}
              tooltip={<div>Edit selected</div>}
              style={{ insetInlineEnd: 76, insetBlockEnd: 24 }}
              onClick={() => setEditorOpen(true)}
            />
          )}

          {/* Zoom hint buttons */}
          <Space style={{ position: "absolute", left: 12, bottom: 12 }}>
            <Tooltip title="Tip: pinch / scroll to zoom, drag to pan in Select mode">
              <Button shape="circle" icon={<ZoomInOutlined />} size="small" />
            </Tooltip>
            <Tooltip title="Use the Select tool to drag annotations">
              <Button shape="circle" icon={<ZoomOutOutlined />} size="small" />
            </Tooltip>
          </Space>
        </Content>

        {/* Desktop side notes panel */}
        {!isMobile && (
          <div style={{ width: 320, borderInlineStart: "1px solid rgba(127,127,127,0.2)", overflow: "auto", background: "var(--ant-color-bg-container)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(127,127,127,0.2)" }}>
              <Title level={5} style={{ margin: 0 }}>Notes</Title>
            </div>
            <NotesPanel
              annotations={project.annotations}
              selectedId={selectedId}
              onSelect={(annId) => {
                const a = project.annotations.find((x) => x.id === annId);
                if (a && view !== "compare" && a.imageSide !== view) {
                  setView(a.imageSide);
                }
                setSelectedId(annId);
              }}
              onEdit={handleEditFromNotes}
              onDelete={(annId) => {
                modal.confirm({
                  title: "Delete annotation?",
                  okText: "Delete",
                  okType: "danger",
                  onOk: () => deleteAnnotation(annId),
                });
              }}
              groupBySide
            />
          </div>
        )}
      </Layout>

      {/* Mobile notes drawer */}
      <Drawer
        title="Notes"
        placement="bottom"
        height="70%"
        open={notesOpen && isMobile}
        onClose={() => setNotesOpen(false)}
      >
        <NotesPanel
          annotations={project.annotations}
          selectedId={selectedId}
          onSelect={(annId) => {
            const a = project.annotations.find((x) => x.id === annId);
            if (a && view !== "compare" && a.imageSide !== view) {
              setView(a.imageSide);
            }
            setSelectedId(annId);
            setNotesOpen(false);
          }}
          onEdit={(a) => {
            setNotesOpen(false);
            handleEditFromNotes(a);
          }}
          onDelete={(annId) => {
            modal.confirm({
              title: "Delete annotation?",
              okText: "Delete",
              okType: "danger",
              onOk: () => deleteAnnotation(annId),
            });
          }}
          groupBySide
        />
      </Drawer>

      <AnnotationEditor
        open={editorOpen && !!selected}
        annotation={selected}
        onClose={() => setEditorOpen(false)}
        onSave={(a) => {
          upsertAnnotation(a);
          setEditorOpen(false);
        }}
        onDelete={(annId) => {
          deleteAnnotation(annId);
          setEditorOpen(false);
        }}
        onDuplicate={(a) => {
          duplicateAnnotation(a);
          setEditorOpen(false);
        }}
      />
    </Layout>
  );
}

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

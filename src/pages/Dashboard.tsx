import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Dropdown,
  Space,
  Typography,
  Tooltip,
  App as AntApp,
} from "antd";
import { PlusOutlined, MoreOutlined, ImportOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  listProjects,
  saveProject,
  deleteProject,
  duplicateProject,
  getImageUrl,
  importProjectJson,
} from "@/lib/storage";
import { PROJECT_TYPES, type Project, type ProjectType } from "@/types";

dayjs.extend(relativeTime);

const { Text } = Typography;

interface CardWithThumb extends Project {
  thumbUrl?: string;
}

export default function Dashboard() {
  const { message, modal } = AntApp.useApp();
  const [projects, setProjects] = useState<CardWithThumb[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [form] = Form.useForm();
  const [renameForm] = Form.useForm();
  const importInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const items = await listProjects();
    const withThumbs: CardWithThumb[] = await Promise.all(
      items.map(async (p) => ({
        ...p,
        thumbUrl: await getImageUrl(p.beforeImageId ?? p.afterImageId),
      })),
    );
    setProjects(withThumbs);
  };

  useEffect(() => {
    refresh();
    return () => {
      // revoke any blob urls on unmount
      projects.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const project: Project = {
      id: crypto.randomUUID(),
      name: values.name,
      type: values.type as ProjectType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      annotations: [],
    };
    await saveProject(project);
    setCreateOpen(false);
    form.resetFields();
    message.success("Project created");
    refresh();
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const values = await renameForm.validateFields();
    const updated = { ...renameTarget, name: values.name, updatedAt: Date.now() };
    await saveProject(updated);
    setRenameTarget(null);
    refresh();
  };

  const handleDelete = (p: Project) => {
    modal.confirm({
      title: `Delete "${p.name}"?`,
      content: "This will permanently remove the project and its images.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        await deleteProject(p.id);
        message.success("Project deleted");
        refresh();
      },
    });
  };

  const handleDuplicate = async (p: Project) => {
    await duplicateProject(p.id);
    message.success("Project duplicated");
    refresh();
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      await importProjectJson(text);
      message.success("Project imported");
      refresh();
    } catch (e) {
      message.error("Failed to import project");
      console.error(e);
    }
  };

  const typeLabel = (t: ProjectType) =>
    PROJECT_TYPES.find((pt) => pt.value === t)?.label ?? t;

  return (
    <>
      <div
        style={{
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
          padding: "16px 16px 0",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Tooltip title="Import JSON">
          <Button icon={<ImportOutlined />} onClick={handleImportClick} />
        </Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ padding: "16px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {projects.length === 0 ? (
          <Empty
            description="No projects yet. Create one to get started."
            style={{ padding: "48px 0" }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          </Empty>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {projects.map((p) => (
              <Card
                key={p.id}
                hoverable
                styles={{ body: { padding: 12 } }}
                cover={
                  <Link to={`/project/${p.id}`}>
                    <div
                      style={{
                        height: 160,
                        background: p.thumbUrl
                          ? `center/cover no-repeat url(${p.thumbUrl})`
                          : "linear-gradient(135deg,#e6f4ff,#bae0ff)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#69b1ff",
                        fontSize: 14,
                      }}
                    >
                      {!p.thumbUrl && "No image yet"}
                    </div>
                  </Link>
                }
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link to={`/project/${p.id}`} style={{ color: "inherit" }}>
                      <Text strong ellipsis style={{ display: "block" }}>
                        {p.name}
                      </Text>
                    </Link>
                    <Space size={4} wrap style={{ marginTop: 4 }}>
                      <Tag color="blue" style={{ marginRight: 0 }}>
                        {typeLabel(p.type)}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Updated {dayjs(p.updatedAt).fromNow()}
                      </Text>
                    </Space>
                  </div>
                  <Dropdown
                    menu={{
                      items: [
                        { key: "open", label: <Link to={`/project/${p.id}`}>Open</Link> },
                        { key: "rename", label: "Rename", onClick: () => { setRenameTarget(p); renameForm.setFieldsValue({ name: p.name }); } },
                        { key: "duplicate", label: "Duplicate", onClick: () => handleDuplicate(p) },
                        { type: "divider" },
                        { key: "delete", label: "Delete", danger: true, onClick: () => handleDelete(p) },
                      ],
                    }}
                    trigger={["click"]}
                  >
                    <Button type="text" icon={<MoreOutlined />} />
                  </Dropdown>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="New project"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="Create"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ type: "general" }}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="e.g. 123 Maple St – Front Yard" autoFocus />
          </Form.Item>
          <Form.Item label="Project type" name="type" rules={[{ required: true }]}>
            <Select options={PROJECT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Rename project"
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={handleRename}
        okText="Save"
        destroyOnClose
      >
        <Form form={renameForm} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

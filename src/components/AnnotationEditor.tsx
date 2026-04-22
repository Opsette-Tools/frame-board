import { Drawer, Form, Input, Select, Slider, Button, Space, Popconfirm } from "antd";
import { useEffect } from "react";
import { STATUS_META, type Annotation, type AnnotationStatus } from "@/types";

interface Props {
  open: boolean;
  annotation: Annotation | null;
  onClose: () => void;
  onSave: (a: Annotation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (a: Annotation) => void;
}

export function AnnotationEditor({ open, annotation, onClose, onSave, onDelete, onDuplicate }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (annotation) {
      form.setFieldsValue({
        title: annotation.title,
        note: annotation.note,
        status: annotation.status,
        opacity: Math.round((annotation.opacity ?? 0.25) * 100),
      });
    }
  }, [annotation, form]);

  if (!annotation) return null;

  const handleSave = async () => {
    const v = await form.validateFields();
    onSave({
      ...annotation,
      title: v.title,
      note: v.note ?? "",
      status: v.status as AnnotationStatus,
      color: STATUS_META[v.status as AnnotationStatus].color,
      opacity: annotation.type === "zone" ? (v.opacity ?? 25) / 100 : annotation.opacity,
      updatedAt: Date.now(),
    });
  };

  return (
    <Drawer
      title={`Edit ${annotation.type}`}
      open={open}
      onClose={onClose}
      placement="right"
      width={Math.min(380, typeof window !== "undefined" ? window.innerWidth : 380)}
      extra={
        <Space>
          <Button onClick={() => onDuplicate(annotation)}>Duplicate</Button>
          <Popconfirm title="Delete this annotation?" onConfirm={() => onDelete(annotation.id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button danger>Delete</Button>
          </Popconfirm>
        </Space>
      }
      footer={
        <div style={{ textAlign: "right" }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>Save</Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Title" name="title" rules={[{ required: true }]}>
          <Input placeholder="Short label" />
        </Form.Item>
        <Form.Item label="Note" name="note">
          <Input.TextArea rows={4} placeholder="Details, context, instructions…" />
        </Form.Item>
        <Form.Item label="Status" name="status">
          <Select
            options={(Object.keys(STATUS_META) as AnnotationStatus[]).map((k) => ({
              value: k,
              label: STATUS_META[k].label,
            }))}
          />
        </Form.Item>
        {annotation.type === "zone" && (
          <Form.Item label="Fill opacity" name="opacity">
            <Slider min={5} max={80} />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}

import { List, Badge, Empty, Tag, Typography, Button, Space } from "antd";
import { EnvironmentOutlined, MessageOutlined, BorderOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { STATUS_META, type Annotation } from "@/types";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (a: Annotation) => void;
  onDelete: (id: string) => void;
  groupBySide?: boolean;
}

const { Text } = Typography;

function iconFor(a: Annotation) {
  if (a.type === "zone") return <BorderOutlined />;
  if (a.type === "callout") return <MessageOutlined />;
  return <EnvironmentOutlined />;
}

function NotesGroup({ items, selectedId, onSelect, onEdit, onDelete, label }: Props & { items: Annotation[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      {label && (
        <Text type="secondary" style={{ display: "block", padding: "8px 12px 4px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </Text>
      )}
      <List
        size="small"
        dataSource={items}
        renderItem={(a) => {
          const isSelected = a.id === selectedId;
          return (
            <List.Item
              onClick={() => onSelect(a.id)}
              style={{
                cursor: "pointer",
                background: isSelected ? "rgba(22,119,255,0.12)" : undefined,
                padding: "8px 12px",
              }}
              actions={[
                <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); onEdit(a); }} />,
                <Button key="del" type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <span style={{ color: STATUS_META[a.status].color, fontSize: 18 }}>
                    {iconFor(a)}
                  </span>
                }
                title={
                  <Space size={4} style={{ flexWrap: "wrap" }}>
                    <span>{a.title || "Untitled"}</span>
                    <Badge color={STATUS_META[a.status].color} text={<Text type="secondary" style={{ fontSize: 11 }}>{STATUS_META[a.status].label}</Text>} />
                  </Space>
                }
                description={
                  <div>
                    {a.note ? <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{a.note}</Text> : null}
                    {a.type === "pin" && a.pinKind === "numbered" && (
                      <Tag color="blue" style={{ marginTop: 4 }}>#{a.pinNumber}</Tag>
                    )}
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}

export function NotesPanel({ annotations, selectedId, onSelect, onEdit, onDelete, groupBySide }: Props) {
  if (annotations.length === 0) {
    return <Empty description="No annotations yet" style={{ padding: 24 }} />;
  }

  if (groupBySide) {
    const before = annotations.filter((a) => a.imageSide === "before");
    const after = annotations.filter((a) => a.imageSide === "after");
    return (
      <div>
        <NotesGroup label="Before" items={before} annotations={before} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
        <NotesGroup label="After" items={after} annotations={after} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
      </div>
    );
  }

  return (
    <NotesGroup items={annotations} annotations={annotations} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
  );
}

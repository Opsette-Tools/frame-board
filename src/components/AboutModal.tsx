import { Modal, Typography } from "antd";
import { OpsetteFooterLogo } from "@/components/opsette-share";

const { Paragraph, Title } = Typography;

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="About Frame Board">
      <Title level={5} style={{ marginTop: 0 }}>A business tool from Opsette</Title>
      <Paragraph>
        Frame Board lets you place before &amp; after photos side by side — or in
        a grid — and export a clean comparison image to share with clients.
      </Paragraph>
      <Paragraph>
        Upload your photos, pick a layout, add a short caption to each frame, and
        download the finished comparison. Great for cleaning walkthroughs,
        landscaping scopes, renovations, organizing projects, and progress shots.
      </Paragraph>
      <OpsetteFooterLogo />
    </Modal>
  );
}

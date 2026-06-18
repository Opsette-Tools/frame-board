import { Modal, Typography } from "antd";
import { OpsetteFooterLogo } from "@/components/opsette-share";

const { Paragraph, Title } = Typography;

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PrivacyModal({ open, onClose }: PrivacyModalProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Privacy">
      <Title level={5} style={{ marginTop: 0 }}>Your photos stay on your device</Title>
      <Paragraph>
        Your images and boards are stored locally in your browser. Nothing is
        uploaded to a server, and your photos never leave your device.
      </Paragraph>
      <Paragraph>
        No cookies, no tracking, no analytics, no account required.
      </Paragraph>
      <OpsetteFooterLogo />
    </Modal>
  );
}

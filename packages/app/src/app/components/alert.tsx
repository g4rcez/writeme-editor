import { Button, Modal } from "@g4rcez/components";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";

type AlertType = "info" | "success" | "error";

interface AlertProps {
  title?: string;
  message: string;
  type?: AlertType;
  open: boolean;
  onClose: () => void;
}

export const Alert = ({
  title,
  message,
  type = "info",
  open,
  onClose,
}: AlertProps) => {
  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircleIcon className="text-success" size={24} />;
      case "error":
        return <WarningCircleIcon className="text-danger" size={24} />;
      default:
        return <InfoIcon className="text-info" size={24} />;
    }
  };

  return (
    <Modal
      open={open}
      onChange={onClose}
      title={title || type.charAt(0).toUpperCase() + type.slice(1)}
      className="max-w-sm"
    >
      <div className="flex flex-col gap-4 p-6 items-center text-center">
        {getIcon()}
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={onClose} className="mt-2 w-full">
          OK
        </Button>
      </div>
    </Modal>
  );
};

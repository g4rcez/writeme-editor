import { Modal, Button } from "@g4rcez/components";
import { HelpCircle } from "lucide-react";

interface ConfirmProps {
  title?: string;
  message: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "primary";
}

export const Confirm = ({
  title = "Confirm",
  message,
  open,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "primary",
}: ConfirmProps) => {
  return (
    <Modal open={open} onChange={onCancel} title={title} className="max-w-sm">
      <div className="flex flex-col gap-4 p-6 items-center text-center">
        <HelpCircle className="text-primary" size={24} />
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2 w-full mt-4">
          <Button theme="muted" onClick={onCancel} className="flex-1">
            {cancelText}
          </Button>
          <Button
            theme={type === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

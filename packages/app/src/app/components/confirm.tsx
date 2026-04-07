import { Modal, Button } from "@g4rcez/components";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";

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
  open,
  message,
  onCancel,
  onConfirm,
  type = "primary",
  title = "Confirm",
  cancelText = "Cancel",
  confirmText = "Confirm",
}: ConfirmProps) => {
  return (
    <Modal open={open} onChange={onCancel} title={title} className="max-w-sm">
      <div className="flex flex-col gap-4 items-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2 mt-4 w-full justify-end">
          <Button theme="ghost-muted" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            theme={type === "danger" ? "danger" : "primary"}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

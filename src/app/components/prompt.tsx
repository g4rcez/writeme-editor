import { Modal, Button, Input } from "@g4rcez/components";
import { useEffect, useState } from "react";

interface PromptProps {
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  open: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const Prompt = ({
  title,
  message,
  initialValue = "",
  placeholder,
  open,
  onConfirm,
  onCancel,
}: PromptProps) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onConfirm(value);
  };

  return (
    <Modal open={open} onChange={onCancel} title={title} className="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full"
        />
        <div className="flex gap-2 w-full mt-4">
          <Button theme="muted" type="button" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button theme="primary" type="submit" className="flex-1">
            OK
          </Button>
        </div>
      </form>
    </Modal>
  );
};

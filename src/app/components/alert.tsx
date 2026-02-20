import { Modal, Button } from "@g4rcez/components";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect } from "react";

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
        return <CheckCircle2 className="text-green-500" size={24} />;
      case "error":
        return <AlertCircle className="text-red-500" size={24} />;
      default:
        return <Info className="text-blue-500" size={24} />;
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

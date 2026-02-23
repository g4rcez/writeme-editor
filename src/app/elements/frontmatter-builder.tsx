import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Select,
  Textarea,
  uuid,
} from "@g4rcez/components";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { ChangeEvent, useEffect, useState } from "react";
import * as YAML from "yaml";

type PropertyType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "list"
  | "multiline";

type FrontmatterProperty = {
  id: string;
  key: string;
  value: string;
  type: PropertyType;
};

const TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "list", label: "List" },
  { value: "multiline", label: "Multiline" },
];

function inferType(value: unknown): PropertyType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
    if (value.includes("\n")) return "multiline";
  }
  return "text";
}

function valueToString(value: unknown, type: PropertyType): string {
  if (type === "list" && Array.isArray(value)) return value.join(", ");
  if (type === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return String(value);
}

const parseFrontMatter = (content: string): FrontmatterProperty[] => {
  try {
    const parsed = YAML.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return [];
    return Object.entries(parsed).map(([key, val]) => {
      const type = inferType(val);
      return { id: uuid(), key, value: valueToString(val, type), type };
    });
  } catch {
    return [];
  }
};

function propertiesToYaml(properties: FrontmatterProperty[]): string {
  const obj: Record<string, unknown> = {};
  for (const p of properties) {
    if (!p.key.trim()) continue;
    switch (p.type) {
      case "number":
        obj[p.key] = parseFloat(p.value) || 0;
        break;
      case "boolean":
        obj[p.key] = p.value === "true";
        break;
      case "list":
        obj[p.key] = p.value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        obj[p.key] = p.value;
    }
  }
  return YAML.stringify(obj);
}

interface FrontmatterBuilderProps {
  open: boolean;
  content: string;
  onClose: () => void;
  onSave: (yaml: string) => void;
}

export const FrontmatterBuilder = ({
  open,
  content,
  onClose,
  onSave,
}: FrontmatterBuilderProps) => {
  const [properties, setProperties] = useState<FrontmatterProperty[]>([]);

  useEffect(() => {
    if (open) setProperties(parseFrontMatter(content));
  }, [open]);

  const updateProperty = (id: string, patch: Partial<FrontmatterProperty>) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  const removeProperty = (id: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  const addProperty = () => {
    setProperties((prev) => [
      ...prev,
      { id: uuid(), key: "", value: "", type: "text" },
    ]);
  };

  const handleSave = () => {
    onSave(propertiesToYaml(properties));
    onClose();
  };

  return (
    <Modal
      open={open}
      onChange={onClose}
      title="Properties"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          {properties.map((p) => (
            <div key={p.id} className="flex flex-col gap-2">
              <div className="flex flex-nowrap gap-2">
                <Input
                  required
                  value={p.key}
                  container="w-full"
                  title="Key/Label"
                  placeholder="Property name"
                  onChange={(e) =>
                    updateProperty(p.id, { key: e.target.value })
                  }
                />
                <Select
                  title="Value"
                  value={p.type}
                  container="w-full"
                  options={TYPE_OPTIONS}
                  onChange={(e) =>
                    updateProperty(p.id, {
                      type: e.target.value as PropertyType,
                    })
                  }
                />
              </div>
              <ValueInput
                property={p}
                onChange={(value) => updateProperty(p.id, { value })}
              />
              <button
                onClick={() => removeProperty(p.id)}
                className="flex justify-center items-center w-8 h-9 rounded transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete property"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addProperty}
          className="flex gap-1 items-center py-1 text-xs transition-colors text-muted-foreground w-fit hover:text-foreground"
        >
          <PlusIcon size={14} />
          Add property
        </button>
        <div className="flex gap-2 justify-end pt-2 border-t border-card-border">
          <Button theme="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button theme="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const ValueInput = ({
  property,
  onChange,
}: {
  property: FrontmatterProperty;
  onChange: (value: string) => void;
}) => {
  switch (property.type) {
    case "boolean":
      return (
        <Checkbox
          required
          checked={property.value === "true"}
          className="w-4 h-4 rounded cursor-pointer border-border accent-primary"
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
      );
    case "multiline":
      return (
        <Textarea
          required
          value={property.value}
          placeholder="Multiline text..."
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange(e.target.value)
          }
        />
      );
    case "number":
      return (
        <Input
          required
          type="number"
          value={property.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <DatePicker
          required
          type="datetime"
          value={property.value}
          onChange={(e: Date) => onChange(e.toISOString())}
        />
      );
    case "list":
      return (
        <Input
          required
          value={property.value}
          placeholder="item1, item2, item3"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          required
          value={property.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

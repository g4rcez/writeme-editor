import { css } from "@g4rcez/components";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CubeIcon } from "@phosphor-icons/react/dist/csr/Cube";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { Handle, Position } from "@xyflow/react";
import { useState } from "react";

export const JsonNode = ({ data }: any) => {
  const {
    label,
    value,
    type,
    isExpanded,
    onToggle,
    matchesSearch,
    isPathToMatch,
    onValueChange,
  } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const Icon =
    type === "object"
      ? CubeIcon
      : type === "array"
        ? ListBulletsIcon
        : HashIcon;
  const ExpandIcon = isExpanded ? CaretDownIcon : CaretRightIcon;

  const typeBorderColors = {
    object: "border-info/30",
    array: "border-secondary/30",
    value: "border-success/30",
  };

  const handleValueSubmit = () => {
    setIsEditing(false);
    if (onValueChange && editValue !== String(value)) {
      onValueChange(editValue);
    }
  };

  return (
    <div
      className={css(
        "min-w-[14rem] p-2.5 rounded-lg border bg-card-background transition-all duration-200",
        matchesSearch
          ? "border-primary ring-2 ring-primary/20 z-50 shadow-lg scale-105"
          : isPathToMatch
            ? "border-primary/60 shadow-md shadow-primary/5"
            : (typeBorderColors[type as keyof typeof typeBorderColors] || "border-card-border"),
        "hover:shadow-md group",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-primary !border-none"
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2 justify-between items-center pb-1 border-b border-border/5">
          <div className="flex overflow-hidden gap-2 items-center">
            <Icon
              size={14}
              className={css(
                type === "object"
                  ? "text-primary"
                  : type === "array"
                    ? "text-secondary"
                    : "text-success",
              )}
            />
            <span className="font-mono font-bold tracking-tight text-[11px] truncate text-foreground/90 uppercase">
              {label}
            </span>
          </div>
          {(type === "object" || type === "array") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-0.5 rounded transition-colors text-muted-foreground group-hover:text-foreground hover:bg-muted"
            >
              <ExpandIcon size={14} />
            </button>
          )}
        </div>

        {type === "value" && (
          <div className="overflow-hidden py-1 px-2 rounded bg-muted/20">
            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onBlur={handleValueSubmit}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleValueSubmit()}
                className="w-full font-mono bg-transparent outline-none text-xs text-foreground"
              />
            ) : (
              <span
                onDoubleClick={() => setIsEditing(true)}
                className={css(
                  "text-[11px] font-mono break-all cursor-text",
                  typeof value === "string"
                    ? "text-primary"
                    : typeof value === "number"
                      ? "text-warn"
                      : typeof value === "boolean"
                        ? "text-secondary"
                        : "text-foreground/70",
                )}
              >
                {typeof value === "string" ? `"${value}"` : String(value)}
              </span>
            )}
          </div>
        )}
        {(type === "object" || type === "array") && (
          <div className="flex justify-between items-center px-0.5">
            <span className="font-medium tracking-wide text-xs text-muted-foreground">
              {type}
            </span>
            <span className="font-bold rounded text-xs text-muted-foreground">
              {type === "object"
                ? Object.keys(data.raw || {}).length
                : data.raw?.length || 0}{" "}
              items
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-primary !border-none"
      />
    </div>
  );
};

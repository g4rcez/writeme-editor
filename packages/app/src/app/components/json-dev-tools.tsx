import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { css } from "@g4rcez/components";
import { useMemo, useState } from "react";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Props = { value: string; className?: string };

const primitivePreview = (v: JsonValue): string => {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[…]";
  return "{…}";
};

const previewObject = (obj: Record<string, JsonValue>, maxLen = 50): string => {
  const entries = Object.entries(obj);
  let result = "{";
  for (const [k, v] of entries) {
    const part = `${k}: ${primitivePreview(v)}, `;
    if (result.length + part.length > maxLen) {
      result += "…";
      break;
    }
    result += part;
  }
  result = result.endsWith(", ") ? result.slice(0, -2) : result;
  return result + "}";
};

const previewArray = (arr: JsonValue[], maxLen = 50): string => {
  let result = "[";
  for (const v of arr) {
    const part = `${primitivePreview(v)}, `;
    if (result.length + part.length > maxLen) {
      result += "…";
      break;
    }
    result += part;
  }
  result = result.endsWith(", ") ? result.slice(0, -2) : result;
  return result + "]";
};

export const JsonDevTools = ({ value, className }: Props) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["root"]),
  );

  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: JSON.parse(value) as JsonValue, parseError: null };
    } catch (e: any) {
      return { parsed: null, parseError: e.message as string };
    }
  }, [value]);

  const toggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  function renderNode(
    val: JsonValue,
    path: string,
    key: string | number | null,
    depth: number,
  ): React.ReactNode {
    const keySpan =
      key !== null ? (
        <span className="text-json-key">
          {typeof key === "number" ? key : `"${key}"`}
        </span>
      ) : null;
    const colon =
      key !== null ? (
        <span className="text-json-separator">: </span>
      ) : null;

    if (val === null) {
      return (
        <div key={path} style={{ paddingLeft: depth * 16 }}>
          {keySpan}
          {colon}
          <span className="text-json-null italic">null</span>
        </div>
      );
    }

    if (typeof val === "string") {
      return (
        <div key={path} style={{ paddingLeft: depth * 16 }}>
          {keySpan}
          {colon}
          <span className="text-json-string">
            &quot;{val}&quot;
          </span>
        </div>
      );
    }

    if (typeof val === "number") {
      return (
        <div key={path} style={{ paddingLeft: depth * 16 }}>
          {keySpan}
          {colon}
          <span className="text-json-number">{val}</span>
        </div>
      );
    }

    if (typeof val === "boolean") {
      return (
        <div key={path} style={{ paddingLeft: depth * 16 }}>
          {keySpan}
          {colon}
          <span className="text-json-boolean">
            {String(val)}
          </span>
        </div>
      );
    }

    const isArray = Array.isArray(val);
    const isExpanded = expandedPaths.has(path);
    const open = isArray ? "[" : "{";
    const close = isArray ? "]" : "}";
    const preview = isArray
      ? previewArray(val as JsonValue[])
      : previewObject(val as Record<string, JsonValue>);
    const count = isArray
      ? (val as JsonValue[]).length
      : Object.keys(val as object).length;

    if (!isExpanded) {
      return (
        <div
          key={path}
          style={{ paddingLeft: depth * 16 }}
          className="flex items-center gap-0.5 cursor-pointer hover:bg-json-hover rounded select-none"
          onClick={() => toggle(path)}
        >
          <CaretRightIcon
            size={12}
            className="text-json-caret shrink-0"
          />
          {keySpan}
          {colon}
          <span className="text-json-caret">
            {count === 0 ? `${open}${close}` : preview}
          </span>
        </div>
      );
    }

    const children = isArray
      ? (val as JsonValue[]).map((item, i) =>
          renderNode(item, `${path}[${i}]`, i, depth + 1),
        )
      : Object.entries(val as Record<string, JsonValue>).map(([k, v]) =>
          renderNode(v, `${path}.${k}`, k, depth + 1),
        );

    return (
      <div key={path}>
        <div
          style={{ paddingLeft: depth * 16 }}
          className="flex items-center gap-0.5 cursor-pointer hover:bg-json-hover rounded select-none"
          onClick={() => toggle(path)}
        >
          <CaretDownIcon
            size={12}
            className="text-json-caret shrink-0"
          />
          {keySpan}
          {colon}
          <span className="text-json-separator">{open}</span>
        </div>
        {children}
        <div
          style={{ paddingLeft: depth * 16 }}
          className="text-json-separator"
        >
          {close}
        </div>
      </div>
    );
  }

  if (parseError) {
    return (
      <div
        className={css(
          "overflow-auto font-mono text-[13px] p-3 rounded bg-json-bg",
          className,
        )}
      >
        <span className="text-red-500">Invalid JSON: {parseError}</span>
      </div>
    );
  }

  return (
    <div
      className={css("overflow-auto font-mono text-[13px] p-3 rounded bg-json-bg", className)}
    >
      {renderNode(parsed, "root", null, 0)}
    </div>
  );
};

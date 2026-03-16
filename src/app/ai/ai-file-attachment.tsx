import { PaperclipIcon } from "@phosphor-icons/react/dist/csr/Paperclip";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useRef } from "react";
import type { AIAdapter, AIFile } from "./adapters/types";

type Props = {
  files: AIFile[];
  onFilesChange(files: AIFile[]): void;
  adapter: AIAdapter;
};

export function AIFileAttachment({ files, onFilesChange, adapter }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    e.target.value = "";

    const prepared: AIFile[] = [];
    for (const file of selected) {
      try {
        const aiFile = await adapter.prepareFile(file);
        prepared.push(aiFile);
      } catch (err) {
        console.error("Failed to prepare file:", file.name, err);
      }
    }

    onFilesChange([...files, ...prepared]);
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center pb-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex gap-1 items-center p-1 rounded-md text-xs text-muted-foreground transition-colors hover:bg-muted"
        title="Attach file"
      >
        <PaperclipIcon size={14} />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.py,.json"
        onChange={handleFileSelect}
      />
      {files.map((file) => (
        <span
          key={file.id}
          className="flex gap-1 items-center px-2 py-0.5 rounded-full text-xs bg-muted text-foreground max-w-[140px]"
        >
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => removeFile(file.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100"
          >
            <XIcon size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

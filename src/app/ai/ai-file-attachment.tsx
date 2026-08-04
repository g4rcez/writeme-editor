import { PaperclipIcon } from "@phosphor-icons/react/dist/csr/Paperclip";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { type ChangeEvent, type Dispatch, type SetStateAction, useLayoutEffect, useRef, useState } from "react";
import {
    AI_ATTACHMENT_LIMITS,
    AI_FILE_CAPABILITIES,
    type AIAdapter,
    type AIFile,
    validateFileForCapabilities,
} from "./adapters/types";

type AttachmentError = {
    id: number;
    fileName: string;
    reason: string;
};

type UseAIFileAttachmentsOptions = {
    files: AIFile[];
    onFilesChange: Dispatch<SetStateAction<AIFile[]>>;
    adapter: AIAdapter | undefined;
};

export type AIFileAttachmentController = {
    addFiles(files: File[]): boolean;
    removeFile(id: string): void;
    clearErrors(): void;
    isPreparing: boolean;
    errors: AttachmentError[];
    accept: string;
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "The file could not be prepared.";
}

export function getClipboardFiles(clipboardData: DataTransfer | null): File[] {
    if (!clipboardData) return [];
    const files = Array.from(clipboardData.files);
    if (files.length > 0) return files;
    return Array.from(clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
}

export function useAIFileAttachments({
    files,
    onFilesChange,
    adapter,
}: UseAIFileAttachmentsOptions): AIFileAttachmentController {
    const [isPreparing, setIsPreparing] = useState(false);
    const [errors, setErrors] = useState<AttachmentError[]>([]);
    const filesRef = useRef(files);
    const adapterRef = useRef(adapter);
    const adapterGenerationRef = useRef(0);
    const queueRef = useRef(Promise.resolve());
    const reservedCountRef = useRef(0);
    const reservedSizeRef = useRef(0);
    const errorIdRef = useRef(0);

    useLayoutEffect(() => {
        filesRef.current = files;
    }, [files]);

    useLayoutEffect(() => {
        if (adapterRef.current === adapter) return;
        adapterRef.current = adapter;
        adapterGenerationRef.current += 1;
        queueRef.current = Promise.resolve();
        reservedCountRef.current = 0;
        reservedSizeRef.current = 0;
        filesRef.current = [];
        onFilesChange([]);
        setErrors([]);
        setIsPreparing(false);
    }, [adapter, onFilesChange]);

    const addErrors = (nextErrors: Omit<AttachmentError, "id">[]): void => {
        if (nextErrors.length === 0) return;
        setErrors((current) => [...current, ...nextErrors.map((error) => ({ ...error, id: ++errorIdRef.current }))]);
    };

    const addFiles = (selectedFiles: File[]): boolean => {
        if (selectedFiles.length === 0) return false;

        const accepted: File[] = [];
        const rejected: Omit<AttachmentError, "id">[] = [];
        let nextCount = filesRef.current.length + reservedCountRef.current;
        let nextSize = filesRef.current.reduce((total, file) => total + file.size, 0) + reservedSizeRef.current;

        for (const file of selectedFiles) {
            const capabilityError = validateFileForCapabilities(
                file,
                adapter?.fileCapabilities ?? AI_FILE_CAPABILITIES.none,
            );
            let reason = capabilityError;
            if (!reason && nextCount >= AI_ATTACHMENT_LIMITS.maxCount) {
                reason = "Only 5 attachments can be sent at once.";
            }
            if (!reason && nextSize + file.size > AI_ATTACHMENT_LIMITS.maxTotalSize) {
                reason = "Attachments cannot exceed 20 MiB in total.";
            }

            if (reason) {
                rejected.push({ fileName: file.name || "Unnamed file", reason });
                continue;
            }

            accepted.push(file);
            nextCount += 1;
            nextSize += file.size;
        }

        addErrors(rejected);
        if (accepted.length === 0) return false;

        reservedCountRef.current += accepted.length;
        reservedSizeRef.current += accepted.reduce((total, file) => total + file.size, 0);
        setIsPreparing(true);
        const selectedAdapter = adapter;
        const selectedGeneration = adapterGenerationRef.current;

        queueRef.current = queueRef.current.then(async () => {
            const prepared: AIFile[] = [];
            const preparationErrors: Omit<AttachmentError, "id">[] = [];

            for (const file of accepted) {
                if (
                    !selectedAdapter ||
                    adapterRef.current !== selectedAdapter ||
                    adapterGenerationRef.current !== selectedGeneration
                ) {
                    continue;
                }
                try {
                    const preparedFile = await selectedAdapter.prepareFile(file);
                    if (adapterRef.current === selectedAdapter && adapterGenerationRef.current === selectedGeneration) {
                        prepared.push(preparedFile);
                    }
                } catch (error: unknown) {
                    if (adapterRef.current === selectedAdapter && adapterGenerationRef.current === selectedGeneration) {
                        preparationErrors.push({ fileName: file.name, reason: errorMessage(error) });
                    }
                }
            }

            if (adapterGenerationRef.current === selectedGeneration) {
                reservedCountRef.current -= accepted.length;
                reservedSizeRef.current -= accepted.reduce((total, file) => total + file.size, 0);
                addErrors(preparationErrors);

                if (prepared.length > 0) {
                    onFilesChange((current) => {
                        const next = [...current, ...prepared];
                        filesRef.current = next;
                        return next;
                    });
                }

                setIsPreparing(reservedCountRef.current > 0);
            }
        });

        return true;
    };

    const removeFile = (id: string): void => {
        onFilesChange((current) => {
            const next = current.filter((file) => file.id !== id);
            filesRef.current = next;
            return next;
        });
    };

    return {
        addFiles,
        removeFile,
        clearErrors: () => setErrors([]),
        isPreparing,
        errors,
        accept: adapter?.fileCapabilities.accept ?? "",
    };
}

type Props = {
    files: AIFile[];
    controller: AIFileAttachmentController;
    disabled?: boolean;
};

export function AIFileAttachment({ files, controller, disabled = false }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>): void => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = "";
        controller.addFiles(selected);
    };

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || controller.isPreparing}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Attach files"
            >
                <PaperclipIcon size={15} aria-hidden="true" />
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                accept={controller.accept}
                onChange={handleFileSelect}
                aria-label="Choose attachment files"
                tabIndex={-1}
            />
            {files.map((file) => (
                <span
                    key={file.id}
                    className="flex max-w-48 items-center gap-1 rounded-full border border-card-border bg-muted px-2 py-1 text-xs text-foreground"
                >
                    <span className="truncate">{file.name}</span>
                    <button
                        type="button"
                        onClick={() => controller.removeFile(file.id)}
                        disabled={disabled}
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                        aria-label={`Remove ${file.name}`}
                    >
                        <XIcon size={11} aria-hidden="true" />
                    </button>
                </span>
            ))}
            {controller.isPreparing ? (
                <output aria-live="polite" className="text-xs text-muted-foreground">
                    Preparing attachments…
                </output>
            ) : null}
            {controller.errors.length > 0 ? (
                <div
                    role="alert"
                    className="basis-full rounded-lg border border-danger/40 bg-danger-subtle px-3 py-2 text-xs text-danger"
                >
                    <div className="flex items-start justify-between gap-2">
                        <ul className="min-w-0 space-y-1">
                            {controller.errors.map((error) => (
                                <li key={error.id} className="break-words">
                                    <span className="font-medium">{error.fileName}:</span> {error.reason}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={controller.clearErrors}
                            className="shrink-0 rounded-md px-1.5 py-0.5 font-medium hover:bg-danger/10"
                            aria-label="Dismiss attachment errors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

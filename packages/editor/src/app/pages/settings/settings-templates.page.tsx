import { Button, Input } from "@g4rcez/components";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Note } from "@/store/note";
import { Confirm } from "@/app/components/confirm";
import { useTemplates } from "@/app/hooks/use-templates";
import {
    getTemplatePreview,
    getTemplateStorageLabel,
    getTemplateVariables,
    type TemplateVariableSummary,
} from "@/app/templates/template-summary";
import { Dates } from "@/lib/dates";
import { useGlobalStore } from "@/store/global.store";
import { SettingsPageShell } from "./settings-page-shell";

type TemplateListItem = {
    template: Note;
    preview: string;
    storageLabel: string;
    variables: TemplateVariableSummary[];
    searchableText: string;
};

export default function SettingsTemplatesPage() {
    const [, dispatch] = useGlobalStore();
    const { templates, loading, refresh } = useTemplates();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [deletingTemplate, setDeletingTemplate] = useState<Note | null>(null);

    const templateItems = useMemo<TemplateListItem[]>(
        () =>
            templates.map((template) => {
                const preview = getTemplatePreview(template.content);
                const storageLabel = getTemplateStorageLabel(template.filePath);
                const variables = getTemplateVariables(template.content);
                return {
                    template,
                    preview,
                    storageLabel,
                    variables,
                    searchableText: [
                        template.title,
                        template.content,
                        storageLabel,
                        ...variables.map((variable) => variable.name),
                    ]
                        .join(" ")
                        .toLowerCase(),
                };
            }),
        [templates],
    );

    const normalizedQuery = query.trim().toLowerCase();
    const filteredItems = useMemo(() => {
        if (!normalizedQuery) return templateItems;
        return templateItems.filter((item) => item.searchableText.includes(normalizedQuery));
    }, [normalizedQuery, templateItems]);

    const onCreateTemplate = () => {
        dispatch.setCreateTemplateDialog(true);
    };

    const onCreateNoteFromTemplate = (template: Note) => {
        dispatch.setCreateNoteDialog({
            isOpen: true,
            type: "note",
            templateId: template.id,
        });
    };

    const onDeleteTemplate = async () => {
        if (!deletingTemplate) return;
        await dispatch.deleteNote(deletingTemplate.id);
        setDeletingTemplate(null);
        await refresh();
    };

    return (
        <SettingsPageShell
            title="Templates"
            description="Review reusable note templates, inspect their variables, and create notes from them without opening the editor first."
            actions={
                <>
                    <Button size="small" className="flex items-center gap-1.5" onClick={onCreateTemplate}>
                        <PlusIcon className="size-4" aria-hidden="true" />
                        New Template
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <Input
                        title="Search templates"
                        optionalText=" "
                        container="w-full sm:max-w-md"
                        placeholder="Search title, content, or variable"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <p className="shrink-0 text-sm text-muted-foreground" role="status">
                        {loading
                            ? "Loading templates..."
                            : `${filteredItems.length} of ${templates.length} template${templates.length === 1 ? "" : "s"}`}
                    </p>
                </div>
                {loading ? (
                    <TemplatesLoadingState />
                ) : filteredItems.length === 0 ? (
                    <TemplatesEmptyState
                        query={query}
                        hasTemplates={templates.length > 0}
                        onCreateTemplate={onCreateTemplate}
                    />
                ) : (
                    <ul className="divide-y divide-border" aria-label="Templates">
                        {filteredItems.map((item) => (
                            <TemplateRow
                                key={item.template.id}
                                item={item}
                                onOpen={(templateId) => navigate(`/templates/${templateId}`)}
                                onUse={onCreateNoteFromTemplate}
                                onDelete={setDeletingTemplate}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <Confirm
                type="danger"
                confirmText="Delete"
                title="Delete template"
                open={!!deletingTemplate}
                onConfirm={onDeleteTemplate}
                onCancel={() => setDeletingTemplate(null)}
                message={`Are you sure you want to delete "${deletingTemplate?.title}"? This will also delete the physical file if applicable.`}
            />
        </SettingsPageShell>
    );
}

type TemplateRowProps = {
    item: TemplateListItem;
    onOpen: (templateId: string) => void;
    onUse: (template: Note) => void;
    onDelete: (template: Note) => void;
};

function TemplateRow({ item, onOpen, onUse, onDelete }: TemplateRowProps) {
    const { template, preview, storageLabel, variables } = item;
    const title = template.title || "Untitled template";
    const updatedAt = Dates.yearMonthDay(new Date(template.updatedAt));
    const variableSummary = variables.length === 1 ? "1 variable" : `${variables.length} variables`;

    return (
        <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0 space-y-2">
                <h2 className="text-sm font-semibold text-foreground">
                    <button
                        type="button"
                        className="max-w-full break-words text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Open ${title}`}
                        onClick={() => onOpen(template.id)}
                    >
                        {title}
                    </button>
                </h2>
                <p className="line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{preview}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="break-all">{storageLabel}</span>
                    <span>Updated {updatedAt}</span>
                    <span>{variableSummary}</span>
                </div>
                <TemplateVariableChips variables={variables} />
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                <Button size="small" theme="ghost-primary" aria-label={`Use ${title}`} onClick={() => onUse(template)}>
                    Use
                </Button>
                <Button
                    size="small"
                    theme="ghost-muted"
                    aria-label={`Open ${title} in editor`}
                    onClick={() => onOpen(template.id)}
                >
                    Open
                </Button>
                <Button
                    size="small"
                    theme="ghost-danger"
                    aria-label={`Delete ${title}`}
                    onClick={() => onDelete(template)}
                >
                    Delete
                </Button>
            </div>
        </li>
    );
}

function TemplateVariableChips({ variables }: { variables: TemplateVariableSummary[] }) {
    if (variables.length === 0) return null;

    const visibleVariables = variables.slice(0, 4);
    const hiddenCount = variables.length - visibleVariables.length;

    return (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {visibleVariables.map((variable) => (
                <span
                    key={variable.name}
                    className="break-all font-mono"
                    title={variable.count === 1 ? "Used once" : `Used ${variable.count} times`}
                >
                    {`{{${variable.name}}}`}
                </span>
            ))}
            {hiddenCount > 0 ? <span>+{hiddenCount} more</span> : null}
        </span>
    );
}

function TemplatesLoadingState() {
    return (
        <div aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2 border-b border-border py-4 last:border-b-0">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                </div>
            ))}
        </div>
    );
}

function TemplatesEmptyState({
    query,
    hasTemplates,
    onCreateTemplate,
}: {
    query: string;
    hasTemplates: boolean;
    onCreateTemplate: () => void;
}) {
    return (
        <div className="space-y-4 py-8">
            <div className="max-w-md space-y-2">
                <h2 className="text-base font-semibold text-foreground">
                    {hasTemplates ? "No matching templates" : "No templates yet"}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                    {hasTemplates
                        ? `No templates match "${query.trim()}". Try a title, phrase, or variable name.`
                        : "Create a template for repeatable notes like weekly reviews, meeting notes, or project briefs. Variables such as {{DATE}} can be filled when a note is created."}
                </p>
            </div>
            {!hasTemplates ? (
                <Button size="small" className="flex items-center gap-1.5" onClick={onCreateTemplate}>
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Create Template
                </Button>
            ) : null}
        </div>
    );
}

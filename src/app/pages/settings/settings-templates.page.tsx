import { Button, Input } from "@g4rcez/components";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
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
            <PlusIcon className="size-4" />
            New Template
          </Button>
        </>
      }
    >
      <div className="space-y-5 py-4">
        <section className="rounded-xl border border-border/40 bg-card-background">
          <div className="flex flex-col gap-4 border-b border-border/30 p-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-base font-semibold text-foreground">Template library</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {templates.length === 0
                  ? "Templates will appear here after you create one or sync your workspace folder."
                  : `${templates.length} template${templates.length === 1 ? "" : "s"} available for new notes.`}
              </p>
            </div>
            <Input
              title="Search templates"
              optionalText=" "
              container="w-full md:w-72"
              placeholder="Search title, content, or variable"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
            <ul className="divide-y divide-border/30">
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
        </section>
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
    <li className="grid gap-3 p-4 transition-colors hover:bg-muted/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <button
        type="button"
        className="group min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open ${title}`}
        onClick={() => onOpen(template.id)}
      >
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
            <FileTextIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 space-y-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
              <span className="rounded-full border border-border/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {storageLabel}
              </span>
            </span>
            <span className="block max-h-12 overflow-hidden text-sm leading-6 text-muted-foreground">{preview}</span>
            <span className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>Updated {updatedAt}</span>
              <span aria-hidden="true">·</span>
              <span>{variableSummary}</span>
            </span>
            <TemplateVariableChips variables={variables} />
          </span>
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          size="small"
          theme="ghost-primary"
          className="flex items-center gap-1.5"
          onClick={() => onUse(template)}
        >
          <FilePlusIcon className="size-4" />
          Use
        </Button>
        <Button size="small" theme="ghost-muted" onClick={() => onOpen(template.id)}>
          Open
        </Button>
        <Button
          size="small"
          theme="ghost-danger"
          className="flex items-center gap-1.5"
          onClick={() => onDelete(template)}
        >
          <TrashIcon className="size-4" />
          Delete
        </Button>
      </div>
    </li>
  );
}

function TemplateVariableChips({ variables }: { variables: TemplateVariableSummary[] }) {
  if (variables.length === 0) {
    return (
      <span className="inline-flex w-fit rounded-full bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
        No variables
      </span>
    );
  }

  const visibleVariables = variables.slice(0, 4);
  const hiddenCount = variables.length - visibleVariables.length;

  return (
    <span className="flex flex-wrap gap-1.5">
      {visibleVariables.map((variable) => (
        <span
          key={variable.name}
          className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
          title={variable.count === 1 ? "Used once" : `Used ${variable.count} times`}
        >
          {`{{${variable.name}}}`}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
          +{hiddenCount} more
        </span>
      ) : null}
    </span>
  );
}

function TemplatesLoadingState() {
  return (
    <div className="space-y-0 p-4" aria-label="Loading templates">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-3 border-b border-border/20 py-4 last:border-b-0">
          <div className="size-9 animate-pulse rounded-lg bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted/40" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/30" />
          </div>
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
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
        <FileTextIcon className="size-6" aria-hidden="true" />
      </span>
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
          <PlusIcon className="size-4" />
          Create Template
        </Button>
      ) : null}
    </div>
  );
}

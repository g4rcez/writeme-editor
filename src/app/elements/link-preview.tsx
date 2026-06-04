import { Tooltip } from "@g4rcez/components/tooltip";
import { type ReactNode } from "react";

import { type Note } from "@/store/note";
import { findCompatibleNote } from "@/lib/note-lookup";
import { DomainLinkDisplay } from "../extensions/domain-link";

export type NoteLinkPreview = {
  title: string;
  excerpt: string;
  exists: boolean;
};

export type MentionLookupTarget = {
  id: string;
  path: string;
  label: string;
  target?: string;
};

type LinkPreviewProps = {
  trigger: ReactNode;
  children: ReactNode;
};

export function LinkPreview({ trigger, children }: LinkPreviewProps) {
  return (
    <Tooltip popover hover title={trigger} placement="top">
      {children}
    </Tooltip>
  );
}

export function DomainLinkPreview({ url }: { url: string }) {
  return (
    <div className="max-w-96 flex flex-col items-center gap-1 rounded-md px-3 py-2 text-base">
      <a className="text-primary cursor-pointer hover:underline">{url}</a>
      <span className="text-xs !text-foreground">
        <DomainLinkDisplay as="span" url={url} />
      </span>
    </div>
  );
}

export function NoteMentionPreview({ preview }: { preview: NoteLinkPreview }) {
  return (
    <div className="flex max-w-80 flex-col gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-lg">
      <div className="font-medium leading-snug text-foreground">
        {preview.title}
      </div>
      <div className="line-clamp-4 leading-relaxed text-muted-foreground">
        {preview.excerpt}
      </div>
    </div>
  );
}

export function findMentionNote(
  notes: Note[],
  target: MentionLookupTarget | string,
): Note | undefined {
  return findCompatibleNote(notes, target);
}

export function createPlainTextExcerpt(
  content: string,
  maxLength: number = 180,
): string {
  const plaintext = contentToPlainText(content);
  if (!plaintext) {
    return "No content yet.";
  }
  if (plaintext.length <= maxLength) {
    return plaintext;
  }
  const trimmed = plaintext.slice(0, Math.max(maxLength - 1, 0)).trimEnd();
  return `${trimmed}…`;
}

export function createNoteLinkPreview(
  notes: Note[],
  target: MentionLookupTarget,
  fallbackTitle: string,
): NoteLinkPreview {
  const note = findMentionNote(notes, target);
  if (!note) {
    return {
      exists: false,
      excerpt: "Note not found.",
      title: fallbackTitle || target.id || target.label || "Missing note",
    };
  }
  return {
    exists: true,
    excerpt: createPlainTextExcerpt(note.content),
    title: note.title || fallbackTitle || target.id || "Untitled note",
  };
}

function contentToPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^---[\s\S]*?---/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#-]+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

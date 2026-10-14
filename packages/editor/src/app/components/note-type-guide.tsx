import { Button, Modal } from "@g4rcez/components";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FEATURES } from "@/lib/build-features";
import { isMobile } from "@/lib/platform";
import { type NoteCreationType, useGlobalStore } from "@/store/global.store";

const noteTypes = [
    {
        type: "note",
        name: "Markdown",
        description: "Write and link everyday notes with rich text or Markdown.",
        example: "A project brief with headings, links, and a checklist.",
    },
    {
        type: "quick",
        name: "Today's quick note",
        description: "Collect small thoughts in a note named for today's date.",
        example: "An idea, a reminder, and a link to revisit tonight.",
    },
    {
        type: "task",
        name: "Task board",
        description: "Organize tasks into columns and move work forward.",
        example: "A launch checklist grouped into To do, Doing, and Done.",
    },
    {
        type: "freehand",
        name: "Handwriting",
        description: "Write and sketch on notebook pages with a pen or touch.",
        example: "A handwritten study page with a sketch beside your notes.",
    },
    {
        type: "excalidraw",
        name: "Excalidraw",
        description: "Think visually on a full-page canvas with shapes and arrows.",
        example: "A system diagram connecting a browser, an API, and a database.",
    },
    {
        type: "pdf",
        name: "PDF",
        description: "Import a PDF document to read and annotate in your workspace.",
        example: "A research paper with highlights and notes in the margins.",
    },
    {
        type: "meeting-note",
        name: "Meeting notes",
        description: "Capture a meeting with notes and optional audio recording.",
        example: "A planning session with decisions and follow-up actions.",
    },
] satisfies Array<{ type: NoteCreationType; name: string; description: string; example: string }>;

export function NoteTypeGuide(): React.JSX.Element {
    const [, dispatch] = useGlobalStore();
    const [open, setOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<NoteCreationType>("note");
    const trigger = useRef<HTMLButtonElement>(null);
    const firstOption = useRef<HTMLInputElement>(null);
    const id = useId();
    const availableTypes = noteTypes.filter(
        (noteType) => noteType.type !== "meeting-note" || (FEATURES.meetingNotes && !isMobile()),
    );

    const closeGuide = (): void => {
        setOpen(false);
        trigger.current?.focus();
    };

    const continueToNote = (): void => {
        flushSync(closeGuide);
        queueMicrotask(() => dispatch.setCreateNoteDialog({ isOpen: true, type: selectedType }));
    };

    return (
        <>
            <Button
                ref={trigger}
                type="button"
                theme="ghost-neutral"
                className="min-h-11!"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => {
                    setSelectedType("note");
                    setOpen(true);
                }}
            >
                <CompassIcon size={17} aria-hidden="true" />
                Explore note types
            </Button>
            {open ? (
                <Modal
                    open
                    title="Explore note types"
                    ariaDescription="Choose a format for what you want to capture. Continue opens its creation form."
                    className="max-w-xl"
                    initialFocus={firstOption}
                    resizer={false}
                    onChange={closeGuide}
                    footer={
                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" theme="ghost-neutral" className="min-h-11!" onClick={closeGuide}>
                                Cancel
                            </Button>
                            <Button type="button" theme="primary" className="min-h-11!" onClick={continueToNote}>
                                Continue
                            </Button>
                        </div>
                    }
                >
                    <p className="mb-3 text-sm text-foreground">Choose a format for what you want to capture.</p>
                    <fieldset className="max-h-80 space-y-2 overflow-y-auto overscroll-contain p-1">
                        <legend className="sr-only">Note format</legend>
                        {availableTypes.map((noteType) => (
                            <label
                                key={noteType.type}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-foreground has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                            >
                                <input
                                    ref={noteType.type === "note" ? firstOption : undefined}
                                    type="radio"
                                    name={`${id}-note-format`}
                                    value={noteType.type}
                                    checked={selectedType === noteType.type}
                                    onChange={() => setSelectedType(noteType.type)}
                                    aria-labelledby={`${id}-${noteType.type}-name`}
                                    aria-describedby={`${id}-${noteType.type}-description`}
                                    className="mt-1 shrink-0 appearance-auto accent-primary focus:ring-0 focus-visible:outline-none"
                                />
                                <span className="min-w-0">
                                    <span id={`${id}-${noteType.type}-name`} className="block text-sm font-semibold">
                                        {noteType.name}
                                    </span>
                                    <span
                                        id={`${id}-${noteType.type}-description`}
                                        className="mt-1 block text-sm leading-5"
                                    >
                                        {noteType.description}
                                        <span className="mt-1 block text-xs leading-5">
                                            Example: {noteType.example}
                                        </span>
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                </Modal>
            ) : null}
        </>
    );
}

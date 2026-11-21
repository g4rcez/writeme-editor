import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { FilePdfIcon } from "@phosphor-icons/react/dist/csr/FilePdf";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FoldersIcon } from "@phosphor-icons/react/dist/csr/Folders";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { motion, useReducedMotion } from "motion/react";
import { type ComponentType, useState } from "react";
import { Link, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { MobileFileActions } from "@/app/components/mobile-file-actions";
import { PhoneKeyboardToolbar } from "@/app/components/phone-keyboard-toolbar";
import { useEditorTextFocus } from "@/app/hooks/use-editor-text-focus";
import { useKeyboard } from "@/app/hooks/use-keyboard";
import { goBackOrHome } from "@/lib/navigation-history";
import { CommanderType, globalDispatch, useGlobalStore } from "@/store/global.store";

type IconType = ComponentType<{ size?: number; weight?: "regular" | "fill"; "aria-hidden"?: boolean }>;
type TabId = "notes" | "today" | "more";

const TAB_ROOTS = ["/notes", "/today"];

const MORE_LINKS: ReadonlyArray<{ to: string; label: string; Icon: IconType }> = [
    { to: "/tags", label: "Tags", Icon: TagIcon },
    { to: "/groups", label: "Groups", Icon: FoldersIcon },
    { to: "/views", label: "Views", Icon: StackIcon },
    { to: "/calendar", label: "Calendar", Icon: CalendarBlankIcon },
    { to: "/read-it-later", label: "Read it later", Icon: BookmarkSimpleIcon },
    { to: "/settings/trash", label: "Trash", Icon: TrashIcon },
    { to: "/settings", label: "Settings", Icon: GearSixIcon },
];

export const isPhoneTabRoot = (pathname: string): boolean => TAB_ROOTS.includes(pathname.replace(/\/+$/, "") || "/");

const activeTab = (pathname: string): TabId => {
    if (pathname.startsWith("/notes") || pathname.startsWith("/note/")) return "notes";
    if (pathname.startsWith("/today")) return "today";
    return "more";
};

const phoneTitle = (pathname: string): string => {
    if (pathname.startsWith("/notes")) return "Notes";
    if (pathname.startsWith("/note/")) return "Note";
    if (pathname.startsWith("/today")) return "Today";
    if (pathname.startsWith("/tasks")) return "Open tasks";
    if (pathname.startsWith("/tags")) return "Tags";
    if (pathname.startsWith("/groups")) return "Groups";
    if (pathname.startsWith("/views")) return "Views";
    if (pathname.startsWith("/calendar")) return "Calendar";
    if (pathname.startsWith("/read-it-later")) return "Read it later";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Writeme";
};

function PhoneOutlet({ pushed }: { pushed: boolean }) {
    const location = useLocation();
    const outlet = useOutlet();
    const reduce = useReducedMotion();
    // Pushed screens slide in from the right; tab roots only fade, so switching tabs stays calm.
    return (
        <motion.div
            key={`${location.pathname}${location.search}`}
            className="h-full min-h-0 w-full"
            animate={{ opacity: 1, x: 0 }}
            initial={reduce ? false : { opacity: 0.6, x: pushed ? 28 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
            {outlet}
        </motion.div>
    );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
    return (
        <dialog open className="writeme-phone-sheet" aria-label="More">
            <button type="button" className="writeme-phone-sheet-backdrop" aria-label="Close" onClick={onClose} />
            <nav className="writeme-phone-sheet-panel">
                <div className="writeme-phone-sheet-grabber" aria-hidden="true" />
                <button
                    type="button"
                    className="writeme-phone-sheet-link"
                    onClick={() => {
                        onClose();
                        globalDispatch.setCreateNoteDialog({ isOpen: true, type: "pdf" });
                    }}
                >
                    <FilePdfIcon size={22} aria-hidden />
                    <span>Import PDF</span>
                </button>
                {MORE_LINKS.map(({ to, label, Icon }) => (
                    <Link key={to} to={to} className="writeme-phone-sheet-link" onClick={onClose}>
                        <Icon size={22} aria-hidden />
                        <span>{label}</span>
                    </Link>
                ))}
            </nav>
        </dialog>
    );
}

export const PhoneLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Remember the path the sheet was opened on, so navigating anywhere closes it without an effect.
    const [moreFor, setMoreFor] = useState<string | null>(null);
    const moreOpen = moreFor === location.pathname;
    const pushed = !isPhoneTabRoot(location.pathname);
    const current = activeTab(location.pathname);
    const [{ note }] = useGlobalStore((state) => ({ note: state.note }));
    const keyboard = useKeyboard();
    const editing = useEditorTextFocus();
    const isNoteRoute = location.pathname.startsWith("/note/");
    // On a note screen the header names the note itself, like a native title bar.
    const noteTitle = isNoteRoute && note && location.pathname === `/note/${note.id}` ? note.title.trim() : "";
    const title = noteTitle || phoneTitle(location.pathname);

    const tab = (label: string, Icon: IconType, active: boolean, onPress: () => void) => (
        <button
            type="button"
            className={`writeme-phone-tab ${active ? "text-primary" : "text-muted-foreground"}`}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={onPress}
        >
            <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="writeme-layout writeme-phone-layout">
            <main className="writeme-layout-main" aria-label={isNoteRoute ? "Editor workspace" : title}>
                <header className="writeme-phone-header">
                    {pushed ? (
                        <button
                            type="button"
                            className="writeme-phone-header-action"
                            aria-label="Back"
                            onClick={() => goBackOrHome(navigate)}
                        >
                            <CaretLeftIcon size={22} aria-hidden />
                        </button>
                    ) : (
                        <span className="writeme-phone-header-spacer" />
                    )}
                    <h1 className={pushed ? "writeme-phone-title" : "writeme-phone-title writeme-phone-title-large"}>
                        {title}
                    </h1>
                    <MobileFileActions />
                    <button
                        type="button"
                        className="writeme-phone-header-action"
                        aria-label="New note"
                        onClick={() => globalDispatch.setCreateNoteDialog({ isOpen: true, type: "note" })}
                    >
                        <FilePlusIcon size={22} aria-hidden />
                    </button>
                </header>
                <div className="writeme-main-surface relative min-h-0 w-full flex-1 bg-background">
                    <div
                        id="main-scroll-container"
                        className="writeme-scroll-container h-full print:block print:h-auto"
                    >
                        <PhoneOutlet pushed={pushed} />
                    </div>
                </div>
            </main>
            {moreOpen && <MoreSheet onClose={() => setMoreFor(null)} />}
            {keyboard.open ? (
                // The keyboard owns the bottom edge: formatting tools while writing, nothing for other inputs.
                editing ? (
                    <PhoneKeyboardToolbar />
                ) : null
            ) : (
                <nav className="writeme-phone-tabbar" aria-label="Primary">
                    {tab("Notes", NotebookIcon, current === "notes" && !moreOpen, () => navigate("/notes"))}
                    {tab("Today", CalendarCheckIcon, current === "today" && !moreOpen, () => navigate("/today"))}
                    {tab("Search", MagnifyingGlassIcon, false, () =>
                        globalDispatch.commander(true, CommanderType.Notes),
                    )}
                    {tab("More", DotsThreeIcon, moreOpen || current === "more", () =>
                        setMoreFor(moreOpen ? null : location.pathname),
                    )}
                </nav>
            )}
        </div>
    );
};

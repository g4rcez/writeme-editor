import { Button, Input } from "@g4rcez/components";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { BookmarkIcon } from "@phosphor-icons/react/dist/csr/Bookmark";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import DOMPurify from "dompurify";
import { useMemo, useRef, useState, type ChangeEvent, type SubmitEvent } from "react";
import { Link } from "react-router-dom";
import { v7 as uuid } from "uuid";
import { Dates } from "@/lib/dates";
import { isElectron } from "@/lib/is-electron";
import {
    ensureReadItLaterFrontmatter,
    getReadItLaterState,
    isReadItLaterNote,
    isSafeHttpUrl,
    parseReadItLaterFeed,
    updateReadItLaterFrontmatter,
    type ParsedReadItLaterFeed,
    type ReadItLaterStatus,
} from "@/lib/read-it-later-library";
import { fetchReadItLaterUrl } from "@/lib/read-it-later-utils";
import { importPdfNote } from "@/lib/pdf-import";
import { repositories } from "@/store/repositories";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { SettingsService, type AppSettings } from "@/store/settings";
import { readItLaterHtmlToMarkdown } from "../read-it-later-content";
import { useNoteList } from "../hooks/use-note-list";

type LibraryTab = ReadItLaterStatus;
type ReadItLaterFeed = AppSettings["readItLaterFeeds"][number];

const tabs: { id: LibraryTab; label: string }[] = [
    { id: "inbox", label: "Inbox" },
    { id: "later", label: "Later" },
    { id: "archive", label: "Archive" },
];

function htmlToPlainText(html: string): string {
    if (!html) return "";
    const safeHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    return new DOMParser().parseFromString(safeHtml, "text/html").body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

async function saveFeedEntries(feed: ReadItLaterFeed, parsed: ParsedReadItLaterFeed, theme: Parameters<typeof readItLaterHtmlToMarkdown>[1]): Promise<number> {
    const savedNotes = await repositories.notes.getAll();
    const savedItemIds = new Set(
        savedNotes
            .filter((note) => note.metadata.rssFeedId === feed.id)
            .map((note) => String(note.metadata.rssItemId)),
    );
    let importedCount = 0;

    for (const item of parsed.items) {
        if (savedItemIds.has(item.id)) continue;

        const html = item.content || item.description;
        const content = ensureReadItLaterFrontmatter(readItLaterHtmlToMarkdown(html, theme));
        const description = htmlToPlainText(item.description || item.content).slice(0, 500) || null;
        const note = Note.new(
            item.title,
            content,
            NoteType["read-it-later"],
            item.url ?? feed.url,
            description,
            null,
            {
                readItLaterSource: "rss",
                rssFeedId: feed.id,
                rssItemId: item.id,
                rssPublishedAt: item.publishedAt,
            },
        );
        await repositories.notes.save(note);
        globalDispatch.syncNoteFromRepository(note);
        savedItemIds.add(item.id);
        importedCount += 1;
    }

    return importedCount;
}

export default function ReadItLaterPage() {
    const [state] = useGlobalStore();
    const { loading, notes, search, setSearch, filteredNotes, handleDelete } = useNoteList();
    const [activeTab, setActiveTab] = useState<LibraryTab>("inbox");
    const [feeds, setFeeds] = useState<ReadItLaterFeed[]>(() => SettingsService.load().readItLaterFeeds);
    const [feedUrl, setFeedUrl] = useState("");
    const [feedActionId, setFeedActionId] = useState<string | null>(null);
    const [importingPdf, setImportingPdf] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const allSavedNotes = useMemo(
        () => notes.filter((note) => !note.deletedAt && isReadItLaterNote(note)),
        [notes],
    );
    const savedNotes = useMemo(
        () => filteredNotes.filter((note) => !note.deletedAt && isReadItLaterNote(note)),
        [filteredNotes],
    );
    const counts = useMemo(
        () =>
            allSavedNotes.reduce<Record<LibraryTab, number>>(
                (result, note) => {
                    result[getReadItLaterState(note.content).status] += 1;
                    return result;
                },
                { inbox: 0, later: 0, archive: 0 },
            ),
        [allSavedNotes],
    );
    const visibleNotes = savedNotes.filter((note) => getReadItLaterState(note.content).status === activeTab);

    const openSaveDialog = () => globalDispatch.readItLaterDialog(true);

    const updateItemState = async (note: Note, update: { read?: boolean; status?: ReadItLaterStatus }) => {
        setError(null);
        setNotice(null);
        const content = updateReadItLaterFrontmatter(note.content, update);
        if (content === note.content) return;

        try {
            const saved = await repositories.notes.updateContentIfUnchanged(note.id, note, content);
            if (!saved) {
                setError(`“${note.title}” changed elsewhere. Reopen it before changing its library status.`);
                return;
            }
            globalDispatch.syncNoteFromRepository(saved);
        } catch {
            setError(`Could not update “${note.title}”. Please try again.`);
        }
    };

    const refreshFeed = async (feed: ReadItLaterFeed) => {
        setError(null);
        setNotice(null);
        setFeedActionId(feed.id);
        try {
            const xml = await fetchReadItLaterUrl(feed.url);
            const parsed = parseReadItLaterFeed(xml, feed.url);
            const importedCount = await saveFeedEntries(feed, parsed, state.theme);
            const updatedFeed = {
                ...feed,
                title: parsed.title?.trim() || feed.title,
                lastFetchedAt: new Date().toISOString(),
            };
            const currentFeeds = SettingsService.load().readItLaterFeeds;
            const nextFeeds = currentFeeds.map((entry) => entry.id === feed.id ? updatedFeed : entry);
            await SettingsService.save({ readItLaterFeeds: nextFeeds });
            setFeeds(nextFeeds);
            setNotice(importedCount === 0 ? `“${feed.title}” is up to date.` : `Added ${importedCount} items from “${updatedFeed.title}”.`);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : "Could not refresh this feed.";
            setError(`${message}${isElectron() ? "" : " In the browser app, the feed must allow cross-origin requests."}`);
        } finally {
            setFeedActionId(null);
        }
    };

    const addFeed = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const url = feedUrl.trim();
        if (!isSafeHttpUrl(url)) {
            setError("Enter a valid HTTP or HTTPS RSS or Atom feed URL.");
            return;
        }
        const normalizedUrl = new URL(url).href;
        if (feeds.some((feed) => feed.url === normalizedUrl)) {
            setError("This feed is already in your library.");
            return;
        }

        setError(null);
        setNotice(null);
        setFeedActionId("new-feed");
        try {
            const xml = await fetchReadItLaterUrl(normalizedUrl);
            const parsed = parseReadItLaterFeed(xml, normalizedUrl);
            const feed: ReadItLaterFeed = {
                id: uuid(),
                url: normalizedUrl,
                title: parsed.title?.trim() || new URL(normalizedUrl).hostname,
                lastFetchedAt: null,
            };
            const currentFeeds = SettingsService.load().readItLaterFeeds;
            const nextFeeds = [...currentFeeds, feed];
            await SettingsService.save({ readItLaterFeeds: nextFeeds });
            setFeeds(nextFeeds);
            setFeedUrl("");

            const importedCount = await saveFeedEntries(feed, parsed, state.theme);
            const refreshedFeed = { ...feed, lastFetchedAt: new Date().toISOString() };
            const refreshedFeeds = nextFeeds.map((entry) => entry.id === feed.id ? refreshedFeed : entry);
            await SettingsService.save({ readItLaterFeeds: refreshedFeeds });
            setFeeds(refreshedFeeds);
            setNotice(importedCount === 0 ? `Subscribed to “${feed.title}”.` : `Added ${importedCount} items from “${feed.title}”.`);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : "Could not add this feed.";
            setError(message);
        } finally {
            setFeedActionId(null);
        }
    };

    const removeFeed = async (feedId: string) => {
        const nextFeeds = SettingsService.load().readItLaterFeeds.filter((feed) => feed.id !== feedId);
        try {
            await SettingsService.save({ readItLaterFeeds: nextFeeds });
            setFeeds(nextFeeds);
            setNotice("Feed removed. Saved articles remain in your library.");
            setError(null);
        } catch {
            setError("Could not remove this feed. Please try again.");
        }
    };

    const importPdf = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;

        setError(null);
        setNotice(null);
        setImportingPdf(true);
        try {
            const title = file.name.replace(/\.pdf$/i, "").trim() || "Imported PDF";
            await importPdfNote(file, title, { readItLater: true });
            globalDispatch.notes(await repositories.notes.getAll());
            setNotice(`Added “${title}” to your Inbox.`);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : "Could not import this PDF.";
            setError(message);
        } finally {
            setImportingPdf(false);
        }
    };

    if (loading) {
        return (
            <output className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading your library…
            </output>
        );
    }

    return (
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 bg-background px-5 py-8 text-foreground sm:px-8">
            <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold">
                        <BookmarkIcon className="size-6 text-primary" aria-hidden="true" />
                        Read It Later
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Save articles, videos, and PDFs. Read and highlight them in your notes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" theme="primary" onClick={openSaveDialog}>
                        Save a link or video
                    </Button>
                    <Button
                        type="button"
                        theme="ghost-muted"
                        loading={importingPdf}
                        disabled={importingPdf}
                        onClick={() => pdfInputRef.current?.click()}
                    >
                        Import PDF
                    </Button>
                    <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        aria-label="Choose a PDF to import"
                        onChange={importPdf}
                    />
                </div>
            </header>

            {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
            {notice && (
                <output className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                    {notice}
                </output>
            )}

            <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="rss-feeds-heading">
                <div className="mb-4">
                    <h2 id="rss-feeds-heading" className="text-base font-semibold">RSS feeds</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Refresh feeds when you want new items. Writeme does not poll in the background.</p>
                </div>
                <form onSubmit={addFeed} className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        required
                        type="url"
                        value={feedUrl}
                        placeholder="https://example.com/feed.xml"
                        aria-label="RSS or Atom feed URL"
                        disabled={feedActionId !== null}
                        onChange={(event) => setFeedUrl(event.target.value)}
                    />
                    <Button
                        type="submit"
                        theme="ghost-muted"
                        loading={feedActionId === "new-feed"}
                        disabled={feedActionId !== null}
                    >
                        Add feed
                    </Button>
                </form>
                {feeds.length > 0 ? (
                    <ul className="mt-4 divide-y divide-border" aria-label="Subscribed feeds">
                        {feeds.map((feed) => (
                            <li key={feed.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{feed.title}</p>
                                    <p className="truncate text-xs text-muted-foreground">{feed.url}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {feed.lastFetchedAt
                                            ? `Last refreshed ${Dates.yearMonthDay(new Date(feed.lastFetchedAt))}`
                                            : "Not refreshed yet"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        type="button"
                                        size="small"
                                        theme="ghost-muted"
                                        loading={feedActionId === feed.id}
                                        disabled={feedActionId !== null}
                                        onClick={() => void refreshFeed(feed)}
                                    >
                                        Refresh
                                    </Button>
                                    <Button
                                        type="button"
                                        size="small"
                                        theme="ghost-muted"
                                        aria-label={`Remove ${feed.title}`}
                                        disabled={feedActionId !== null}
                                        onClick={() => void removeFeed(feed.id)}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 text-sm text-muted-foreground">Add a feed to collect new articles here.</p>
                )}
            </section>

            <section aria-label="Saved items" className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Library sections">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    activeTab === tab.id
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                }`}
                            >
                                {tab.label} <span className="ml-1 text-xs">{counts[tab.id]}</span>
                            </button>
                        ))}
                    </div>
                    <Input
                        type="search"
                        value={search}
                        placeholder="Search your library…"
                        aria-label="Search your library"
                        left={<MagnifyingGlassIcon size={16} className="text-muted-foreground" aria-hidden="true" />}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                {visibleNotes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                        <h2 className="text-base font-medium">
                            {search.trim() ? "No matching saved items" : `Your ${activeTab} is empty`}
                        </h2>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                            {search.trim()
                                ? "Try a different search term."
                                : activeTab === "inbox"
                                  ? "Save a webpage or video, import a PDF, or refresh an RSS feed to start your library."
                                  : activeTab === "later"
                                    ? "Move items here when you want to come back to them."
                                    : "Archived items stay here until you restore or delete them."}
                        </p>
                    </div>
                ) : (
                    <ul className="grid gap-3" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label ?? "Saved"} items`}>
                        {visibleNotes.map((note) => {
                            const itemState = getReadItLaterState(note.content);
                            const sourceUrl = note.url && isSafeHttpUrl(note.url) ? note.url : null;
                            const sourceHost = sourceUrl ? new URL(sourceUrl).hostname : null;
                            const sourceLabel = note.noteType === NoteType.pdf
                                ? "PDF"
                                : note.metadata.readItLaterSource === "rss"
                                  ? "RSS"
                                  : note.metadata.readItLaterSource === "youtube"
                                    ? "Video"
                                    : "Article";
                            const nextStatus: ReadItLaterStatus = activeTab === "inbox" ? "later" : activeTab === "later" ? "archive" : "inbox";
                            const nextStatusLabel = activeTab === "inbox" ? "Move to Later" : activeTab === "later" ? "Archive" : "Restore to Inbox";

                            return (
                                <li key={note.id}>
                                    <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Link to={`/note/${note.id}`} className="text-base font-semibold text-foreground hover:text-primary hover:underline">
                                                        {note.title}
                                                    </Link>
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{sourceLabel}</span>
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                        {itemState.read ? "Read" : "Unread"}
                                                    </span>
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                                    {note.description || "Open this saved item to read and highlight it."}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span>Added {Dates.yearMonthDay(note.createdAt)}</span>
                                                    {sourceUrl && (
                                                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                                            <ArrowSquareOutIcon size={13} aria-hidden="true" />
                                                            {sourceHost}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 sm:justify-end">
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    theme="ghost-muted"
                                                    aria-label={itemState.read ? `Mark ${note.title} unread` : `Mark ${note.title} read`}
                                                    onClick={() => void updateItemState(note, { read: !itemState.read })}
                                                >
                                                    Mark {itemState.read ? "unread" : "read"}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    theme="secondary"
                                                    onClick={() => void updateItemState(note, { status: nextStatus })}
                                                >
                                                    {nextStatusLabel}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    theme="ghost-muted"
                                                    aria-label={`Move ${note.title} to Trash`}
                                                    onClick={(event) => void handleDelete(event, note.id)}
                                                >
                                                    <TrashIcon size={16} aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>
                                    </article>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </main>
    );
}

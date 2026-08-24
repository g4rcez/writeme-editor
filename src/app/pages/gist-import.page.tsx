import { Button, Input } from "@g4rcez/components";
import { type SyntheticEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getUniqueNoteTitle } from "@/lib/file-utils";
import { fetchGithubGist, parseGistReference } from "@/lib/github-gist";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";

type ImportStatus = "idle" | "loading" | "error";

export default function GistImportPage() {
    const [, dispatch] = useGlobalStore();
    const navigate = useNavigate();
    const { owner, gistId } = useParams<{ owner: string; gistId: string }>();
    const [reference, setReference] = useState("");
    const [status, setStatus] = useState<ImportStatus>(owner && gistId ? "loading" : "idle");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!owner || !gistId) return;

        let active = true;
        const importGist = async (): Promise<void> => {
            setStatus("loading");
            setError(null);
            try {
                const gist = await fetchGithubGist({ owner, gistId });
                if (!active) return;

                const existingNotes = await repositories.notes.getAll();
                if (!active) return;

                const title = getUniqueNoteTitle(gist.title, existingNotes);
                const note = Note.new(title, gist.markdown, NoteType.note, gist.url, gist.description, null, {
                    source: "github-gist",
                    gistId: gist.gistId,
                    gistOwner: gist.owner,
                    files: gist.files.map((file) => file.filename),
                });
                await repositories.notes.save(note);
                if (!active) return;

                await dispatch.note(note);
                navigate(`/note/${note.id}`, { replace: true });
            } catch (cause) {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : "Could not import this Gist.");
                setStatus("error");
            }
        };

        void importGist();
        return () => {
            active = false;
        };
    }, [dispatch, gistId, navigate, owner]);

    const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const parsed = parseGistReference(reference);
        if (!parsed) {
            setError("Enter a GitHub Gist URL or an owner/Gist ID pair.");
            setStatus("error");
            return;
        }
        navigate(`/gist/${parsed.owner}/${parsed.gistId}`);
    };

    if (owner && gistId) {
        return (
            <main className="flex min-h-full items-center justify-center px-6 py-12 text-foreground">
                <section className="w-full max-w-xl rounded-card-radius border border-card-border bg-card-background p-6 shadow-soft">
                    <p className="text-sm font-medium text-muted-foreground">GitHub Gist</p>
                    <h1 className="mt-2 text-xl font-semibold text-foreground">
                        {status === "error" ? "The Gist could not be imported." : "Creating your note..."}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground" role={error ? "alert" : undefined}>
                        {error ?? `Fetching ${owner}/${gistId} from GitHub.`}
                    </p>
                    {status === "error" && (
                        <div className="mt-5 flex flex-wrap gap-2">
                            <Button size="small" onClick={() => window.location.reload()}>
                                Try again
                            </Button>
                            <Button size="small" theme="muted" onClick={() => navigate("/gist", { replace: true })}>
                                Import another Gist
                            </Button>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    return (
        <main className="flex min-h-full items-center justify-center px-6 py-12 text-foreground">
            <section className="w-full max-w-xl rounded-card-radius border border-card-border bg-card-background p-6 shadow-soft">
                <p className="text-sm font-medium text-muted-foreground">Import from GitHub</p>
                <h1 className="mt-2 text-xl font-semibold text-foreground">Create a note from a Gist</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Paste a public or secret Gist URL. Writeme imports its files into one local note.
                </p>
                <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                    <Input
                        required
                        autoFocus
                        title="GitHub Gist URL"
                        placeholder="https://gist.github.com/owner/gist-id"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                    />
                    {error && (
                        <p className="text-sm text-danger" role="alert">
                            {error}
                        </p>
                    )}
                    <Button type="submit">Create note</Button>
                </form>
            </section>
        </main>
    );
}

import { describe, expect, it, vi } from "vitest";
import { buildGistMarkdown, fetchGithubGist, parseGistReference } from "./github-gist";

describe("parseGistReference", () => {
    it.each([
        ["samsch/0d1f3d3b4745d778f78b230cf6061452", "samsch", "0d1f3d3b4745d778f78b230cf6061452"],
        [
            "https://gist.github.com/samsch/0d1f3d3b4745d778f78b230cf6061452",
            "samsch",
            "0d1f3d3b4745d778f78b230cf6061452",
        ],
        [
            "https://writeme.dev/gist/samsch/0d1f3d3b4745d778f78b230cf6061452",
            "samsch",
            "0d1f3d3b4745d778f78b230cf6061452",
        ],
    ])("parses %s", (value, owner, gistId) => {
        expect(parseGistReference(value)).toEqual({ owner, gistId });
    });

    it.each(["", "https://github.com/owner/repository", "owner/not-a-gist", "gist.github.com/owner/id/extra"])(
        "rejects %s",
        (value) => {
            expect(parseGistReference(value)).toBeNull();
        },
    );
});

describe("buildGistMarkdown", () => {
    it("keeps a single Markdown file unchanged", () => {
        expect(buildGistMarkdown([{ filename: "note.md", language: "Markdown", content: "# Hello" }])).toBe("# Hello");
    });

    it("wraps source code in a language fence", () => {
        expect(
            buildGistMarkdown([{ filename: "example.ts", language: "TypeScript", content: "const answer = 42;" }]),
        ).toBe("```ts\nconst answer = 42;\n```");
    });

    it("labels each file and uses a safe fence", () => {
        const markdown = buildGistMarkdown([
            { filename: "README.md", language: "Markdown", content: "Read me" },
            { filename: "script.js", language: "JavaScript", content: "const fence = ```example```;" },
        ]);

        expect(markdown).toContain("## README.md\n\nRead me");
        expect(markdown).toContain("## script.js\n\n````js");
        expect(markdown).toContain("\n````");
    });
});

describe("fetchGithubGist", () => {
    it("fetches a Gist and its truncated files", async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        description: "Example Gist",
                        html_url: "https://gist.github.com/samsch/abc123",
                        owner: { login: "samsch" },
                        files: {
                            "example.ts": {
                                filename: "example.ts",
                                language: "TypeScript",
                                raw_url: "https://gist.githubusercontent.com/raw/example.ts",
                                content: "truncated",
                                truncated: true,
                            },
                        },
                    }),
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(new Response("const complete = true;", { status: 200 }));

        const gist = await fetchGithubGist({ owner: "samsch", gistId: "abc123" }, { fetchImpl });

        expect(gist.title).toBe("Example Gist");
        expect(gist.markdown).toBe("```ts\nconst complete = true;\n```");
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("reports GitHub API errors", async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));

        await expect(fetchGithubGist({ owner: "samsch", gistId: "abc123" }, { fetchImpl })).rejects.toThrow(
            "GitHub could not load this Gist (404): Not Found",
        );
    });
});

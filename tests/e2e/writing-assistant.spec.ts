import type { Locator, Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

type EditorMode = "formatted" | "markdown";
type ReviewResponseMode =
    | "correct-first"
    | "correct-second"
    | "empty"
    | "invalid"
    | "network-error"
    | "batch-fails-second";
type PromptSegment = { id: string; text: string };
type CompletionRequest = { targetUrl: string; segments: PromptSegment[]; body: unknown };
type Deferred = { promise: Promise<void>; resolve: () => void };
type HeldResponse = { started: Deferred; release: Deferred };
type ProxyState = {
    completionRequests: CompletionRequest[];
    responseMode: ReviewResponseMode;
    holdNextResponse: HeldResponse | null;
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_KEY = "synthetic-playwright-key";
const GEMINI_PROXY_URL = "http://localhost:4079/proxy";
const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-target-url, x-goog-api-client, x-goog-api-key",
    "access-control-expose-headers": "*",
};

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

function createProxyState(): ProxyState {
    return { completionRequests: [], responseMode: "correct-first", holdNextResponse: null };
}

function extractPromptSegments(body: unknown): PromptSegment[] {
    if (!body || typeof body !== "object" || !("contents" in body) || !Array.isArray(body.contents)) return [];
    const contents: unknown[] = body.contents;
    const prompt = contents
        .flatMap((content) => {
            if (!content || typeof content !== "object" || !("parts" in content) || !Array.isArray(content.parts)) {
                return [];
            }
            const parts: unknown[] = content.parts;
            return parts.flatMap((part) => {
                if (!part || typeof part !== "object" || !("text" in part) || typeof part.text !== "string") return [];
                return [part.text];
            });
        })
        .find((text) => text.startsWith('{"segments":'));
    if (!prompt) return [];

    const parsed: unknown = JSON.parse(prompt);
    if (!parsed || typeof parsed !== "object" || !("segments" in parsed) || !Array.isArray(parsed.segments)) return [];
    const segments: unknown[] = parsed.segments;
    return segments.flatMap((segment): PromptSegment[] => {
        if (
            !segment ||
            typeof segment !== "object" ||
            !("id" in segment) ||
            typeof segment.id !== "string" ||
            !("text" in segment) ||
            typeof segment.text !== "string"
        ) {
            return [];
        }
        return [{ id: segment.id, text: segment.text }];
    });
}

function createSuggestion(segments: PromptSegment[], mode: "first" | "second"): string {
    const matchingSegments = segments.filter((segment) => segment.text.includes("go"));
    const segment = mode === "second" ? matchingSegments.at(-1) : matchingSegments[0];
    if (!segment) return JSON.stringify({ suggestions: [] });
    const from = segment.text.indexOf("go");
    return JSON.stringify({
        suggestions: [
            {
                segmentId: segment.id,
                from,
                to: from + 2,
                original: "go",
                replacement: "goes",
                category: "grammar",
                explanation: "Use the verb form that agrees with the subject.",
            },
        ],
    });
}
function createWordSuggestion(segments: PromptSegment[]): string {
    const segment = segments.find(({ text }) => text.includes("word"));
    if (!segment) return JSON.stringify({ suggestions: [] });
    const from = segment.text.indexOf("word");
    return JSON.stringify({
        suggestions: [
            {
                segmentId: segment.id,
                from,
                to: from + 4,
                original: "word",
                replacement: "phrase",
                category: "clarity",
                explanation: "A more specific word is available.",
            },
        ],
    });
}
function geminiEventStream(text: string): string {
    return `data: ${JSON.stringify({
        candidates: [
            {
                content: { role: "model", parts: [{ text }] },
                finishReason: "STOP",
                index: 0,
            },
        ],
    })}\n\n`;
}

async function installProviderProxy(page: Page, state: ProxyState): Promise<void> {
    await page.route(GEMINI_PROXY_URL, async (route) => {
        const request = route.request();
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers: CORS_HEADERS });
            return;
        }

        const targetUrl = request.headers()["x-target-url"] ?? "";
        let isModelListRequest = false;
        try {
            const target = new URL(targetUrl);
            isModelListRequest =
                target.hostname === "generativelanguage.googleapis.com" && target.pathname === "/v1beta/models";
        } catch {
            isModelListRequest = false;
        }
        if (isModelListRequest) {
            await route.fulfill({
                status: 200,
                headers: { ...CORS_HEADERS, "content-type": "application/json" },
                body: JSON.stringify({
                    models: [
                        {
                            name: `models/${GEMINI_MODEL}`,
                            displayName: GEMINI_MODEL,
                            supportedGenerationMethods: ["generateContent"],
                        },
                    ],
                }),
            });
            return;
        }

        if (!targetUrl.includes(":streamGenerateContent")) {
            await route.fulfill({ status: 404, headers: CORS_HEADERS, body: "Unexpected test proxy target." });
            return;
        }

        const body: unknown = request.postDataJSON();
        const completion: CompletionRequest = { targetUrl, segments: extractPromptSegments(body), body };
        state.completionRequests.push(completion);
        const heldResponse = state.holdNextResponse;
        if (heldResponse) {
            state.holdNextResponse = null;
            heldResponse.started.resolve();
            await heldResponse.release.promise;
        }
        const mode = state.responseMode;

        if (mode === "network-error" || (mode === "batch-fails-second" && state.completionRequests.length === 2)) {
            if (mode === "network-error") {
                await route.abort("failed").catch(() => undefined);
            } else {
                await route
                    .fulfill({
                        status: 400,
                        headers: { ...CORS_HEADERS, "content-type": "application/json" },
                        body: JSON.stringify({ error: "Synthetic provider failure." }),
                    })
                    .catch(() => undefined);
            }
            return;
        }

        let responseText: string;
        if (mode === "invalid") {
            responseText = '{"suggestions":[';
        } else if (mode === "batch-fails-second" && state.completionRequests.length === 1) {
            responseText = createWordSuggestion(completion.segments);
        } else if (mode === "empty") {
            responseText = JSON.stringify({ suggestions: [] });
        } else if (mode === "correct-second") {
            responseText = createSuggestion(completion.segments, "second");
        } else {
            responseText = createSuggestion(completion.segments, "first");
        }

        await route
            .fulfill({
                status: 200,
                headers: {
                    ...CORS_HEADERS,
                    "content-type": "text/event-stream; charset=utf-8",
                    "cache-control": "no-cache",
                },
                body: geminiEventStream(responseText),
            })
            .catch(() => undefined);
    });
}

async function saveGeminiConfiguration(page: Page, withCredentials = true): Promise<void> {
    await page.goto("/settings/ai");
    await expect(page.getByRole("heading", { name: "AI" })).toBeVisible();
    await page.getByRole("button", { name: /Google Gemini/ }).click();

    if (withCredentials) {
        await page.getByPlaceholder("Google AI Studio API key").fill(GEMINI_API_KEY);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("combobox", { name: "Model" })).toHaveValue(GEMINI_MODEL);
    }

    await page.getByRole("button", { name: "Save Configuration" }).click();
    await expect(page.getByText("AI configuration saved.")).toBeVisible();
}

function editorSelector(mode: EditorMode): string {
    return mode === "formatted" ? ".ProseMirror" : ".cm-content";
}
async function waitForAutosave(page: Page): Promise<void> {
    const saveStatus = page.locator(".writeme-editor-status-bar output").first();
    await expect(saveStatus).toHaveText("Unsaved changes");
    await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
}

async function createNote(page: Page, title: string, mode: EditorMode, content: string, nativeReviewBridge = false) {
    await goHome(page);
    if (nativeReviewBridge) await installNativeWritingReviewBridge(page);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    const titleInput = dialog.getByTitle("Note title");
    await titleInput.fill(title);
    await expect(titleInput).toHaveValue(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(page.getByRole("textbox", { name: "Note title" })).toHaveValue(title);

    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: mode === "formatted" ? "Formatted" : "Markdown", exact: true })
        .click();
    const editor = page.locator(editorSelector(mode)).first();
    await expect(editor).toBeVisible();
    await editor.fill(content);
    await expect(editor).toContainText(content.split("\n")[0] ?? "");
    if (content !== "") await waitForAutosave(page);

    const noteUrl = page.url();
    const noteId = new URL(noteUrl).pathname.split("/").at(-1) ?? "";
    return { editor, noteUrl, noteId };
}

async function runImproveBySlash(
    page: Page,
    editor: Locator,
    scope: "paragraph" | "line" | "entire text" = "entire text",
): Promise<Locator> {
    const editorTop = await editor.evaluate((root) => root.getBoundingClientRect().top);
    await placeCaretAtStart(editor);
    await editor.pressSequentially(`/improve ${scope}`);
    const commandLabel = scope === "entire text" ? "Improve entire text" : `Improve ${scope}`;
    await page.getByRole("option", { name: new RegExp(commandLabel, "i") }).click();
    const panel = page.getByRole("dialog", { name: "Writing suggestions" }).last();
    await expect(panel).toBeVisible();

    const lineStart = await editor.evaluate((root) => {
        const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        if (!text) throw new Error("Expected the editor to contain a line to anchor the review panel.");
        const range = document.createRange();
        range.setStart(text, 0);
        range.collapse(true);
        return range.getBoundingClientRect().left;
    });
    const panelLayout = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            width: rect.width,
            viewportWidth: window.innerWidth,
            position: window.getComputedStyle(element).position,
            modal: element.matches(":modal"),
        };
    });
    expect(panelLayout.position).toBe("fixed");
    expect(panelLayout.width).toBeLessThan(panelLayout.viewportWidth);
    expect(panelLayout.left).toBeLessThanOrEqual(lineStart + 16);
    expect(panelLayout.modal).toBe(false);
    expect(await editor.evaluate((root) => root.getBoundingClientRect().top)).toBe(editorTop);
    return panel;
}

async function placeCaretAtStart(editor: Locator): Promise<void> {
    await expect(editor).toContainText(/\S/);
    await editor.evaluate((root) => {
        root.focus();
        const firstText = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        if (!firstText) throw new Error("Expected the formatted editor to contain text.");
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
    });
}
function exposeNativeWritingReviewBridge(): void {
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: {
            writingAssistant: {
                onImproveSelectedText(callback: () => void) {
                    const handler = (): void => callback();
                    window.addEventListener("writeme-test-native-review", handler);
                    return () => window.removeEventListener("writeme-test-native-review", handler);
                },
            },
        },
    });
}

async function installNativeWritingReviewBridge(page: Page): Promise<void> {
    await page.addInitScript(exposeNativeWritingReviewBridge);
    await page.evaluate(exposeNativeWritingReviewBridge);
}

async function improveEntireSelection(page: Page, editor: Locator): Promise<Locator> {
    await editor.focus();
    await editor.press("ControlOrMeta+a");
    const hasSelectedSource = await editor.evaluate((root) => {
        const selection = window.getSelection();
        return Boolean(
            selection &&
            !selection.isCollapsed &&
            selection.rangeCount > 0 &&
            root.contains(selection.anchorNode) &&
            root.contains(selection.focusNode),
        );
    });
    if (!hasSelectedSource) throw new Error("Expected the Markdown editor to select its source.");
    await editor.evaluate((root) => {
        root.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        window.dispatchEvent(new Event("writeme-test-native-review"));
    });
    const panel = page.getByRole("dialog", { name: "Writing suggestions" }).last();
    await expect(panel).toBeVisible();
    return panel;
}

async function chooseTheme(page: Page, theme: "light" | "dark"): Promise<void> {
    await page.goto("/settings/appearance");
    await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
    await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
    await page.getByRole("button", { name: "Save Appearance" }).click();
}

for (const mode of ["formatted", "markdown"] as const) {
    test(`review suggestions stay explicit and undoable in ${mode} mode`, async ({ cleanPage: page }) => {
        const proxy = createProxyState();
        await installProviderProxy(page, proxy);
        await saveGeminiConfiguration(page);
        const { editor, noteUrl } = await createNote(
            page,
            `Writing review ${mode}`,
            mode,
            "She go to school.\n\nAnother paragraph.",
            mode === "markdown",
        );
        const startReview = (): Promise<Locator> =>
            mode === "formatted" ? runImproveBySlash(page, editor) : improveEntireSelection(page, editor);

        expect(await page.getByRole("button", { name: "Writing assistant" }).count()).toBe(0);
        const panel = await startReview();

        const firstSuggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
        await expect(firstSuggestion).toBeVisible();
        expect(proxy.completionRequests).toHaveLength(1);
        await expect(editor.locator("[data-writing-suggestion-id]")).toContainText("go");
        expect(proxy.completionRequests[0]?.segments.map(({ text }) => text)).toContain("She go to school.");
        expect(proxy.completionRequests[0]?.segments.map(({ text }) => text)).toContain("Another paragraph.");

        await firstSuggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" }).click();
        await expect(editor).toContainText("She goes to school.");
        await expect(editor.locator("[data-writing-suggestion-id]")).toHaveCount(0);
        await editor.press("ControlOrMeta+z");
        await expect(editor).toContainText("She go to school.");

        await startReview();
        const dismissedSuggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
        await expect(dismissedSuggestion).toBeVisible();
        await dismissedSuggestion.getByRole("button", { name: "Dismiss grammar suggestion 1 for go" }).click();
        await expect(editor).toContainText("She go to school.");
        await expect(panel.getByRole("article")).toHaveCount(0);

        await startReview();
        const acceptedSuggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
        await expect(acceptedSuggestion).toBeVisible();
        await acceptedSuggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" }).click();
        await expect(editor).toContainText("She goes to school.");
        await waitForAutosave(page);
        await page.reload();
        await expect(page).toHaveURL(noteUrl);
        const reloadedEditor = page.locator(editorSelector(mode)).first();
        await expect(reloadedEditor).toContainText("She goes to school.");
        await expect(reloadedEditor.locator("[data-writing-suggestion-id]")).toHaveCount(0);
    });
}
test("slash commands review the cursor's manual line, paragraph, or entire note scope", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(page, "Writing review scopes", "formatted", "");
    await editor.focus();
    await editor.pressSequentially("First line go wrong.");
    await editor.press("Shift+Enter");
    await editor.pressSequentially("Second line.");
    await editor.press("Enter");
    await editor.pressSequentially("Third paragraph.");
    await placeCaretAtStart(editor);

    const linePanel = await runImproveBySlash(page, editor, "line");
    await expect(linePanel.getByRole("article", { name: /Grammar suggestion 1 for go/ })).toBeVisible();
    expect(proxy.completionRequests[0]?.segments.map(({ text }) => text)).toEqual(["First line go wrong."]);
    await linePanel
        .getByRole("article", { name: /Grammar suggestion 1 for go/ })
        .getByRole("button", { name: "Dismiss grammar suggestion 1 for go" })
        .click();

    await placeCaretAtStart(editor);
    const paragraphPanel = await runImproveBySlash(page, editor, "paragraph");
    await expect(paragraphPanel.getByRole("article", { name: /Grammar suggestion 1 for go/ })).toBeVisible();
    const paragraphSegments = proxy.completionRequests[1]?.segments.map(({ text }) => text).join("");
    expect(paragraphSegments).toContain("First line go wrong.");
    expect(paragraphSegments).toContain("Second line.");
    expect(paragraphSegments).not.toContain("Third paragraph.");
});

test("slash commands expose a separate whole-note scope", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(
        page,
        "Writing entire-note command",
        "formatted",
        "She go to school.\n\nAnother paragraph.",
    );

    await runImproveBySlash(page, editor, "entire text");
    await expect(page.getByRole("article", { name: /Grammar suggestion 1 for go/ })).toBeVisible();
    const reviewed = proxy.completionRequests[0]?.segments.map(({ text }) => text).join("");
    expect(reviewed).toContain("She go to school.");
    expect(reviewed).toContain("Another paragraph.");
});
test("writing suggestions float at the start of the reviewed line", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(
        page,
        "Writing review floating panel",
        "formatted",
        "She go to school. Leave this sentence untouched.",
    );

    const panel = await runImproveBySlash(page, editor, "line");
    await expect(panel.getByRole("article", { name: /Grammar suggestion 1 for go/ })).toBeVisible();
});

test("whole-note review and prose extraction leave Markdown structure and excluded content untouched", async ({
    cleanPage: page,
}) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const markdown = [
        "---",
        "title: Hidden metadata",
        "---",
        "",
        "**She go to school.**",
        "",
        "Another paragraph.",
        "",
        "[linked prose](https://private.test/path)",
        "",
        "`inline code`",
        "",
        "$x^2$",
        "",
        "```js",
        "const hidden = true;",
        "```",
        "",
        "[[wiki note]]",
        "![[embedded note]]",
    ].join("\n");
    const { editor } = await createNote(page, "Writing review exclusions", "markdown", markdown, true);
    const panel = await improveEntireSelection(page, editor);
    const noteSuggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
    await expect(noteSuggestion).toBeVisible();
    const reviewedSegments = proxy.completionRequests[0]?.segments.map(({ text }) => text) ?? [];
    expect(reviewedSegments).toContain("She go to school.");
    expect(reviewedSegments).toContain("Another paragraph.");
    const reviewedText = reviewedSegments.join("\n");
    for (const excluded of [
        "Hidden metadata",
        "private.test",
        "inline code",
        "x^2",
        "const hidden",
        "wiki note",
        "embedded note",
    ]) {
        expect(reviewedText).not.toContain(excluded);
    }

    await noteSuggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" }).click();
    const sourceAfterAccept = (await editor.textContent()) ?? "";
    expect(sourceAfterAccept).toContain("**She goes to school.**");
    expect(sourceAfterAccept).toContain("[linked prose](https://private.test/path)");
    expect(sourceAfterAccept).toContain("const hidden = true;");
    expect(sourceAfterAccept).toContain("$x^2$");
});

test("empty, invalid, failed, and cancelled reviews produce distinct visible states", async ({ cleanPage: page }) => {
    await page.addInitScript(() => {
        const diagnosticsWindow = window as Window & { __writingAssistantUnhandled: string[] };
        diagnosticsWindow.__writingAssistantUnhandled = [];
        window.addEventListener("unhandledrejection", (event) => {
            const reason = event.reason;
            if (typeof reason !== "object" || reason === null || !("name" in reason) || typeof reason.name !== "string")
                return;
            if (reason.name === "AI_NoOutputGeneratedError" || reason.name === "AbortError") {
                diagnosticsWindow.__writingAssistantUnhandled.push(reason.name);
            }
        });
    });
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(page, "Writing review states", "formatted", "She go to school.");
    const panel = await runImproveBySlash(page, editor);

    proxy.responseMode = "empty";
    await runImproveBySlash(page, editor);
    await expect(panel.getByRole("heading", { name: "Looks good" })).toBeVisible();
    await expect(panel.getByRole("status")).toContainText("No meaningful changes suggested.");
    await expect(panel.getByRole("button", { name: "Review entire note" })).toHaveCount(0);
    await expect(panel.getByRole("article")).toHaveCount(0);

    proxy.responseMode = "invalid";
    await runImproveBySlash(page, editor);
    await expect(panel.getByRole("alert")).toContainText("could not be safely applied");

    proxy.responseMode = "network-error";
    await runImproveBySlash(page, editor);
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Retry review" })).toBeVisible();
    await expect(editor).toContainText("She go to school.");

    proxy.responseMode = "correct-first";
    const held = { started: deferred(), release: deferred() };
    proxy.holdNextResponse = held;
    await runImproveBySlash(page, editor);
    await held.started.promise;
    await expect(panel.getByRole("button", { name: "Stop review" })).toBeVisible();
    await panel.getByRole("button", { name: "Stop review" }).click();
    held.release.resolve();
    await expect(panel.getByRole("button", { name: "Stop review" })).toHaveCount(0);
    await expect(panel.getByRole("article")).toHaveCount(0);
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 0)));
    expect(
        await page.evaluate(
            () => (window as Window & { __writingAssistantUnhandled: string[] }).__writingAssistantUnhandled,
        ),
    ).toEqual([]);
});

test("a pending response cannot reappear after an editor-mode change", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(page, "Writing review mode switch", "formatted", "She go to school.");
    const held = { started: deferred(), release: deferred() };
    proxy.holdNextResponse = held;

    await runImproveBySlash(page, editor);
    await held.started.promise;
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 10_000 });
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    const rawEditor = page.locator(".cm-content").first();
    await expect(rawEditor).toBeVisible();
    held.release.resolve();
    await page.waitForTimeout(100);

    await expect(page.getByRole("dialog", { name: "Writing suggestions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Writing assistant" })).toHaveCount(0);
    await expect(rawEditor).toContainText("She go to school.");
});

test("missing configuration and missing provider credentials stay actionable", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    const { editor, noteUrl } = await createNote(page, "Writing review setup", "formatted", "She go to school.");
    const noConfigurationPanel = await runImproveBySlash(page, editor);
    await expect(noConfigurationPanel).toContainText("No saved AI configuration is available");
    await expect(noConfigurationPanel.getByRole("link", { name: "Configure AI" })).toBeVisible();
    expect(proxy.completionRequests).toHaveLength(0);

    await saveGeminiConfiguration(page, false);
    await page.goto(noteUrl);
    const missingCredentialsEditor = page.locator(".ProseMirror").first();
    const missingCredentialsPanel = await runImproveBySlash(page, missingCredentialsEditor);
    await expect(missingCredentialsPanel.getByRole("alert")).toContainText(
        "Unable to access this provider's credentials",
    );
    expect(proxy.completionRequests).toHaveLength(0);
});

test("a second-batch provider failure does not publish first-batch suggestions", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const longText = "word ".repeat(1_640).trimEnd();
    const { editor } = await createNote(page, "Writing review batches", "markdown", longText, true);
    proxy.responseMode = "batch-fails-second";
    const panel = await improveEntireSelection(page, editor);
    await expect(panel.getByRole("alert")).toBeVisible();
    expect(proxy.completionRequests).toHaveLength(2);
    const batchLengths = proxy.completionRequests.map((request) =>
        request.segments.reduce((total, segment) => total + segment.text.length, 0),
    );
    expect(batchLengths).toHaveLength(2);
    const firstBatchLength = batchLengths[0] ?? 0;
    const secondBatchLength = batchLengths[1] ?? 0;
    expect(firstBatchLength).toBeLessThanOrEqual(8_000);
    expect(secondBatchLength).toBeGreaterThan(0);
    expect(firstBatchLength + secondBatchLength).toBe(longText.length);
    await expect(panel.getByRole("article")).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) {
    test(`keeps the ${theme} review panel readable at regular and narrow widths`, async ({
        cleanPage: page,
    }, testInfo) => {
        const proxy = createProxyState();
        await installProviderProxy(page, proxy);
        await saveGeminiConfiguration(page);
        await chooseTheme(page, theme);
        const { editor } = await createNote(page, `Writing review ${theme} layout`, "formatted", "She go to school.");
        const panel = await runImproveBySlash(page, editor);
        const suggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
        await expect(suggestion).toBeVisible();
        const accept = suggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" });
        await accept.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(accept).toBeFocused();

        for (const width of [1_280, 720]) {
            await page.setViewportSize({ width, height: 800 });
            const panelBounds = await panel.boundingBox();
            const editorBounds = await editor.boundingBox();
            const acceptBounds = await accept.boundingBox();
            if (!panelBounds || !editorBounds || !acceptBounds) {
                throw new Error("Expected the review panel, editor, and accept control to be visible.");
            }
            expect(acceptBounds.x + acceptBounds.width).toBeLessThanOrEqual(panelBounds.x + panelBounds.width + 1);
            expect(panelBounds.x).toBeGreaterThanOrEqual(0);
            expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(width);
            expect(panelBounds.y).toBeGreaterThanOrEqual(0);
            expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(800);
            await page.screenshot({
                path: testInfo.outputPath(`writing-assistant-${theme}-${width}.png`),
                fullPage: true,
            });
        }
    });
}

test("keyboard navigation reaches suggestion actions and Escape returns focus to the editor", async ({
    cleanPage: page,
}) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const { editor } = await createNote(page, "Writing review keyboard", "formatted", "She go to school.");
    const panel = await runImproveBySlash(page, editor);
    const suggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
    await expect(suggestion).toBeVisible();
    await suggestion.focus();
    await expect(suggestion).toBeFocused();

    const showSuggestion = suggestion.getByRole("button", { name: "Show suggestion 1 in note" });
    await page.keyboard.press("Tab");
    await expect(showSuggestion).toBeFocused();

    const accept = suggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" });
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(editor).toBeFocused();
});

test("split panes keep review suggestions scoped to their own notes", async ({ cleanPage: page }) => {
    const proxy = createProxyState();
    await installProviderProxy(page, proxy);
    await saveGeminiConfiguration(page);
    const first = await createNote(page, "Writing pane one", "formatted", "She go to school.");
    const secondNoteId = await page.evaluate(async () => {
        const loadModule = (path: string) => import(new URL(path, window.location.origin).href);
        const { db } = await loadModule("/src/store/repositories/browser/dexie-db.ts");
        const { Note } = await loadModule("/src/store/note.ts");
        const note = Note.new("Writing pane two", "He go to school.");
        await db.notes.put(note);
        return note.id;
    });
    await goHome(page);
    await expect(
        page.getByRole("list", { name: "Notes" }).getByRole("listitem").filter({ hasText: "Writing pane two" }),
    ).toBeVisible();

    await page.goto(first.noteUrl);
    await page.getByRole("button", { name: "Open pane mode" }).click();
    await expect(page.getByText("2 editor panes")).toBeVisible();
    await page.getByRole("combobox", { name: "Select note for pane 2" }).selectOption(secondNoteId);
    const editors = page.locator(".ProseMirror:visible");
    await expect(editors).toHaveCount(2);
    await expect(editors.nth(0)).toContainText("She go to school.");
    await expect(editors.nth(1)).toContainText("He go to school.");

    const panel = await runImproveBySlash(page, editors.nth(1));
    const suggestion = panel.getByRole("article", { name: /Grammar suggestion 1 for go/ });
    await expect(suggestion).toBeVisible();
    expect(proxy.completionRequests.at(-1)?.segments.map(({ text }) => text)).toEqual(["He go to school."]);
    await suggestion.getByRole("button", { name: "Accept grammar suggestion 1 for go" }).click();

    await expect(editors.nth(0)).toContainText("She go to school.");
    await expect(editors.nth(0)).not.toContainText("She goes to school.");
    await expect(editors.nth(1)).toContainText("He goes to school.");
});

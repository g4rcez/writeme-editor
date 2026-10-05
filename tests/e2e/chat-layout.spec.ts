import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

const CHAT_ID = "chat-layout-e2e";
const CHAT_SCOPE = "workspace:__local__";
const LAST_REPLY = "Assistant response 12";

const seedLongConversation = async (page: Page): Promise<void> => {
    await page.evaluate(
        async ({ chatId, chatScope }) => {
            const database = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open("writeme");
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error ?? new Error("Could not open the browser database."));
            });
            const transaction = database.transaction(["aiChats", "aiMessages"], "readwrite");
            transaction.objectStore("aiChats").put({
                id: chatId,
                noteId: chatScope,
                title: "A longer conversation",
                createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
                updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            });
            const messages = transaction.objectStore("aiMessages");
            for (let index = 1; index <= 12; index += 1) {
                const createdAt = new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 1000).toISOString();
                messages.put({
                    id: `user-${index}`,
                    chatId,
                    role: "user",
                    content: `Question ${index}: ${"Please keep the surrounding conversation context in view. ".repeat(2)}`,
                    createdAt,
                });
                messages.put({
                    id: `assistant-${index}`,
                    chatId,
                    role: "assistant",
                    content: `Assistant response ${index}. ${"This reply keeps the conversation readable and provides context for the next turn. ".repeat(3)}`,
                    createdAt: new Date(Date.parse(createdAt) + 1).toISOString(),
                    workspaceData:
                        index === 12
                            ? {
                                  activities: [
                                      {
                                          id: "research-activity",
                                          toolName: "searchNotes",
                                          label: "Searched notes for conversation context",
                                          status: "complete",
                                      },
                                  ],
                                  sources: [{ noteId: "source-note", title: "Conversation context" }],
                                  proposals: [],
                              }
                            : undefined,
                });
            }
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error("Could not seed the chat."));
                transaction.onabort = () => reject(transaction.error ?? new Error("Chat seeding was aborted."));
            });
            database.close();
        },
        { chatId: CHAT_ID, chatScope: CHAT_SCOPE },
    );
};

test.describe("AI chat layout", () => {
    test("keeps latest replies reachable and research details close to the answer", async ({ cleanPage: page }) => {
        await goHome(page);
        await seedLongConversation(page);
        await page.goto(`/chat?chatId=${CHAT_ID}`);

        const messageLog = page.getByRole("log", { name: "Chat messages" });
        await expect(page.getByRole("heading", { name: "A longer conversation" })).toBeVisible();
        await expect(messageLog.getByText(new RegExp(`^${LAST_REPLY}\\.`))).toBeVisible();
        await expect(messageLog.getByRole("button", { name: "Conversation context" })).toBeVisible();
        const researchToggle = messageLog.getByRole("button", { name: /Research/ });
        await expect(researchToggle).toHaveAttribute("aria-expanded", "false");
        await researchToggle.click();
        await expect(messageLog.getByText("Searched notes for conversation context")).toBeVisible();

        await expect
            .poll(() => messageLog.evaluate((element) => element.scrollHeight - element.clientHeight))
            .toBeGreaterThan(0);

        await messageLog.evaluate((element) => {
            element.scrollTop = 0;
        });

        const jumpToLatest = page.getByRole("button", { name: "Jump to latest message" });
        await expect(jumpToLatest).toBeVisible();
        await jumpToLatest.click();
        await expect
            .poll(() =>
                messageLog.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
            )
            .toBeLessThanOrEqual(80);
        await expect(jumpToLatest).toBeHidden();

        await page.setViewportSize({ width: 375, height: 812 });
        await expect(page.getByRole("form", { name: "AI message composer" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
});

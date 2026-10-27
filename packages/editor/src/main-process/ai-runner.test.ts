// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { children } = vi.hoisted(() => ({ children: [] as any[] }));

vi.mock("node:child_process", () => ({
    spawn: vi.fn(() => {
        const child: any = new EventEmitter();
        child.stdin = { write: vi.fn(), end: vi.fn() };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = vi.fn();
        children.push(child);
        return child;
    }),
}));

import { AIRunner } from "./ai-runner";

const makeSender = () => ({ send: vi.fn(), isDestroyed: vi.fn(() => false) });
const variables = { prompt: "hi", selection: "", context: "", systemPrompt: "" };
const names = (sender: ReturnType<typeof makeSender>, channel: string) =>
    sender.send.mock.calls.filter(([name]) => name === channel).map(([, payload]) => payload);

beforeEach(() => {
    children.length = 0;
    AIRunner.stop();
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("AIRunner process tracking", () => {
    it("keeps tracking the newest process when the replaced one closes late", async () => {
        const sender = makeSender();
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        const [replaced, current] = children;
        expect(replaced.kill).toHaveBeenCalledWith("SIGTERM");

        replaced.emit("close", null);
        expect(names(sender, "ai:done")).toHaveLength(0);

        AIRunner.stop();
        expect(current.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("ignores output from a replaced process", async () => {
        const sender = makeSender();
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        children[0].stdout.emit("data", Buffer.from("stale"));
        children[1].stdout.emit("data", Buffer.from("fresh"));
        expect(names(sender, "ai:chunk")).toEqual([{ chunk: "fresh" }]);
    });

    it("still reports done after a manual stop so the UI leaves its streaming state", async () => {
        const sender = makeSender();
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        AIRunner.stop();
        children[0].emit("close", 143);
        expect(names(sender, "ai:done")).toEqual([{ code: 143 }]);
    });

    it("does not send to a destroyed window", async () => {
        const sender = makeSender();
        await AIRunner.run("claude {{prompt}}", variables, sender as any);
        sender.isDestroyed.mockReturnValue(true);
        children[0].stdout.emit("data", Buffer.from("late"));
        children[0].emit("close", 0);
        expect(sender.send).not.toHaveBeenCalled();
    });
});

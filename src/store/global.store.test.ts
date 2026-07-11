import { describe, expect, it, vi } from "vitest";
import { useGlobalStore } from "./global.store";

vi.mock("./repositories", () => ({
    repositories: {
        tabs: {
            getAll: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
            updateOrder: vi.fn(),
        },
        notes: {
            update: vi.fn(),
            getRecentNotes: vi.fn(),
        },
        projects: {
            getAll: vi.fn(),
        },
        terminalSessions: {
            getOne: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
    };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Global Store", () => {
    it("should have loadRecentNotes action", () => {
        expect(useGlobalStore.dispatchers.loadRecentNotes).toBeDefined();
    });

    it("should have addTab action", () => {
        expect(useGlobalStore.dispatchers.addTab).toBeDefined();
    });

    it("should have addTerminalTab action", () => {
        expect(useGlobalStore.dispatchers.addTerminalTab).toBeDefined();
    });
});

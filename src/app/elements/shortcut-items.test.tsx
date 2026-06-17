import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useWritemeShortcuts, Type } from "./shortcut-items";
import { useGlobalStore } from "../../store/global.store";

vi.mock("../../store/global.store", () => ({
	CommanderType: {
		All: "all",
		Notes: "Notes",
		OpenTabs: "OpenTabs",
	},
	useGlobalStore: vi.fn(),
	globalDispatch: {
		theme: vi.fn(),
	},
}));

vi.mock("../../lib/is-electron", () => ({
	isElectron: vi.fn(() => true),
}));

describe("shortcut-items", () => {
	const dispatch = {
		commander: vi.fn(),
		directoryBrowserDialog: vi.fn(),
		help: vi.fn(),
		recentNotesDialog: vi.fn(),
		setAiDrawer: vi.fn(),
		theme: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(useGlobalStore as any).mockReturnValue([{ theme: "dark" }, dispatch]);
	});

	it("should not include an Open Recent keyboard shortcut", () => {
		const { result } = renderHook(() => useWritemeShortcuts(), {
			wrapper: MemoryRouter,
		});

		expect(
			result.current.find((s) => s.description === "Open Recent"),
		).toBeUndefined();
		expect(result.current.find((s) => s.bind === "mod+e")).toBeUndefined();
	});

	it("should have all required shortcuts", () => {
		const { result } = renderHook(() => useWritemeShortcuts(), {
			wrapper: MemoryRouter,
		});
		const descriptions = result.current.map((s) => s.description);

		expect(descriptions).toContain("Commander");
		expect(descriptions).toContain("Open Tabs");
		expect(descriptions).toContain("Settings");
		expect(descriptions).toContain("Browse files");
		expect(descriptions).toContain("Open...");
	});

	it("includes the Commander shortcut binding", () => {
		const { result } = renderHook(() => useWritemeShortcuts(), {
			wrapper: MemoryRouter,
		});
		const commander = result.current.find((s) => s.description === "Commander");

		expect(commander).toBeDefined();
		expect(commander?.bind).toBe("mod+shift+p");
		expect(commander?.type).toBe(Type.Shortcut);
	});

	it("includes the Settings shortcut binding", () => {
		const { result } = renderHook(() => useWritemeShortcuts(), {
			wrapper: MemoryRouter,
		});
		const settings = result.current.find((s) => s.description === "Settings");

		expect(settings).toBeDefined();
		expect(settings?.bind).toBe("mod+,");
		expect(settings?.type).toBe(Type.Shortcut);
	});

	it("opens the commander in opened-tabs mode from the Open Tabs shortcut", () => {
		const { result } = renderHook(() => useWritemeShortcuts(), {
			wrapper: MemoryRouter,
		});
		const openTabs = result.current.find((s) => s.description === "Open Tabs");

		expect(openTabs).toBeDefined();
		expect(openTabs?.bind).toBe("mod+t");

		openTabs?.action();

		expect(dispatch.commander).toHaveBeenCalledWith(true, "OpenTabs");
	});
});

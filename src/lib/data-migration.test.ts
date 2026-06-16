import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";

const mocks = vi.hoisted(() => ({
	db: {
		notes: { bulkPut: vi.fn(), toArray: vi.fn() },
		tabs: { bulkPut: vi.fn(), toArray: vi.fn() },
		hashtags: { bulkPut: vi.fn(), toArray: vi.fn() },
		settings: { bulkPut: vi.fn(), toArray: vi.fn() },
		scripts: { bulkPut: vi.fn(), toArray: vi.fn() },
	},
}));

vi.mock("@/store/repositories/browser/dexie-db", () => ({
	db: mocks.db,
}));

const { exportToFile, importFromFile } = await import("./data-migration");

const noteTab = { id: "note-tab", noteId: "note-1", type: "tab" };
const terminalTab = {
	id: "terminal-tab",
	noteId: "terminal-1",
	type: TERMINAL_TAB_TYPE,
};

describe("data migration terminal tab filtering", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.db.notes.bulkPut.mockResolvedValue(undefined);
		mocks.db.tabs.bulkPut.mockResolvedValue(undefined);
		mocks.db.hashtags.bulkPut.mockResolvedValue(undefined);
		mocks.db.settings.bulkPut.mockResolvedValue(undefined);
		mocks.db.scripts.bulkPut.mockResolvedValue(undefined);
	});

	it("drops terminal tabs during import", async () => {
		const file = {
			text: vi.fn().mockResolvedValue(
				JSON.stringify({
					type: "writeme-migration",
					version: 1,
					notes: [],
					tabs: [noteTab, terminalTab],
					hashtags: [],
					settings: [],
					scripts: [],
				}),
			),
		} as unknown as File;

		const counts = await importFromFile(file);

		expect(mocks.db.tabs.bulkPut).toHaveBeenCalledWith([noteTab]);
		expect(counts.tabs).toBe(1);
	});

	it("drops terminal tabs from exported backup payloads", async () => {
		mocks.db.notes.toArray.mockResolvedValue([]);
		mocks.db.tabs.toArray.mockResolvedValue([noteTab, terminalTab]);
		mocks.db.hashtags.toArray.mockResolvedValue([]);
		mocks.db.settings.toArray.mockResolvedValue([]);
		mocks.db.scripts.toArray.mockResolvedValue([]);
		const createObjectURL = vi.fn(
			(_object: Blob | MediaSource) => "blob:writeme-backup",
		);
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: createObjectURL,
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: revokeObjectURL,
		});
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});

		await exportToFile();

		const blob = createObjectURL.mock.calls[0]?.[0];
		if (!(blob instanceof Blob)) {
			throw new Error("Expected exportToFile to create a Blob backup");
		}
		const payload = JSON.parse(await blob.text()) as { tabs: unknown[] };
		expect(payload.tabs).toStrictEqual([noteTab]);
		expect(click).toHaveBeenCalled();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:writeme-backup");
	});
});

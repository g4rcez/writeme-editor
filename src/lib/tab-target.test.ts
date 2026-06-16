import { describe, expect, it } from "vitest";

import {
	getCurrentRouteTabTarget,
	getRouteForTabTarget,
	TERMINAL_TAB_TYPE,
	getTabTarget,
} from "./tab-target";

describe("terminal tab targets", () => {
	it("routes terminal targets to terminal session pages", () => {
		expect(getRouteForTabTarget({ type: "terminal", id: "terminal-1" })).toBe(
			"/terminal/terminal-1",
		);
	});

	it("parses terminal session routes", () => {
		expect(getCurrentRouteTabTarget("/terminal/session%201", "")).toStrictEqual(
			{ type: "terminal", id: "session 1" },
		);
	});

	it("maps terminal tab rows to terminal targets", () => {
		expect(
			getTabTarget({ noteId: "terminal-1", type: TERMINAL_TAB_TYPE }),
		).toStrictEqual({ type: "terminal", id: "terminal-1" });
	});
});

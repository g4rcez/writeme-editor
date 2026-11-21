import { beforeEach, describe, expect, it, vi } from "vitest";
import { canGoBack, goBackOrHome } from "./navigation-history";

beforeEach(() => window.history.replaceState({ idx: 0 }, ""));

describe("navigation history", () => {
    it("reports whether the app history has an entry to return to", () => {
        expect(canGoBack()).toBe(false);
        window.history.replaceState({ idx: 2 }, "");
        expect(canGoBack()).toBe(true);
        window.history.replaceState(null, "");
        expect(canGoBack()).toBe(false);
    });

    it("pops history when possible and otherwise replaces with home", () => {
        const navigate = vi.fn();
        window.history.replaceState({ idx: 1 }, "");
        goBackOrHome(navigate);
        expect(navigate).toHaveBeenLastCalledWith(-1);
        window.history.replaceState({ idx: 0 }, "");
        goBackOrHome(navigate);
        expect(navigate).toHaveBeenLastCalledWith("/notes", { replace: true });
        goBackOrHome(navigate, "/today");
        expect(navigate).toHaveBeenLastCalledWith("/today", { replace: true });
    });
});

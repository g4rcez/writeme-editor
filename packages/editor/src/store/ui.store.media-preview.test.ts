import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiDispatch, useUIStore } from "./ui.store";

const source = (src: string) => ({ src, type: "image" as const, title: src });
const revoke = vi.fn();

beforeEach(() => {
    revoke.mockClear();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: revoke }));
    uiDispatch.closeMediaPreview();
    revoke.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe("media preview blob URLs", () => {
    it("revokes every blob URL when the preview closes and drops the sources", () => {
        uiDispatch.openMediaPreview([source("blob:a"), source("blob:b"), source("blob:c")], 1);
        uiDispatch.closeMediaPreview();

        expect(revoke.mock.calls.map(([url]) => url)).toEqual(["blob:a", "blob:b", "blob:c"]);
        expect(useUIStore.getState().mediaPreview).toEqual({ open: false, sources: [], index: 0 });
    });

    it("revokes the previous folder's URLs when another preview replaces it", () => {
        uiDispatch.openMediaPreview([source("blob:old-1"), source("blob:old-2")]);
        uiDispatch.openMediaPreview([source("blob:new")]);

        expect(revoke.mock.calls.map(([url]) => url)).toEqual(["blob:old-1", "blob:old-2"]);
        expect(useUIStore.getState().mediaPreview.sources.map(({ src }) => src)).toEqual(["blob:new"]);
    });

    it("leaves non-blob sources alone", () => {
        uiDispatch.openMediaPreview([source("https://example.com/a.png")]);
        uiDispatch.closeMediaPreview();
        expect(revoke).not.toHaveBeenCalled();
    });
});

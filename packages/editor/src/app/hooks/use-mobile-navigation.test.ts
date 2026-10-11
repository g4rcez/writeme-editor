import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileNavigation } from "./use-mobile-navigation";

const mocks = vi.hoisted(() => ({
    native: vi.fn(() => true),
    platform: vi.fn(() => "android"),
    navigate: vi.fn(),
    ui: vi.fn(),
    state: vi.fn(),
    clearConfirm: vi.fn(),
    clearPrompt: vi.fn(),
    clearAlert: vi.fn(),
    sidebar: vi.fn(),
    createNote: vi.fn(),
    commander: vi.fn(),
    minimize: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    listen: vi.fn(async (_event: string, _callback: () => void) => ({ remove: mocks.remove })),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.native, getPlatform: mocks.platform } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.listen, minimizeApp: mocks.minimize } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/store/ui.store", () => ({
    useUIStore: {
        getState: mocks.ui,
        dispatchers: {
            clearConfirm: mocks.clearConfirm,
            clearPrompt: mocks.clearPrompt,
            clearAlert: mocks.clearAlert,
            setSidebarOpen: mocks.sidebar,
        },
    },
}));
vi.mock("@/store/global.store", () => ({
    globalState: mocks.state,
    globalDispatch: { setCreateNoteDialog: mocks.createNote, commander: mocks.commander },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.native.mockReturnValue(true);
    mocks.platform.mockReturnValue("android");
    mocks.ui.mockReturnValue({ sidebarOpen: false });
    mocks.state.mockReturnValue({ createNoteDialog: { isOpen: false, type: "note" }, commander: { enabled: false } });
    window.history.replaceState({ idx: 0 }, "");
});
afterEach(cleanup);

async function pressBack(): Promise<void> {
    await waitFor(() => expect(mocks.listen).toHaveBeenCalled());
    act(() => mocks.listen.mock.calls.at(-1)?.[1]());
}

describe("Android system Back", () => {
    it("does not register on the web or iOS", () => {
        mocks.native.mockReturnValue(false);
        const web = renderHook(useMobileNavigation);
        web.unmount();
        mocks.native.mockReturnValue(true);
        mocks.platform.mockReturnValue("ios");
        renderHook(useMobileNavigation);
        expect(mocks.listen).not.toHaveBeenCalled();
    });

    it("dismisses a confirmation before navigating", async () => {
        const cancel = vi.fn();
        mocks.ui.mockReturnValue({ confirm: { onCancel: cancel }, sidebarOpen: true });
        window.history.replaceState({ idx: 2 }, "");
        const hook = renderHook(useMobileNavigation);
        await pressBack();
        expect(cancel).toHaveBeenCalledOnce();
        expect(mocks.clearConfirm).toHaveBeenCalledOnce();
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.sidebar).not.toHaveBeenCalled();
        hook.unmount();
        expect(mocks.remove).toHaveBeenCalledOnce();
    });

    it("dismisses note creation and the sidebar before navigating", async () => {
        mocks.state.mockReturnValue({ createNoteDialog: { isOpen: true, type: "pdf" }, commander: { enabled: false } });
        mocks.ui.mockReturnValue({ sidebarOpen: true });
        renderHook(useMobileNavigation);
        await pressBack();
        expect(mocks.createNote).toHaveBeenCalledWith({ isOpen: false, type: "pdf" });
        expect(mocks.sidebar).not.toHaveBeenCalled();
        mocks.state.mockReturnValue({ createNoteDialog: { isOpen: false }, commander: { enabled: false } });
        await pressBack();
        expect(mocks.sidebar).toHaveBeenCalledWith(false);
    });

    it("returns through app history and minimizes at the root", async () => {
        renderHook(useMobileNavigation);
        window.history.replaceState({ idx: 1 }, "");
        await pressBack();
        expect(mocks.navigate).toHaveBeenCalledWith(-1);
        expect(mocks.minimize).not.toHaveBeenCalled();
        window.history.replaceState({ idx: 0 }, "");
        await pressBack();
        expect(mocks.minimize).toHaveBeenCalledOnce();
    });
});

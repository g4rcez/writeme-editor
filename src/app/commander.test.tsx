import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Commander } from "./commander";

const mocks = vi.hoisted(() => {
  const state = {
    commander: { enabled: true, type: "all" },
    note: null,
    noteGroups: [],
    notes: [],
    tabs: [],
    theme: "dark",
  };
  const dispatch = {
    clearTabs: vi.fn(),
    commander: vi.fn(),
    directoryBrowserDialog: vi.fn(),
    loadGroups: vi.fn(),
    recentNotesDialog: vi.fn(),
    setAiDrawer: vi.fn(),
    setCreateNoteDialog: vi.fn(),
    setInspectJsonDialog: vi.fn(),
    theme: vi.fn(),
    toggleTerminal: vi.fn(),
  };

  return {
    commandPalette: vi.fn(() => null),
    dispatch,
    layoutDispatch: {
      setActivity: vi.fn(),
    },
    navigate: vi.fn(),
    settingsLoad: vi.fn(() => ({ directory: null })),
    state,
  };
});

type CommandItem = {
  title?: string;
  shortcut?: string;
  items?: CommandItem[];
  action?: (args: { setOpen: (value: boolean) => void }) => void;
};

vi.mock("@g4rcez/components", () => ({
  CommandPalette: mocks.commandPalette,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );

  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/app/hooks/use-templates", () => ({
  useTemplates: () => ({ templates: [] }),
}));

vi.mock("@/app/contexts/layout-context", () => ({
  useLayoutStore: () => [{}, mocks.layoutDispatch],
}));

vi.mock("@/app/editor-global-ref", () => ({
  editorGlobalRef: { current: null },
}));

vi.mock("@/app/notification-ref", () => ({
  notificationRef: { current: null },
}));

vi.mock("@/lib/editor-storage", () => ({
  getEditorMarkdown: vi.fn(() => ""),
}));

vi.mock("@/lib/encoding", () => ({
  utf8ToBase64: vi.fn(() => ""),
}));

vi.mock("@/lib/is-electron", () => ({
  isElectron: vi.fn(() => true),
}));

vi.mock("@/lib/print-document", () => ({
  printDocument: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
  CommanderType: {
    All: "all",
    Notes: "Notes",
    OpenTabs: "OpenTabs",
  },
  globalState: () => mocks.state,
  useGlobalStore: () => [mocks.state, mocks.dispatch],
}));

vi.mock("@/store/repositories", () => ({
  repositories: {
    notes: {
      getAll: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/store/settings", () => ({
  SettingsService: {
    load: mocks.settingsLoad,
  },
}));

vi.mock("@/store/ui.store", () => ({
  uiDispatch: {
    openGitDialog: vi.fn(),
    openTasksDialog: vi.fn(),
    setError: vi.fn(),
    setSidebarOpen: vi.fn(),
  },
}));

function getFlattenedCommands(): CommandItem[] {
  const calls = mocks.commandPalette.mock.calls as unknown[][];
  const props = calls.at(-1)?.[0] as { commands: CommandItem[] } | undefined;

  return (props?.commands ?? []).flatMap((item) => item.items ?? [item]);
}

describe("Commander", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the shortcuts page from the help command without showing the old shortcut binding", () => {
    render(
      <Commander
        note={mocks.state.note}
        tabs={mocks.state.tabs}
        notes={mocks.state.notes}
        noteGroups={mocks.state.noteGroups}
        commander={mocks.state.commander as never}
        dispatch={mocks.dispatch as never}
      />,
    );

    const shortcutHelpCommands = getFlattenedCommands().filter(
      (item) => item.title === "Shortcut/Help menu",
    );
    expect(shortcutHelpCommands).toHaveLength(1);

    const shortcutHelpCommand = shortcutHelpCommands[0];
    expect(shortcutHelpCommand?.shortcut).toBeUndefined();

    const setOpen = vi.fn();
    shortcutHelpCommand?.action?.({ setOpen });

    expect(setOpen).toHaveBeenCalledWith(false);
    expect(mocks.navigate).toHaveBeenCalledWith("/settings/shortcuts");
  });
});

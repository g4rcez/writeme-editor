import type { AppSettings } from "@/store/settings";
import { TEXT_COMMAND_REFERENCE } from "@/app/commands/commands";
import { SLASH_COMMAND_REFERENCE } from "@/app/extensions/slash-command";

export type CommandReferenceCategory = "Keyboard" | "Text command" | "Slash command";

export type CommandReferenceItem = {
    trigger: string;
    description: string;
    category: CommandReferenceCategory;
    context: string;
};

type CommandReferenceOptions = {
    isDesktopApp: boolean;
    settings: Pick<AppSettings, "quickNoteShortcut" | "mathNoteShortcut" | "floatingEditorShortcut">;
};

const keyboard = (trigger: string, description: string, context = "App"): CommandReferenceItem => ({
    trigger,
    description,
    category: "Keyboard",
    context,
});

const APP_KEYBOARD_SHORTCUTS: CommandReferenceItem[] = [
    keyboard("Mod+Shift+P", "Open the command palette."),
    keyboard("Mod+K", "Open the command palette.", "Floating editor"),
    keyboard("Mod+K", "Open or close note search.", "Note search"),
    keyboard("Mod+T", "Search and switch between open tabs."),
    keyboard("Ctrl+Tab", "Move to the next open tab."),
    keyboard("Ctrl+Shift+Tab", "Move to the previous open tab."),
    keyboard("Mod+N", "Create a blank note."),
    keyboard("Mod+Shift+N", "Create and open a new AI chat."),
    keyboard("Mod+W", "Close the current tab or hide the app."),
    keyboard("Mod+F", "Open find and replace for the current note.", "Note editor"),
    keyboard("Mod+P", "Print or export the current note.", "Note editor"),
    keyboard("Mod+B", "Show or hide the sidebar."),
    keyboard("Mod+Shift+F", "Turn focus mode on or off."),
    keyboard("Mod+Shift+A", "Open the AI assistant."),
    keyboard("Mod+Shift+M", "Switch between light and dark themes."),
    keyboard("Mod+,", "Open settings."),
    keyboard("Mod+R", "Reload the current app window."),
    keyboard("Mod+-", "Decrease the interface scale."),
    keyboard("Mod+=", "Increase the interface scale."),
    keyboard("Mod+0", "Reset the interface scale."),
    keyboard("Mod+/", "Show keyboard click hints for visible controls."),
];

const DESKTOP_KEYBOARD_SHORTCUTS: CommandReferenceItem[] = [
    keyboard("Mod+O", "Open a file or folder from disk.", "Desktop app"),
    keyboard("Mod+Shift+E", "Open the workspace file browser.", "Desktop app"),
    keyboard("Mod+Shift+Q", "Quit Writeme.", "Desktop app"),
];

const EDITOR_KEYBOARD_SHORTCUTS: CommandReferenceItem[] = [
    keyboard("Mod+B", "Toggle bold text.", "Formatted editor"),
    keyboard("Mod+I", "Toggle italic text.", "Formatted editor"),
    keyboard("Mod+U", "Toggle underlined text.", "Formatted editor"),
    keyboard("Mod+E", "Toggle inline code.", "Formatted editor"),
    keyboard("Mod+Shift+S", "Toggle strikethrough text.", "Formatted editor"),
    keyboard("Mod+Shift+H", "Toggle highlighted text.", "Formatted editor"),
    keyboard("Mod+Shift+B", "Toggle a blockquote.", "Formatted editor"),
    keyboard("Mod+Shift+C", "Toggle a callout.", "Formatted editor"),
    keyboard("Mod+Alt+C", "Toggle a code block.", "Formatted editor"),
    keyboard("Mod+Alt+0", "Change the current block to a paragraph.", "Formatted editor"),
    keyboard("Mod+Alt+1–6", "Toggle heading levels 1 through 6.", "Formatted editor"),
    keyboard("Mod+Shift+7", "Toggle an ordered list.", "Formatted editor"),
    keyboard("Mod+Shift+8", "Toggle a bullet list.", "Formatted editor"),
    keyboard("Mod+Shift+9", "Toggle a task list.", "Formatted editor"),
    keyboard("Mod+Shift+L", "Align text to the left.", "Formatted editor"),
    keyboard("Mod+Shift+R", "Align text to the right.", "Formatted editor"),
    keyboard("Mod+Shift+J", "Justify text.", "Formatted editor"),
    keyboard("Mod+Alt+F", "Insert or open frontmatter.", "Formatted editor"),
    keyboard("Mod+Z", "Undo the last edit.", "Editor"),
    keyboard("Mod+Shift+Z", "Redo the last undone edit.", "Editor"),
    keyboard("Mod+Y", "Redo the last undone edit.", "Editor"),
    keyboard("Shift+Enter", "Insert a hard line break.", "Formatted editor"),
    keyboard("Mod+Enter", "Insert a hard line break.", "Formatted editor"),
    keyboard("Mod+Enter", "Toggle the selected task's completion state.", "Task list"),
    keyboard("Enter", "Split the current list item.", "List or task list"),
    keyboard("Tab", "Indent a list item, move to the next table cell, or indent code.", "Formatted editor"),
    keyboard("Shift+Tab", "Outdent a list item or move to the previous table cell.", "Formatted editor"),
    keyboard("Mod+A", "Select the contents of the current code block.", "Code block"),
    keyboard("Enter", "Move to the next search result.", "Find and replace"),
    keyboard("Shift+Enter", "Move to the previous search result.", "Find and replace"),
    keyboard("Escape", "Close find and replace.", "Find and replace"),
    keyboard("Mod+C", "Copy the selection as rich text and Markdown.", "Formatted editor"),
    keyboard("ArrowDown", "Leave a code block from its last line.", "Code block"),
    keyboard("Enter ×3", "Leave a code block after three empty lines.", "Code block"),
    keyboard("Mod+Enter", "Commit and push the current Git changes.", "Git sync dialog"),
];

const CONTEXTUAL_KEYBOARD_SHORTCUTS: CommandReferenceItem[] = [
    keyboard("ArrowUp / ArrowDown", "Move through note, file, and recent-item search results.", "Search lists"),
    keyboard("Enter", "Open the selected note, file, or recent item.", "Search lists"),
    keyboard("ArrowUp / ArrowDown", "Move through slash-command and note-link suggestions.", "Editor suggestions"),
    keyboard("Tab / Enter", "Choose the selected note-link suggestion.", "Note-link suggestions"),
    keyboard("Enter", "Choose the selected slash command.", "Slash commands"),
    keyboard("Arrow keys", "Move through emoji suggestions.", "Emoji picker"),
    keyboard("Enter", "Insert the selected emoji.", "Emoji picker"),
    keyboard("Escape", "Close the active suggestion menu, dialog, panel, or floating window.", "App"),
    keyboard("Enter", "Send a message.", "AI chat"),
    keyboard("Shift+Enter", "Insert a new line without sending.", "AI chat"),
    keyboard("Mod+Enter", "Submit the AI selection prompt.", "AI prompt"),
    keyboard("F2", "Rename the focused open file tab.", "Open tabs"),
    keyboard("ArrowUp / ArrowDown", "Move between notes.", "Note list"),
    keyboard("Arrow keys", "Move through the file tree and expand or collapse folders.", "File tree"),
    keyboard("Enter / Space", "Open the focused file or folder.", "File tree"),
    keyboard("Delete / Backspace", "Ask to delete the focused file or folder.", "File tree"),
    keyboard("ArrowLeft / ArrowRight", "Resize the sidebar by 16 pixels.", "Sidebar resize handle"),
    keyboard("Shift+ArrowLeft / Shift+ArrowRight", "Resize the sidebar by 32 pixels.", "Sidebar resize handle"),
    keyboard("ArrowLeft / ArrowRight", "Resize the selected image by 10 pixels.", "Image"),
    keyboard("Shift+ArrowLeft / Shift+ArrowRight", "Resize the selected image by 50 pixels.", "Image"),
    keyboard("Enter / Space", "Open the selected image preview.", "Image"),
    keyboard("Letters", "Enter the two-letter code shown on a visible control.", "Keyboard click hints"),
    keyboard("Backspace", "Remove the last typed hint letter.", "Keyboard click hints"),
    keyboard("Enter", "Activate the matching hinted control.", "Keyboard click hints"),
];

const TEXT_INPUT_COMMANDS: CommandReferenceItem[] = [
    {
        trigger: "# through ######, then Space",
        description: "Create heading levels 1 through 6.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "-, *, or +, then Space",
        description: "Create a bullet list.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "1., then Space",
        description: "Create an ordered list.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "---, ___, or ***",
        description: "Insert a horizontal rule.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "``` or ~~~, then Space",
        description: "Create a code block.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "*text* or _text_",
        description: "Convert enclosed text to italic.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "~~text~~",
        description: "Convert enclosed text to strikethrough.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "`text`",
        description: "Convert enclosed text to inline code.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "@note",
        description: "Search for and insert a link to another note.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: ":emoji",
        description: "Search for and insert an emoji.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "[[note]] or ![[note]]",
        description: "Convert an Obsidian-style note link or embed.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: ">, >info, >warning, >alert, or >danger, then Space",
        description: "Create a blockquote with an optional theme.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "|>type, then Space",
        description: "Create a themed callout such as note, tip, warning, or caution.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "[ ] or [x], then Space",
        description: "Create an unchecked or checked task-list item.",
        category: "Text command",
        context: "Start of a formatted-editor line",
    },
    {
        trigger: "~text~",
        description: "Convert enclosed text to subscript.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "`#hex`, `rgb(…)`, or `hsl(…)`",
        description: "Convert a color value to a color swatch.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "HTTP(S) URL, then Space",
        description: "Convert a typed external URL to a link.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "![youtube](URL), then Space",
        description: "Embed a YouTube video.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "![video](URL), then Space",
        description: "Embed a video.",
        category: "Text command",
        context: "Formatted editor",
    },
    {
        trigger: "![pdf](path), then Space",
        description: "Embed a PDF.",
        category: "Text command",
        context: "Formatted editor",
    },
];

const FLOWCHART_KEYBOARD_SHORTCUTS: CommandReferenceItem[] = [
    keyboard("+", "Zoom in.", "Flowchart preview"),
    keyboard("-", "Zoom out.", "Flowchart preview"),
    keyboard("0", "Reset zoom and pan.", "Flowchart preview"),
    keyboard("Arrow keys", "Pan the diagram.", "Flowchart preview"),
    keyboard("?", "Show or hide flowchart keyboard help.", "Flowchart preview"),
];

export function getCommandReference({ isDesktopApp, settings }: CommandReferenceOptions): CommandReferenceItem[] {
    const tabShortcuts = [
        keyboard(isDesktopApp ? "Mod+1–8" : "Mod+Shift+1–8", "Switch directly to one of the first eight open tabs."),
        keyboard(isDesktopApp ? "Mod+9" : "Mod+Shift+9", "Switch directly to the last open tab."),
    ];

    const desktopGlobalShortcuts = isDesktopApp
        ? [
              keyboard(settings.quickNoteShortcut, "Open a new quick note from anywhere.", "Desktop global"),
              keyboard(settings.mathNoteShortcut, "Open a new math note from anywhere.", "Desktop global"),
              keyboard(settings.floatingEditorShortcut, "Open the floating editor from anywhere.", "Desktop global"),
              ...DESKTOP_KEYBOARD_SHORTCUTS,
          ]
        : [];

    const textCommands = TEXT_COMMAND_REFERENCE.map(({ trigger, description }): CommandReferenceItem => ({
        trigger,
        description,
        category: "Text command",
        context: "Formatted editor",
    }));

    const slashCommands = SLASH_COMMAND_REFERENCE.map(({ trigger, description }): CommandReferenceItem => ({
        trigger,
        description,
        category: "Slash command",
        context: "Formatted editor",
    }));

    return [
        ...desktopGlobalShortcuts,
        ...APP_KEYBOARD_SHORTCUTS,
        ...tabShortcuts,
        ...EDITOR_KEYBOARD_SHORTCUTS,
        ...CONTEXTUAL_KEYBOARD_SHORTCUTS,
        ...FLOWCHART_KEYBOARD_SHORTCUTS,
        ...TEXT_INPUT_COMMANDS,
        ...textCommands,
        ...slashCommands,
    ];
}

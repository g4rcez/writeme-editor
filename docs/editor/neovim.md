# Vim mode

Enable **Vim mode** in the note toolbar or editor settings. The setting applies
to both Formatted and Markdown notes. Formatted notes use the `neovim` Tiptap
extension; Markdown notes retain the existing CodeMirror Vim integration.

## Global init.ts

Open **Settings / Vim** to enable Vim for all editors and customize one global
TypeScript configuration. Save validates the configuration before persisting it;
syntax, runtime, or option errors leave the previous saved configuration in place.
An empty file restores the default bindings. The old `rawEditorVimMode` preference
migrates to the shared `vimMode` setting, and source is stored as `vimConfig`.

```ts
import type { VimConfigApi } from "@writeme/vim";

export default function configure(vim: VimConfigApi): void {
    vim.opt.leader = ",";
    vim.opt.timeout = 600;
    vim.opt.initialMode = "normal";
    vim.keymap.set("normal", "<leader>d", "dw");
    vim.keymap.set("insert", "jk", "<Esc>");
}
```

The same mappings apply to both editors. Configuration can use TypeScript
annotations, functions, loops, and conditionals. Use normal, insert, and visual
modes (visual also applies to Visual Line). `keymap.del` removes a registration;
the last registration for a mode and left-hand side wins. Mapping actions are Vim
key-sequence strings, with optional `description` and `remap` options. Runtime
imports and asynchronous setup are unsupported. Type-only imports are stripped.
The runner checks syntax and the resulting options/mappings; it does not perform
general TypeScript type checking.

The configuration block uses CodeMirror in TypeScript mode, with syntax
highlighting, TypeScript snippets, local variable completion, and suggestions for
the supported Vim API. Ctrl+Space opens completion; Tab accepts a suggestion, and
Escape closes it. Save Vim and Ctrl/Cmd+S validate and persist the global source.
Save status and validation errors appear above the editor.

Configuration runs in a background worker with a three-second execution deadline
after the compiler is ready. Startup has a separate fifteen-second deadline.
Failed workers can be retried with the same source. The worker returns
serializable options and mappings; editor objects are not passed to it.
Source is limited to 50,000 characters and 500 mappings. Callback-based Tiptap
extension APIs below remain available to application code separately.

The immutable `vimScripts` build flag controls the runner. Store builds exclude
its executable implementation and TypeScript compiler, while keeping ordinary
Vim mode available. Desktop direct/Homebrew and web builds enable customization;
mobile builds keep it disabled. See [build profiles](../build-profiles.md).

## Supported commands in formatted notes

| Behavior                 | Keys                                                          |
| ------------------------ | ------------------------------------------------------------- |
| Normal / Insert          | `Escape`, `Ctrl-[`, `i`, `a`, `I`, `A`, `o`, `O`              |
| Visual / Visual Line     | `v`, `V`, motions, `d`, `c`, `y`                              |
| Replace                  | `R`, `r{character}`                                           |
| Character / word motions | `h`, `l`, `w`, `b`, `e`, `W`, `B`, `E`                        |
| Logical lines            | `j`, `k`, `0`, `^`, `$`, `gg`, `G`, `{`, `}`                  |
| Wrapped screen lines     | `gj`, `gk`                                                    |
| Find character           | `f`, `F`, `t`, `T`, `;`, `,`                                  |
| Operators                | `d`, `c`, `y`, including doubled operators (`dd`, `cc`, `yy`) |
| Word objects             | `iw`, `aw`, `iW`, `aW`                                        |
| Edit / put / repeat      | `x`, `D`, `C`, `p`, `P`, `.`                                  |
| Undo / redo              | `u`, `Ctrl-r`                                                 |
| Literal search           | `/text`, `?text`, `Enter`, `n`, `N`                           |
| Command prompt           | `:{line-number}`, `:noh`, `:nohlsearch`                       |

Counts compose: `2d3w` deletes six words. Counts are capped at 9999.
An incomplete operator remains pending until completed or cancelled with Escape.
Search wraps and matches across formatting boundaries within a logical line.

A logical line is a textblock, split at hard breaks or code-block newlines.
Wrapped rows are screen lines. Paragraph motions move between textblocks.
Line operations preserve schema validity and cannot span isolated table cells.
An empty document retains an editable paragraph.

The unnamed yank register stores a ProseMirror `Slice` plus its line/character
shape, preserving formatting on paste. Undo uses the existing ProseMirror
history, including its grouping of typed input. Dot-repeat replays the previous
editing command and its inserted slice at the current cursor.

This extension implements a defined subset of Neovim editing behavior. Visual
Block, named/system registers, macros, regex search, and general Ex commands are
not supported. Raw Markdown has the capabilities provided by CodeMirror Vim;
its engine and registers are separate from the formatted editor API, while the
global init.ts supplies shared key-sequence mappings to both engines.

## Extension API

```ts
import { Neovim } from "@/app/extensions/neovim";

const editor = new Editor({
    extensions: [
        StarterKit,
        Neovim.configure({
            enabled: true,
            initialMode: "normal",
            leader: " ",
            timeout: 600,
        }),
    ],
});

const vim = editor.storage.neovim;

vim.keymap.set(["normal", "visual"], "<leader>b", ({ editor }) => editor.chain().toggleBold().run(), {
    description: "Toggle bold",
});
vim.keymap.set("normal", "H", "0");
vim.keymap.del("normal", "H");
vim.keymap.list();
vim.setEnabled(false);
vim.getState();
```

Mappings accept full mode names: `normal`, `insert`, `visual`, `visual-line`,
`operator-pending`, `replace`, and `command`. Escape remains the universal
cancel key; the built-in command prompt owns its input.

Mappings are local to each editor. The latest registration replaces a mapping
with the same mode and left-hand side. String mappings do not remap by default;
set `remap: true` to expand other mappings, with a maximum of 20 nested
expansions. `nowait: true` executes a mapping immediately even if a longer one
shares its prefix. Otherwise the shorter mapping waits for `timeout` milliseconds.
Unmatched Insert-mode prefixes are restored as typed text on mismatch, timeout,
blur, or Escape. Destroying the editor clears its timer.

Callbacks receive `editor`, `state`, `view`, `mode`, and `count`. Return `true`
when the action handles the key. Callbacks own their changes and undo behavior;
automatic dot-repeat applies to built-in editing commands.

## Registering editing primitives

```ts
vim.motions.register("z", ({ state, count }) => ({
    pos: Math.min(state.selection.$head.end(), state.selection.head + count),
    inclusive: false,
    shape: "character",
}));

vim.textObjects.register("iz", ({ state }) => ({
    from: state.selection.$head.start(),
    to: state.selection.$head.end(),
    shape: "character",
}));

vim.operators.register("q", ({ range, tr }) => {
    tr.insertText("replacement", range.from, range.to);
    return true;
});
```

Motion handlers return a destination, inclusivity, and range shape. A registered
motion can run alone or compose with an operator (`dz`). Text objects return
an explicit range (`diz`). Operators receive the transaction they should modify
and return whether the operation succeeded (`qiz`). Return `null` from a motion
or object when no valid target exists. Use valid ProseMirror positions, rather
than plain-text offsets. Keep operators synchronous and modify the supplied
transaction without dispatching another one.

The `neovimKey` export reads immutable plugin state. React consumers can use
`useEditorState` with `neovimKey.getState(editor.state)`, as the mode indicator
does. Mode changes do not alter saved note content.

## Verification

- Unit/integration: `npm test -- packages/editor/src/app/extensions/neovim`
- Browser: `npm run test:e2e -- --platform osx --suite browser tests/e2e/neovim.spec.ts --project chromium`
- Desktop PR verification runs the browser scenarios on Linux, Windows, and macOS.

# WriteMe UI implementation instructions

Use this file as the visual and interaction brief for the WriteMe app at
[app.writeme.dev](https://app.writeme.dev/).

This is a product workspace, not a marketing page. The main job of the
interface is to help a person open a note and keep writing. Use Obsidian as
the information-architecture reference, then borrow the following qualities
without copying any brand assets:

- **Obsidian:** vault/file navigation, tabs, backlinks, outline, command
  palette, local-first language, and a calm writing surface.
- **Vercel:** monochrome surfaces, crisp hairlines, tight geometric type,
  restrained radii, and high signal-to-noise.
- **Cursor:** a focused workbench, keyboard-first actions, useful context
  panels, and status that stays out of the way.
- **Framer:** artboard-like composition and carefully controlled atmospheric
  color on the home and AI surfaces only.

The result should feel like a quiet personal knowledge workbench: precise,
fast, private, and slightly expressive.

## 1. Product and repository context

- Preserve the current product promise: notes stay local and AI is optional.
- Preserve existing routes, editor behavior, file formats, storage, and
  keyboard shortcuts unless the task explicitly changes them.
- The reference app currently has a dark canvas, a narrow icon rail, a lavender
  primary action, a home view, and an `/notes` view with note search.
- The observed home view contains `Explorer`, `Search`, `Favorites`, `Tags`,
  `Groups`, `Calendar`, `Views`, `Trash`, `Workspace AI`, and `Settings` in the
  rail. Keep these capabilities discoverable even when the rail is collapsed.
- The observed empty state has a large amount of unused space. Do not preserve
  that space if it makes the writing path harder to find. The empty state must
  remain useful at every viewport.
- This checkout contains the WriteMe frontend source. Treat this file as the
  implementation brief for the existing app; extend the current architecture
  instead of inventing a second app or replacing established behavior.

## 2. North-star experience

A user should be able to:

1. See where they are in the workspace.
2. Find or create a note with one obvious action.
3. Start typing immediately, without a dashboard, toolbar, or AI panel taking
   over the page.
4. Discover related notes, headings, and tags when they need context.
5. Understand whether the note is saved and where it lives.
6. Use the whole product with a keyboard and with assistive technology.

Prioritize the writing surface over decoration. Every persistent control must
answer one of these questions: Where am I? What can I write? How do I find
something? What context helps me continue?

## 3. Target application shell

On wide screens, use this four-region layout:

```text
┌──────────┬────────────────────┬──────────────────────────┬──────────────┐
│ activity │ workspace / files  │ tabs + note editor       │ context      │
│ rail     │ explorer           │                          │ (optional)   │
│ 56–72 px │ 240–288 px         │ flexible, min 520 px     │ 280–320 px   │
└──────────┴────────────────────┴──────────────────────────┴──────────────┘
```

- The activity rail is fixed. The explorer and context panel are collapsible
  and resizable if the existing layout supports it.
- Use a 48px app header, a 40px tab row, and a 28–32px status bar. Do not let
  chrome consume more height than the note itself.
- The editor column can fill the available region, but the prose column must
  remain readable: target `min(100% - 48px, 760px)` for normal note content.
- Keep the editor background visually continuous with the canvas. Panels are
  for navigation and context, not a stack of cards around the document.
- Persist collapsed state and pane widths using the existing settings store if
  one exists. Do not add a new persistence system for this layout pass.

### 3.1 Activity rail

- Keep the brand mark at the top and settings/help or account actions at the
  bottom.
- Group the primary navigation in a stable order: Explorer, Search, Favorites,
  Tags, Groups, Calendar, Views, and Trash. Put Workspace AI in a separate
  lower group so it reads as optional context, not the default destination.
- Use real buttons with accessible labels. Icon-only controls need a tooltip
  on hover and a visible label in the expanded rail.
- The active item gets a 2px lavender edge or compact active marker plus a
  subtle surface tint. Do not use a large filled tile for every item.
- Preserve a visible focus ring. Hover, focus, active, and selected states must
  not rely on color alone.
- When collapsed, provide a clear `aria-label` and tooltip for every item. When
  the rail is hidden on mobile, expose the same destinations from the menu
  button and command palette.

### 3.2 Workspace explorer

The explorer is the user's map of their local workspace.

- Header: workspace name, collapse button, and a compact `New note` action.
- Search: one input with the placeholder `Search notes or tags…`; show the
  keyboard shortcut where there is room, not inside the editable value.
- Sections, in this order when populated: `Pinned`, `Recent`, `Folders`, and
  `All notes`.
- A file row includes an icon, the note name, optional folder context, and a
  quiet modified time or status. Do not show a large excerpt for every row.
- Use indentation and disclosure controls for folders. The disclosure control
  must be separately clickable from the note link.
- Give the selected note a left accent and a low-contrast background. Keep
  selected and hover states distinct.
- Empty sections should collapse or show a short explanation. Never render a
  tall blank panel that pushes the editor below the fold.

### 3.3 Tabs and editor header

- Open notes in tabs. Each tab shows the note name, an unsaved indicator when
  needed, and a close button that appears on hover or focus.
- Keep tab actions small: new tab, split view, and more actions. Put rarely
  used actions in the menu instead of a permanent toolbar.
- Below tabs, show breadcrumbs only when they add location context. Use muted
  text and a small separator; do not turn breadcrumbs into a second title.
- The title is an editable `h1`/title field with a clear focus state. Target
  30–36px on desktop and 26–30px on narrow screens.
- Place tags, folder, updated time, and save state in one compact metadata row.
  Tags may be pill-shaped; ordinary metadata must not be.
- Keep formatting controls contextual: show them on text selection, on an
  explicit toolbar toggle, or in the command palette. A permanent row of
  twenty icons is not the target.

### 3.4 Writing surface

- Start the cursor in the body when a new note opens, unless the user has
  explicitly focused the title.
- Use a readable prose width of 680–760px, 16–18px body text, and roughly
  `1.65–1.8` line height. Keep paragraphs visually separated without adding
  card backgrounds.
- Use a clear hierarchy: `h1` for the note title, `h2`/`h3` for sections, and
  restrained heading weights. Avoid oversized marketing display type inside a
  note.
- Markdown syntax, block handles, and editor affordances should be quiet until
  the relevant line is focused or hovered.
- Links use the link accent and an underline on hover/focus. Code uses the mono
  face and a slightly raised surface. Blockquotes use a hairline or left rule,
  not a heavy box.
- Tables, equations, diagrams, and code blocks must scroll inside themselves;
  they must not force the whole app wider than the viewport.
- Show save state in the status bar or metadata row with text such as `Saved`
  or `Saving…`. A tiny status dot alone is not sufficient.

### 3.5 Context panel

The right panel is optional and should never compete with the note.

- Default sections: `Outline`, `Backlinks`, `Properties`, and `Related notes`.
- Show only sections that have content, or use a short empty message. Avoid
  four empty cards on a new note.
- Make the panel independently scrollable and collapsible. Keep a selected
  outline heading synchronized with the editor when that behavior already
  exists.
- Workspace AI opens as a drawer or focused panel from an explicit action. It
  must not permanently shrink the writing column on small screens.
- Keep AI output visually distinct with a modest tint or border, not a large
  glowing gradient. The user always controls when AI enters the workflow.

## 4. Home, search, and empty states

### Home / workspace overview

The current greeting and local-first message are useful, but the home screen
should be a launch surface rather than a hero landing page.

- Keep one short welcome line and one primary `New note` action.
- Make `Find anything` a strong secondary action with `⌘/Ctrl K`.
- Replace the oversized hero gap with a compact `Recent notes` or `Pick up
where you left off` list. Show title, location, modified time, and a useful
  empty state.
- Keep workspace counts as quiet inline metadata, not the main visual event.
- Use the Framer-inspired ambient gradient only behind this overview or an AI
  empty state. Keep it low opacity, blurred, and decorative; never place it
  behind editable text.
- Empty-state copy should fit a readable 420–560px measure. Do not allow the
  message to collapse into one-word lines inside a wide card.

### All notes and search

- `/notes` (or the existing equivalent) should offer a visible search field,
  sort/filter controls, and a list/grid toggle only if both views are useful.
- Search results show title, path, modified time, tags, and a short excerpt.
- The no-results state explains how to change the query and offers `New note`.
- The no-notes state offers one action and a short sentence. Avoid “No data” as
  the only explanation.
- Keep search keyboard-first: `⌘/Ctrl K` opens global search and `/` focuses a
  search field when it is not already being edited.

## 5. Visual language

### Color tokens

Use semantic tokens so the light/dark implementation can evolve without
rewriting components. These values are the dark-first starting point and should
be tuned against the existing brand mark and contrast checks.

| Token                | Value     | Use                                           |
| -------------------- | --------- | --------------------------------------------- |
| `--wm-canvas`        | `#0f0f10` | App background and editor canvas              |
| `--wm-rail`          | `#131315` | Activity rail                                 |
| `--wm-surface-1`     | `#17171a` | Explorer, context, tab surfaces               |
| `--wm-surface-2`     | `#1d1d22` | Menus, popovers, focused rows                 |
| `--wm-surface-hover` | `#222229` | Hover and pressed-neutral states              |
| `--wm-border`        | `#27272d` | Default hairlines and dividers                |
| `--wm-border-strong` | `#383840` | Resizers, active separators                   |
| `--wm-ink`           | `#f4f4f5` | Titles and primary text                       |
| `--wm-text`          | `#d4d4d8` | Body and editor text                          |
| `--wm-muted`         | `#96969f` | Secondary labels and metadata                 |
| `--wm-faint`         | `#62626c` | Placeholder and disabled text                 |
| `--wm-accent`        | `#b394ff` | Primary action, active marker, selected links |
| `--wm-accent-hover`  | `#c5adff` | Hover/active accent                           |
| `--wm-accent-ink`    | `#17121f` | Text on lavender controls                     |
| `--wm-link`          | `#6eb8ff` | Inline links and selection affordances        |
| `--wm-positive`      | `#7dd3a5` | Saved/success state                           |
| `--wm-danger`        | `#f27d86` | Destructive actions and errors                |

- Lavender is the product signal. Use it for one primary action and selected
  states, not for every icon or border.
- The blue link signal is inspired by Framer's interaction color. Keep it for
  hyperlinks, selection, and focused editable affordances.
- Framer-like violet, magenta, cyan, and amber gradients are atmosphere tokens,
  not UI status colors. Use them only in home/AI decoration at low opacity.
- Never communicate saved, warning, or destructive state with color alone.
- Verify text and controls against WCAG AA. Increase contrast rather than
  brightening every accent.

### Typography

- Prefer the existing `IBM Plex Sans` if it is already loaded by the app. If
  the codebase already has Geist, use Geist for UI and display. Do not add a
  font dependency only to imitate Vercel.
- Use one sans family across interface and editor UI. Use a mono face already in
  the project (otherwise `ui-monospace, SFMono-Regular, Menlo, monospace`) for
  code, shortcuts, file paths, and technical metadata.
- Keep display type confident but compact:

| Role           | Size / line height |  Weight | Notes                    |
| -------------- | -----------------: | ------: | ------------------------ |
| Home title     |     44–56px / 1.02 | 600–700 | One or two lines maximum |
| Page title     |      28–36px / 1.1 |     600 | Notes and list views     |
| Editor title   |     30–36px / 1.15 |     600 | Editable, not a hero     |
| Editor body    | 16–18px / 1.65–1.8 |     400 | Readable measure         |
| UI body        |      13–14px / 1.4 | 400–500 | Navigation and controls  |
| Caption        |      11–12px / 1.3 |     500 | Metadata, use sparingly  |
| Technical mono |     12–13px / 1.45 | 400–500 | Code and shortcuts       |

- Use negative letter spacing only on large headings (`-0.02em` to `-0.04em`).
  Do not track body copy or file names tightly.
- Uppercase mono eyebrows are allowed for small section labels, but never for
  prose or primary navigation labels.

### Shape, spacing, and depth

- Use a 4px base spacing scale: `4, 8, 12, 16, 24, 32, 40, 48`.
- Use 6–8px radius for controls, 8–12px for panels, and full pills only for
  tags, status badges, and keyboard hints. Do not put every surface in a pill.
- Prefer hairlines and surface contrast to drop shadows. Use a shadow only for
  a floating menu or modal that must separate from the canvas.
- Resizers and dividers should be visible enough to discover, but not bright.
- Keep page padding 24–40px on desktop and 16px on narrow screens.

## 6. Component rules

### Buttons and controls

- Primary: lavender fill, dark text, 40px height, 8px radius.
- Secondary: transparent or `surface-1` fill, 1px border, light text.
- Tertiary: text/ghost control with a clear hover surface.
- Icon buttons: 32–36px in desktop chrome and at least 40–44px for touch.
- Every destructive action needs a confirmation or undo path consistent with
  the current product behavior.
- Keyboard hints are compact mono badges such as `⌘ K`; they are not the
  button's accessible name.

### Menus, dialogs, and command palette

- Use a single overlay treatment: `surface-2`, hairline border, modest shadow,
  8–12px radius.
- The command palette is centered, about 520–640px wide on desktop, and nearly
  full width with 16px margins on mobile.
- Put the search field first, group commands by task, show shortcut hints, and
  preserve arrow-key/typeahead navigation.
- Return focus to the invoking control when an overlay closes. Escape closes
  the topmost layer only.

### Motion

- Use 120–180ms for hover/focus and 180–260ms for drawers or menus.
- Animate opacity and small translations; avoid scaling text or the editor.
- Resize and collapse panes without a layout jump where possible.
- Respect `prefers-reduced-motion: reduce`; remove decorative gradients' motion
  and transition durations in that mode.
- Motion should confirm a change of state, never delay typing or navigation.

## 7. Responsive rules

- **`≥1280px`** — Rail + explorer + editor; open the context panel when useful.
- **`960–1279px`** — Rail + editor; explorer/context become drawers or one
  optional pane.
- **`640–959px`** — Editor-first layout; one overlay drawer at a time; tabs
  scroll.
- **`<640px`** — Full-width editor, compact top bar, menu/drawer navigation,
  and 44px targets.

- Never allow fixed sidebars to make the editor horizontally scroll.
- At narrow widths, move title actions into an overflow menu and keep the title
  and body as the first visible content.
- Tables, code blocks, and embeds scroll locally. Images use `max-width: 100%`.
- Keep the rail/menu, editor, and overlay states usable with a hardware keyboard
  and touch.

## 8. Accessibility and behavior requirements

- Use semantic `nav`, `aside`, `main`, `header`, and `article` regions.
- Use `aria-current` for the active destination, `aria-expanded` for collapsible
  panes, and descriptive labels for icon buttons.
- Keep a visible `:focus-visible` ring with at least 2px effective contrast.
- Do not remove native keyboard behavior from text editing controls.
- Do not use placeholder text as the only label for an input.
- Announce save/error state changes through the existing live-region pattern if
  one exists; do not spam announcements on every keystroke.
- Preserve local data and autosave behavior. Never use a visual redesign as a
  reason to change storage, authentication, sync, or API contracts.
- Do not add dependencies, replace the editor engine, or alter schemas without
  explicit approval.

## 9. Definition of done

The implementation is ready when:

- A new or existing note opens into the four-region workbench without a
  marketing hero in front of the cursor.
- Explorer, tabs, title, editor, save state, and optional context are legible
  at desktop and mobile widths.
- Home, `/notes`, search, no-results, no-notes, and error states have a clear
  next action.
- `⌘/Ctrl N`, `⌘/Ctrl K`, command-palette navigation, Escape, and pane toggles
  work without stealing focus from the editor.
- No icon-only action is unlabeled, no control is smaller than its target size,
  and focus is visible throughout.
- Contrast, reduced motion, local persistence, and existing editor features
  pass focused QA.
- The final screenshots show restraint: black/charcoal surfaces, lavender
  signal, crisp borders, readable prose, and atmosphere only where it helps.

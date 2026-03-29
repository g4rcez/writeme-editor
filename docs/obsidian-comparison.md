  1. Note Organization & Hierarchy
   * The Gap: Obsidian relies on a Hierarchical File Tree (folders/subfolders) that maps directly to your disk.
   * Writeme's Status: You currently use Groups and Tags. While flexible, users with thousands of notes often prefer the physical
     structure of folders.
   * What's Needed: A "File Explorer" sidebar that supports nested folders and manual drag-and-drop organization.


  2. Global Full-Text Search
   * The Gap: Obsidian's search is instantaneous and scans the content of every file in the vault, often with Regex support.
   * Writeme's Status: Your current search (in NotesListPage) primarily filters the list by Title or Tags.
   * What's Needed: An indexed global search that can find text snippets inside notes across the entire database/filesystem.


  3. Backlinks & Outgoing Links Sidebars
   * The Gap: The "Zettelkasten" workflow depends on seeing what links to this note (Backlinks) and what this note links to (Outgoing
     Links) without opening the Graph view.
   * Writeme's Status: You support [[wikilinks]] and have a Graph view, but no dedicated list/panel in the editor.
   * What's Needed: A sidebar or footer in the Editor view that lists all incoming connections to the current note.


  4. Robust "Daily Notes" Workflow
   * The Gap: Obsidian has a core plugin that auto-generates a note for today and provides a "Daily Note" button in the sidebar.
   * Writeme's Status: You have a CalendarPage, which is great for visualization, but it's reactive (you go there to see notes) rather
     than proactive.
   * What's Needed: A one-click shortcut to "Today's Note" and the ability to apply a template automatically to new daily notes.


  5. Canvas (Infinite Whiteboard)
   * The Gap: Obsidian Canvas allows users to lay out multiple notes, images, and links on an infinite zoomable surface.
   * Writeme's Status: You have Excalidraw integration (which is fantastic for drawing), but it functions as a block within a note.
   * What's Needed: An "Infinite Canvas" page where notes can be placed as cards and connected with arrows, rather than just being a
     drawing tool.


  6. Dataview / "Bases" (Metadata Querying)
   * The Gap: Obsidian's most powerful feature (via the Dataview plugin, now core "Bases") is the ability to query notes like a
     database (e.g., LIST FROM #book WHERE author = "Tolkien").
   * Writeme's Status: You have Frontmatter support, but the data is static.
   * What's Needed: A dynamic table or list component that can pull data from frontmatter across multiple notes.


  7. Sync & Mobile
   * The Gap: Obsidian has a native mobile app and an end-to-end encrypted Sync service.
   * Writeme's Status: You are a PWA and Electron app. While the PWA is great, it lacks the local filesystem access and offline
     reliability of a native mobile app.


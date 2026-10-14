# Search and reusable Views

Search combines the existing text matching with structured filters:

- Tags: every selected tag must be present.
- Note type: one type, or all types.
- Location: database notes, files on disk, or a folder and its descendants. Folder options come from existing note paths.
- Updated dates: on or after the first date, through the entire last date, using your local timezone.

Remove a filter chip individually or choose **Reset filters** to remove all structured criteria. Reset keeps your text search. A reversed date range shows an error and cannot be saved.

Choose **Save as View**, enter a title, and select **Create View**. The View preserves every selected structured filter through the existing query engine. Free text uses fuzzy matching and ranking that the View query language cannot reproduce. If text is active, creation is blocked until you explicitly choose **Clear text search and keep filters**. The updated Search results are the result set saved by the View; sorting can differ.

Saved Views stay editable under **Views**, survive reloads, and update when matching notes are added or changed. Dates are saved as fixed UTC instants for the local-day boundaries selected when the View was created. They do not shift if you later change timezone.

The Views page offers **Add starter Views**:

- **Recently edited**: the 20 most recently updated notes.
- **Reading queue**: Read it later notes, most recently updated first.

Adding starters again creates only missing presets. Edited presets are preserved. Deleted presets stay deleted until you explicitly add them again. Existing notes and Views are never migrated by this action.

Save failures retain the title and criteria so you can retry. View loading failures show **Retry**. Native select and date controls support keyboard input; Search results keep their existing arrow-key and Enter navigation. Escape or Cancel closes the save form and returns focus to **Save as View**.

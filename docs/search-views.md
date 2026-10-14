# Search and reusable Views

Search combines the existing text matching with structured filters:

- Tags: every selected tag must be present.
- Note type: one type, or all types.
- Location: database notes, files on disk, or a folder and its descendants. Folder options come from existing note paths. POSIX paths match case exactly (`Research` and `research` remain distinct); Windows drive and backslash UNC folder prefixes ignore case and accept either separator in note paths. These path rules apply to `filePath STARTS_WITH` in both Search and saved queries, including existing Views. Generic title/content text matching stays case-insensitive.
- Updated dates: on or after the first date, through the entire last date, using your local timezone.

Remove a filter chip individually or choose **Reset filters** to remove all structured criteria. Reset keeps your text search. A reversed date range shows an error and cannot be saved.

Choose **Save as View**, enter a title, and select **Create View**. The View preserves every selected structured filter through the existing query engine. Free text uses fuzzy matching and ranking that the View query language cannot reproduce. If text is active, creation is blocked until you explicitly choose **Clear text search and keep filters**. The updated Search results are the result set saved by the View; sorting can differ.

Saved Views stay editable under **Views**, survive reloads, and update when matching notes are added or changed. Dates are saved as fixed UTC instants for the local-day boundaries selected when the View was created. They do not shift if you later change timezone.

Visual Filters keep the query's **ORDER BY** and **LIMIT** while editing or removing conditions. Numeric input such as `1e3` is saved as a supported decimal (`1000`). An incomplete or non-finite numeric value shows an inline error, leaves the last valid results/query intact, and is not saved; correct the value or remove its condition to continue.

Queries such as `GROUP BY noteType` and `FROM notes GROUP BY noteType` infer their grouping and count columns, including after reopening. Saved Note columns apply only to ungrouped note results.

The Views page offers **Add starter Views**:

- **Recently edited**: the 20 most recently updated notes.
- **Reading queue**: Read it later notes, most recently updated first.

Adding starters again creates only missing presets. Edited presets are preserved. Deleted presets stay deleted until you explicitly add them again. Existing notes and Views are never migrated by this action.

Electron's View repository restores `createdAt` and `updatedAt` from SQLite text into Dates before returning Views. Both starters can be reloaded, edited and reopened without changing stored IDs or duplicating edited presets.

Save failures retain the title and criteria so you can retry. View loading failures show **Retry**. Native select and date controls support keyboard input; Search results keep their existing arrow-key and Enter navigation. Escape or Cancel closes the save form and returns focus to **Save as View**.

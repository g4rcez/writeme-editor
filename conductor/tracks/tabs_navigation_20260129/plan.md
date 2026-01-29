# Implementation Plan - Tab-based File Navigation

## Phase 1: Data Model & Persistence [checkpoint: a35f5ef]
- [x] Task: Update the database schema to support a `tabs` table in Dexie.
    - [x] Sub-task: Define the `Tab` interface and Dexie schema update in `src/store/repositories/dexie/dexie-db.ts`.
    - [x] Sub-task: Create `TabsRepository` in `src/store/repositories/dexie/tabs.repository.ts`.
- [x] Task: Implement global store actions for tabs.
    - [x] Sub-task: Add `tabs` and `activeTabId` to the state in `src/store/global.store.ts`.
    - [x] Sub-task: Implement `ADD_TAB`, `REMOVE_TAB`, `SET_ACTIVE_TAB`, and `REORDER_TABS` dispatchers.
    - [x] Sub-task: Write unit tests for tab state transitions.
- [x] Task: Conductor - User Manual Verification 'Data Model & Persistence' (Protocol in workflow.md)

## Phase 2: UI Implementation
- [ ] Task: Create the `TabsBar` component.
    - [ ] Sub-task: Implement the container with horizontal scrolling and Tailwind styling.
    - [ ] Sub-task: Create the `TabItem` component with "Close" button and "Dirty" indicator logic.
- [ ] Task: Implement Tab Interactions.
    - [ ] Sub-task: Add click handler to switch active tab.
    - [ ] Sub-task: Add middle-click handler to close tab.
    - [ ] Sub-task: Implement tooltips for full file paths.
- [ ] Task: Implement Drag-and-Drop Reordering.
    - [ ] Sub-task: Integrate a library (or custom logic) for tab reordering.
    - [ ] Sub-task: Persist the new order to the database.
- [ ] Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md)

## Phase 3: Integration & UX
- [ ] Task: Integrate `TabsBar` into the Main Layout.
    - [ ] Sub-task: Position the `TabsBar` correctly in `src/app/app.tsx` or the relevant layout component.
- [ ] Task: Wire up application events to tab state.
    - [ ] Sub-task: Update file opening logic (from sidebar/explorer) to automatically add and focus tabs.
    - [ ] Sub-task: Ensure closing the last tab shows the empty state/welcome screen.
- [ ] Task: Session Restoration.
    - [ ] Sub-task: Implement logic to load tabs from IndexedDB on application initialization.
- [ ] Task: Conductor - User Manual Verification 'Integration & UX' (Protocol in workflow.md)

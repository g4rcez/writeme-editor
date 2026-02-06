# Specification: Enable Window Controls for Quick Note

## Overview
Update the Quick Note window configuration to include standard window controls (title bar, close button) and allow dragging/moving. The window should remain "always on top".

## Functional Requirements

### 1. Window Configuration
- **Frame:** Enable the window frame (`frame: true`) to provide native OS controls (Close, Minimize, Move).
- **Title Bar:** The window should have a title bar.
- **Always on Top:** Maintain `alwaysOnTop: true`.
- **Sizing:** Ensure the window is resizable (or fixed if desired, but resizable is standard).

### 2. UI/UX
- **Visuals:** The window will look like a standard OS window floating on top of others.
- **Behavior:** Clicking the "Close" button on the frame should close the window (which our current logic handles by nulling the reference).

## Acceptance Criteria
- [ ] Quick Note window has a title bar with a close button.
- [ ] Quick Note window can be moved by dragging the title bar.
- [ ] Quick Note window stays on top of other windows.

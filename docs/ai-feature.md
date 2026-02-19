# AI Integration Specification: Electron Text Editor

This document outlines the initial structure and functional requirements for integrating AI capabilities into an Electron-based text editor.

---

## 1. UI/UX Workflow

The integration follows a tiered interaction model to minimize friction while providing deep functionality.

### 1.1 Trigger: BubbleMenu

When text is selected within the editor, a `<BubbleMenu />` appears containing an **"Ask to AI"** item.

* **Action:** Clicking this item opens the **Inline Tooltip**.
* **Context:** The current selection is automatically captured as the primary context for the upcoming request.

### 1.2 Interaction: Inline Tooltip

The Tooltip serves as a lightweight, focused entry point for single-turn commands.

* **Input:** A text field for the user’s prompt (e.g., "Summarize this," "Refactor to TypeScript").
* **Drawer Button:** A dedicated button (icon: `PanelRight` or similar) located in the Tooltip's top-right corner.
* **Function:** Promotes the current session to the **Side Drawer** for a multi-turn chat experience.
* **Keyboard Shortcut:** `Cmd/Ctrl + Enter` to execute the prompt immediately.

### 1.3 Persistence: Side Drawer (Chat Aside)

A vertical panel on the right side of the editor window for complex reasoning and history.

* **Behavior:** When opened via the Tooltip, it inherits the text already entered in the Tooltip's input.
* **UI Components:**
* Chat history (Markdown-rendered).
* "Apply" buttons on AI-generated code blocks to overwrite the editor selection.
* Toggle for "Context Awareness" (Document-wide vs. Selection-only).

---

## 2. Technical Architecture (Electron)

To maintain a performant UI (essential for a text editor), heavy AI tasks and network requests are offloaded to the **Main Process**.
This feature will be only available to Electron, since we will use the CLI tool.

### 2.1 Process Responsibilities

| Process | Responsibility |
| --- | --- |
| **Renderer** | Capturing editor state (HTML/JSON/Text), rendering the UI, and displaying streamed markdown. |
| **Main** | Handling LLM streaming (OpenAI, Anthropic, or local via Ollama) from CLI commands, and IPC orchestration. |
| **Preload** | Exposing a secure bridge for AI events (`window.electronAPI.aiQuery`). |

### 2.2 IPC Event Flow

1. **Selection Capture:** Renderer grabs `editor.state.selection`.
2. **Request:** `ipcRenderer.send('ai:submit', { prompt, context })`.
3. **Streaming:** Main process initiates a stream and emits `ai:chunk` events back to the Renderer.
4. **Update:** Renderer updates the Tooltip/Drawer UI in real-time as chunks arrive.

---

## 3. Data & Context Strategy

* **Prompt Engineering:** Automatically wrap user input in a system prompt that defines the editor's environment (e.g., "You are an expert frontend assistant. The following text is from a React project...").
* **Diff Previews:** When the AI suggests a change, the UI should ideally show a diff before applying it to the editor.
* **Security:** Since this is an Electron app, ensure that API keys are never stored in `localStorage`. Use the system keychain via Electron's `safeStorage`.

## 4. Key points

- The feature will use the CLI
- Create a table called `ai` to manage the AI preferences, models and commands to call them
- To help users to configure their environment, create at the `/settings/ai` some presets to help them to configure
- Create the chat component agnostic, that receive the structure `{message:string; author:string;createdAt:Date}`
- The AI chat must be virtualized

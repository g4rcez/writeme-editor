import { describe, expect, it } from "vitest";

import {
  buildExcalidrawNoteContent,
  parseExcalidrawNoteContent,
  replaceExcalidrawNotePayload,
} from "./excalidraw-note";

describe("excalidraw note markdown", () => {
  it("builds the portable markdown contract", () => {
    const content = buildExcalidrawNoteContent();

    expect(content).toContain("type: excalidraw");
    expect(content).toContain("view: excalidraw");
    expect(content).toContain("schemaVersion: 1");
    expect(content).toContain("```json");
    expect(parseExcalidrawNoteContent(content).payload).toEqual({
      elements: [],
      appState: {},
      files: {},
    });
  });

  it("preserves frontmatter when replacing the first JSON fence", () => {
    const content = `---
type: excalidraw
view: excalidraw
schemaVersion: 1
custom: keep-me
---

\`\`\`json
{
  "elements": []
}
\`\`\`
`;

    const next = replaceExcalidrawNotePayload(content, {
      elements: [{ id: "one" }],
      appState: { viewBackgroundColor: "#fff" },
      files: {},
    });

    expect(next).toContain("custom: keep-me");
    expect(parseExcalidrawNoteContent(next).payload).toEqual({
      elements: [{ id: "one" }],
      appState: { viewBackgroundColor: "#fff" },
      files: {},
    });
  });

  it("strips transient collaborators appState before restore/save", () => {
    const content = `---
type: excalidraw
view: excalidraw
schemaVersion: 1
---

\`\`\`json
{
  "elements": [],
  "appState": {
    "collaborators": {},
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
\`\`\`
`;

    const { payload } = parseExcalidrawNoteContent(content);
    expect(payload.appState).toEqual({ viewBackgroundColor: "#ffffff" });

    const next = replaceExcalidrawNotePayload(content, {
      elements: [],
      appState: {
        collaborators: new Map(),
        viewBackgroundColor: "#ffffff",
      },
      files: {},
    });
    expect(next).not.toContain("collaborators");
  });

  it("normalizes legacy array payloads", () => {
    const content = `---
type: excalidraw
view: excalidraw
schemaVersion: 1
---

\`\`\`json
[{ "id": "legacy" }]
\`\`\`
`;

    expect(parseExcalidrawNoteContent(content).payload).toEqual({
      elements: [{ id: "legacy" }],
      appState: {},
      files: {},
    });
  });
});

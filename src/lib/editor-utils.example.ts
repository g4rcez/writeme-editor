/**
 * Example usage of editor utility functions
 * This file demonstrates how to use the editor utilities in different scenarios.
 */

import type { Editor } from "@tiptap/react";
import {
  getCurrentElementInfo,
  getCurrentElementName,
  getCurrentElementPath,
  getCurrentElementAncestors,
  isInNodeType,
} from "./editor-utils";

/**
 * Example: Handle different behaviors based on current element type
 */
export function handleKeyboardShortcut(editor: Editor, key: string) {
  const currentElement = getCurrentElementName(editor);
  
  switch (currentElement) {
    case "codeBlock":
      if (key === "Tab") {
        // Insert 4 spaces in code blocks
        editor.commands.insertContent("    ");
        return true;
      }
      break;
      
    case "heading":
      if (key === "Enter") {
        // Exit heading and create paragraph
        editor.commands.insertContent("\n");
        editor.commands.setParagraph();
        return true;
      }
      break;
      
    case "paragraph":
      // Default paragraph behavior
      break;
  }
  
  return false;
}

/**
 * Example: Show current element information in UI
 */
export function getCurrentElementStatus(editor: Editor): string {
  const info = getCurrentElementInfo(editor);
  
  if (!info) {
    return "No editor active";
  }
  
  const { nodeName, isSelection, parentName, attrs } = info;
  
  let status = `Current: ${nodeName}`;
  
  if (parentName && parentName !== "doc") {
    status += ` (in ${parentName})`;
  }
  
  if (isSelection) {
    status += " [Selection]";
  }
  
  // Show heading level if in heading
  if (nodeName === "heading" && attrs?.level) {
    status += ` Level ${attrs.level}`;
  }
  
  // Show language if in code block
  if (nodeName === "codeBlock" && attrs?.language) {
    status += ` (${attrs.language})`;
  }
  
  return status;
}

/**
 * Example: Context-aware toolbar buttons
 */
export function getAvailableActions(editor: Editor): string[] {
  const actions: string[] = [];
  
  // Always available
  actions.push("bold", "italic", "underline");
  
  // Context-specific actions
  if (isInNodeType(editor, "paragraph")) {
    actions.push("heading", "codeBlock", "quote");
  }
  
  if (isInNodeType(editor, "heading")) {
    actions.push("paragraph", "increaseLevel", "decreaseLevel");
  }
  
  if (isInNodeType(editor, "codeBlock")) {
    actions.push("changeLanguage", "exitCodeBlock");
  }
  
  return actions;
}

/**
 * Example: Debug current cursor position
 */
export function debugCursorPosition(editor: Editor): void {
  const info = getCurrentElementInfo(editor);
  const path = getCurrentElementPath(editor);
  const ancestors = getCurrentElementAncestors(editor);
  
  console.log("=== Cursor Position Debug ===");
  console.log("Current Element:", info);
  console.log("Path:", path.join(" > "));
  console.log("Ancestors:", ancestors);
  
  // Show selection details
  const { state } = editor;
  const { selection } = state;
  console.log("Selection:", {
    from: selection.from,
    to: selection.to,
    empty: selection.empty,
    type: selection.constructor.name,
  });
}

/**
 * Example: Smart paste behavior based on context
 */
export function smartPaste(editor: Editor, content: string): boolean {
  const currentElement = getCurrentElementName(editor);
  
  // If in code block, paste as plain text
  if (currentElement === "codeBlock") {
    editor.commands.insertContent(content);
    return true;
  }
  
  // If pasting code-like content, suggest creating code block
  if (content.includes("function ") || content.includes("const ") || content.includes("import ")) {
    const shouldCreateCodeBlock = confirm("This looks like code. Create a code block?");
    if (shouldCreateCodeBlock) {
      editor.commands.insertContent({
        type: "codeBlock",
        attrs: { language: "javascript" },
        content: [{ type: "text", text: content }],
      });
      return true;
    }
  }
  
  // Default paste behavior
  return false;
}

/**
 * Example: Auto-formatting based on context
 */
export function autoFormat(editor: Editor, text: string): boolean {
  const path = getCurrentElementPath(editor);
  const inList = path.includes("listItem");
  
  // Auto-create heading
  if (text.match(/^#{1,6}\s/)) {
    const hashCount = text.indexOf(" ");
    const level = Math.min(Math.max(hashCount, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const content = text.substring(hashCount + 1);
    editor.commands.setHeading({ level });
    editor.commands.insertContent(content);
    return true;
  }
  
  // Auto-create code block
  if (text.startsWith("```")) {
    const language = text.substring(3, text.indexOf("\n"));
    const code = text.substring(text.indexOf("\n") + 1, text.lastIndexOf("```"));
    editor.commands.setCodeBlock({ language });
    editor.commands.insertContent(code);
    return true;
  }
  
  // Auto-create list item if not already in list
  if (text.match(/^[-*+]\s/) && !inList) {
    editor.commands.toggleBulletList();
    editor.commands.insertContent(text.substring(2));
    return true;
  }
  
  return false;
}
# TipTap Editor Utilities

This module provides utility functions to get information about the current cursor position and element context in a TipTap editor.

## Available Functions

### `getCurrentElementName(editor: Editor | null): string | null`

Returns the name of the current node type where the cursor is positioned.

```typescript
import { getCurrentElementName } from './lib/editor-utils';

const nodeName = getCurrentElementName(editor);
console.log(nodeName); // 'paragraph', 'codeBlock', 'heading', etc.

// Use in conditionals
if (nodeName === 'codeBlock') {
  // Handle code block specific logic
}
```

### `getCurrentElementInfo(editor: Editor | null): CurrentElementInfo | null`

Returns detailed information about the current element.

```typescript
import { getCurrentElementInfo } from './lib/editor-utils';

const info = getCurrentElementInfo(editor);
if (info) {
  console.log(info.nodeName);    // 'heading'
  console.log(info.depth);       // 1
  console.log(info.isSelection); // false
  console.log(info.attrs);       // { level: 2 }
  console.log(info.parentName);  // 'doc'
}
```

### `isInNodeType(editor: Editor | null, nodeTypeName: string): boolean`

Checks if the cursor is currently in a specific node type.

```typescript
import { isInNodeType } from './lib/editor-utils';

if (isInNodeType(editor, 'codeBlock')) {
  // Apply code block specific behavior
  editor.commands.insertContent('    '); // Tab = 4 spaces
}

if (isInNodeType(editor, 'heading')) {
  // Apply heading specific behavior
  const level = editor.getAttributes('heading').level;
}
```

### `getCurrentElementPath(editor: Editor | null): string[]`

Returns the hierarchy path from root to current position.

```typescript
import { getCurrentElementPath } from './lib/editor-utils';

const path = getCurrentElementPath(editor);
console.log(path); // ['doc', 'blockquote', 'paragraph']

// Check if in nested context
const inBlockquote = path.includes('blockquote');
const inList = path.includes('listItem');
```

### `getCurrentElementAncestors(editor: Editor | null): Array<{nodeName: string, depth: number, attrs: Record<string, unknown>}>`

Returns detailed information about all ancestor nodes.

```typescript
import { getCurrentElementAncestors } from './lib/editor-utils';

const ancestors = getCurrentElementAncestors(editor);
ancestors.forEach((ancestor, i) => {
  console.log(`Level ${i}: ${ancestor.nodeName}`, ancestor.attrs);
});
```

## Common Use Cases

### Context-Aware Keyboard Shortcuts

```typescript
import { isInNodeType } from './lib/editor-utils';

function handleTab(editor: Editor): boolean {
  if (isInNodeType(editor, 'codeBlock')) {
    editor.commands.insertContent('    '); // 4 spaces
    return true;
  }
  
  if (isInNodeType(editor, 'listItem')) {
    editor.commands.sinkListItem('listItem');
    return true;
  }
  
  return false; // Default behavior
}
```

### Dynamic UI Elements

```typescript
import { getCurrentElementInfo } from './lib/editor-utils';

function updateToolbar(editor: Editor) {
  const info = getCurrentElementInfo(editor);
  if (!info) return;
  
  // Show different toolbar based on context
  switch (info.nodeName) {
    case 'heading':
      showHeadingToolbar(info.attrs.level);
      break;
    case 'codeBlock':
      showCodeToolbar(info.attrs.language);
      break;
    case 'paragraph':
      showTextToolbar();
      break;
  }
}
```

### Smart Auto-formatting

```typescript
import { getCurrentElementName, isInNodeType } from './lib/editor-utils';

function onTextInput(editor: Editor, text: string) {
  const currentElement = getCurrentElementName(editor);
  
  // Auto-format based on context
  if (text.startsWith('```') && currentElement === 'paragraph') {
    editor.commands.setCodeBlock();
    return true;
  }
  
  if (text.match(/^#{1,6}\s/) && !isInNodeType(editor, 'heading')) {
    const level = text.indexOf(' ') as 1 | 2 | 3 | 4 | 5 | 6;
    editor.commands.setHeading({ level });
    return true;
  }
  
  return false;
}
```

## Node Types in Your Editor

Based on your TipTap configuration, common node types include:

- `'paragraph'` - Regular text paragraphs
- `'heading'` - Headings (with level attribute: 1-6)
- `'codeBlock'` - Code blocks (with language attribute)
- `'callout'` - Custom callout blocks (with type attribute)
- `'taskItem'` - Task list items (with checked attribute)
- `'listItem'` - List items
- `'bulletList'` - Bullet lists
- `'orderedList'` - Numbered lists
- `'blockquote'` - Quote blocks
- `'image'` - Images
- `'doc'` - Root document node

## TypeScript Types

```typescript
export type CurrentElementInfo = {
  nodeName: string;
  depth: number;
  isSelection: boolean;
  attrs?: Record<string, unknown>;
  parentName?: string;
};
```

## Error Handling

All functions handle null/undefined editor gracefully:

```typescript
const info = getCurrentElementInfo(null); // Returns null
const name = getCurrentElementName(undefined); // Returns null
const isCode = isInNodeType(null, 'codeBlock'); // Returns false
```
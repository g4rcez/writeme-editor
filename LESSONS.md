# LESSONS.md

Hard-won lessons from bugs in this codebase. Each entry has a rule, the root cause, and a concrete example.

---

## React Hook Ordering: `useEffect` Must Come After the Values It References

**Rule:** Place every `useEffect` *after* all `useMemo`, `useCallback`, and `const` declarations that the effect's body or dependency array references.

**Why this matters:** React hooks must be called in the same order on every render, but the *temporal dead zone* (TDZ) still applies to `const`/`let` bindings — a `useEffect` callback defined before a `useMemo` can close over a reference that is not yet initialized when the module scope is evaluated, causing:

```
ReferenceError: Cannot access 'flattenedNodes' before initialization
```

**Concrete example** (`src/app/components/tree-view.tsx`):

```tsx
// BAD — useEffect referencing flattenedNodes appears before its useMemo
useEffect(() => {
  return window.electronAPI.onContextMenuAction(({ action, filePath }) => {
    const flatNode = flattenedNodes.find((n) => n.node.path === filePath);
    // ...
  });
}, [flattenedNodes]);

const flattenedNodes = useMemo(() => {   // ← declared AFTER the effect above
  return flattenVisibleNodes(rootChildren, expandedPaths, childrenCache, searchQuery);
}, [rootChildren, expandedPaths, childrenCache, searchQuery]);

// GOOD — declare useMemo first, then the effects that use it
const flattenedNodes = useMemo(() => {
  return flattenVisibleNodes(rootChildren, expandedPaths, childrenCache, searchQuery);
}, [rootChildren, expandedPaths, childrenCache, searchQuery]);

useEffect(() => {
  return window.electronAPI.onContextMenuAction(({ action, filePath }) => {
    const flatNode = flattenedNodes.find((n) => n.node.path === filePath);
    // ...
  });
}, [flattenedNodes]);
```

**Checklist when writing or reviewing a component:**
- All `useMemo` / `useCallback` / derived `const` values appear before any `useEffect` that names them.
- If you move a hook, scan both old and new positions for forward references.

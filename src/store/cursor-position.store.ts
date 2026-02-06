const STORAGE_KEY = "WRITEME_CURSOR_POSITIONS";
const MAX_ENTRIES = 100;

type CursorPosition = { cursor: number; scroll: number; updatedAt: number };
type CursorPositions = Record<string, CursorPosition>;

const load = (): CursorPositions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const persist = (positions: CursorPositions): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
};

const evictLRU = (positions: CursorPositions): CursorPositions => {
  const entries = Object.entries(positions);
  if (entries.length <= MAX_ENTRIES) return positions;

  // Sort by updatedAt ascending (oldest first) and remove excess
  entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const toKeep = entries.slice(entries.length - MAX_ENTRIES);
  return Object.fromEntries(toKeep);
};

export const CursorPositionStore = {
  load,

  save(noteId: string, cursor: number, scroll: number): void {
    const positions = load();
    positions[noteId] = { cursor, scroll, updatedAt: Date.now() };
    const evicted = evictLRU(positions);
    persist(evicted);
  },

  get(noteId: string): CursorPosition | null {
    const positions = load();
    return positions[noteId] || null;
  },
};

import { db } from "@/store/repositories/browser/dexie-db";
import type { CursorPosition } from "@/store/repositories/entities/cursor-position";

const MAX_ENTRIES = 50;

async function evictLRU(): Promise<void> {
  const excess = (await db.cursorPositions.count()) - MAX_ENTRIES;
  if (excess <= 0) return;
  const staleRows = (await db.cursorPositions.toArray())
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
    .slice(0, excess);
  await db.cursorPositions.bulkDelete(staleRows.map((row) => row.noteId));
}

export const CursorPositionStore = {
  async save(id: string, anchor: number, y: number): Promise<void> {
    const position: CursorPosition = {
      noteId: id,
      anchor,
      y,
      updatedAt: Date.now(),
    };
    await db.cursorPositions.put(position);
    await evictLRU();
  },
  async get(noteId: string): Promise<CursorPosition | null> {
    return (await db.cursorPositions.get(noteId)) ?? null;
  },
};

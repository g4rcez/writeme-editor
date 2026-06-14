import { isElectron } from "@/lib/is-electron";
import { db } from "@/store/repositories/browser/dexie-db";
import type { CursorPosition } from "@/store/repositories/entities/cursor-position";

const MAX_ENTRIES = 50;
const COLLECTION = "cursorPositions";

type ElectronCursorPosition = CursorPosition & { id: string };

const toCursorPosition = (
  position: CursorPosition | ElectronCursorPosition | null | undefined,
): CursorPosition | null => {
  if (!position) return null;

  return {
    y: position.y,
    noteId: position.noteId,
    anchor: position.anchor,
    updatedAt: position.updatedAt,
  };
};

async function evictBrowserLRU(): Promise<void> {
  const excess = (await db.cursorPositions.count()) - MAX_ENTRIES;
  if (excess <= 0) return;
  const staleRows = (await db.cursorPositions.toArray())
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
    .slice(0, excess);
  await db.cursorPositions.bulkDelete(staleRows.map((row) => row.noteId));
}

async function evictElectronLRU(): Promise<void> {
  const excess = (await window.electronAPI.db.count(COLLECTION)) - MAX_ENTRIES;
  if (excess <= 0) return;
  const staleRows = (
    await window.electronAPI.db.getAll<ElectronCursorPosition>(COLLECTION)
  )
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0))
    .slice(0, excess);

  await Promise.all(
    staleRows.map((row) => window.electronAPI.db.delete(COLLECTION, row.id)),
  );
}

export const CursorPositionStore = {
  async save(id: string, anchor: number, y: number): Promise<void> {
    const position: CursorPosition = {
      noteId: id,
      anchor,
      y,
      updatedAt: Date.now(),
    };

    if (isElectron()) {
      await window.electronAPI.db.save<ElectronCursorPosition>(COLLECTION, {
        ...position,
        id,
      });
      await evictElectronLRU();
      return;
    }

    await db.cursorPositions.put(position);
    await evictBrowserLRU();
  },
  async get(noteId: string): Promise<CursorPosition | null> {
    if (isElectron()) {
      return toCursorPosition(
        await window.electronAPI.db.get<ElectronCursorPosition>(
          COLLECTION,
          noteId,
        ),
      );
    }

    return (await db.cursorPositions.get(noteId)) ?? null;
  },
};

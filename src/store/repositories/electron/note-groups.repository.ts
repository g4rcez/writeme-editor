import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import {
  type INoteGroupRepository,
  type NoteGroup,
} from "../entities/note-group";

export class NoteGroupsRepository
  extends BaseRepository<NoteGroup>
  implements INoteGroupRepository
{
  constructor() {
    super(new ElectronStorageAdapter(), "noteGroups");
  }

  async getByNoteId(noteId: string): Promise<NoteGroup[]> {
    return window.electronAPI.db.noteGroups.getByNoteId(noteId);
  }
}

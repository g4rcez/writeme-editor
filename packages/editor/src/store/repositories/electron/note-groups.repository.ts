import { type EntityBase } from "../../repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import { BaseRepository } from "../base.repository";
import { type INoteGroupRepository, type NoteGroup } from "../entities/note-group";

export class NoteGroupsRepository extends BaseRepository<NoteGroup> implements INoteGroupRepository {
    constructor() {
        super(new ElectronStorageAdapter(), "noteGroups");
    }

    override async delete(id: EntityBase["id"]): Promise<boolean> {
        if (!(await this.getOne(id))) return false;
        await window.electronAPI.db.noteGroups.delete(id);
        return true;
    }

    async getByNoteId(noteId: string): Promise<NoteGroup[]> {
        return window.electronAPI.db.noteGroups.getByNoteId(noteId);
    }
}

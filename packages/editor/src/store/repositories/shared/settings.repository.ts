import { type StorageAdapter } from "../adapters/types";
import { BaseRepository } from "../base.repository";
import { type ISettingsRepository, type Settings } from "../entities/settings";

export class SettingsRepository extends BaseRepository<Settings> implements ISettingsRepository {
    constructor(adapter: StorageAdapter) {
        super(adapter, "settings");
    }
}

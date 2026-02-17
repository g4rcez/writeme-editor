import { ISettingsRepository, Settings } from "../entities/settings";
import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";

export class SettingsRepository extends BaseRepository<Settings> implements ISettingsRepository {
  constructor() {
    super(new DexieStorageAdapter(), "settings");
  }
}

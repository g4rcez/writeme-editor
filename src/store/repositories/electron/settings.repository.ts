import { ISettingsRepository, Settings } from "../entities/settings";
import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";

export class SettingsRepository extends BaseRepository<Settings> implements ISettingsRepository {
  constructor() {
    super(new ElectronStorageAdapter(), "settings");
  }
}

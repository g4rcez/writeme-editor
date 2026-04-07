import { type ISettingsRepository, type Settings } from "../entities/settings";
import { BaseRepository } from "../base.repository";
import { type StorageAdapter } from "../adapters/types";

export class SettingsRepository
  extends BaseRepository<Settings>
  implements ISettingsRepository
{
  constructor(adapter: StorageAdapter) {
    super(adapter, "settings");
  }
}

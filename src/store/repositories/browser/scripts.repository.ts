import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { type IScriptRepository, Script } from "../entities/script";

export class ScriptsRepository
  extends BaseRepository<Script>
  implements IScriptRepository
{
  constructor() {
    super(new DexieStorageAdapter(), "scripts");
  }

  override async getOne(id: string): Promise<Script | null> {
    const data = await super.getOne(id);
    return data ? Script.parse(data) : null;
  }

  override async getAll(query?: { limit?: number }): Promise<Script[]> {
    const items = await super.getAll(query);
    return items.map((item) => Script.parse(item));
  }
}

import { BaseRepository } from "../base.repository";
import { type IScriptRepository, Script } from "../entities/script";
import { type StorageAdapter } from "../adapters/types";

export class ScriptsRepository
  extends BaseRepository<Script>
  implements IScriptRepository
{
  constructor(adapter: StorageAdapter) {
    super(adapter, "scripts");
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

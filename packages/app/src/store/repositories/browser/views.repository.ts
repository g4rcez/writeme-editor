import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { type IViewRepository, View } from "../entities/view";

export class ViewsRepository
  extends BaseRepository<View>
  implements IViewRepository
{
  constructor() {
    super(new DexieStorageAdapter(), "views");
  }
}

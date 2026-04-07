import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import { type IViewRepository, View } from "../entities/view";

export class ViewsRepository
  extends BaseRepository<View>
  implements IViewRepository
{
  constructor() {
    super(new ElectronStorageAdapter(), "views");
  }
}

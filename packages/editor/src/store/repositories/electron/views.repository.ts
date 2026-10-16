import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import { BaseRepository } from "../base.repository";
import { type IViewRepository, View } from "../entities/view";

type StoredView = Omit<View, "createdAt" | "updatedAt"> & {
    createdAt: Date | string;
    updatedAt: Date | string;
};

function hydrateView(view: StoredView): View {
    return {
        ...view,
        createdAt: new Date(view.createdAt),
        updatedAt: new Date(view.updatedAt),
    };
}

export class ViewsRepository extends BaseRepository<View> implements IViewRepository {
    constructor() {
        super(new ElectronStorageAdapter(), "views");
    }

    override async getOne(id: View["id"]): Promise<View | null> {
        const view = await this.adapter.get<StoredView>(this.collection, id);
        return view ? hydrateView(view) : null;
    }

    override async getAll(query?: { limit?: number }): Promise<View[]> {
        const views = await this.adapter.getAll<StoredView>(this.collection, query);
        return views.map(hydrateView);
    }
}

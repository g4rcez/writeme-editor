import { type EntityBase, type Repository } from "../repository";
import { type StorageAdapter } from "./adapters/types";

export abstract class BaseRepository<
  T extends EntityBase,
> implements Repository<T> {
  constructor(
    protected readonly adapter: StorageAdapter,
    protected readonly collection: string,
    protected readonly defaultSort?: (a: T, b: T) => number,
  ) {}

  async count(): Promise<number> {
    return await this.adapter.count(this.collection);
  }

  async getOne(id: EntityBase["id"]): Promise<T | null> {
    return await this.adapter.get<T>(this.collection, id);
  }

  async getAll(query?: { limit?: number }): Promise<T[]> {
    const items = await this.adapter.getAll<T>(this.collection, query);
    if (this.defaultSort) {
      return items.sort(this.defaultSort);
    }
    return items;
  }

  async save(item: T): Promise<T> {
    return await this.adapter.save<T>(this.collection, item);
  }

  async update(id: EntityBase["id"], item: T): Promise<T> {
    const existing = await this.getOne(id);
    if (!existing) {
      throw new Error(`${this.collection} with id ${id} not found`);
    }
    return await this.adapter.save<T>(this.collection, { ...item, id });
  }

  async delete(id: EntityBase["id"]): Promise<boolean> {
    return await this.adapter.delete(this.collection, id);
  }
}

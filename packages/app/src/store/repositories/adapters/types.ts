export interface StorageAdapter {
  count(collection: string): Promise<number>;
  get<T>(collection: string, id: string): Promise<T | null>;
  getAll<T>(collection: string, query?: { limit?: number }): Promise<T[]>;
  save<T>(collection: string, item: T): Promise<T>;
  delete(collection: string, id: string): Promise<boolean>;
}

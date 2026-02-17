export interface EntityBase {
  readonly id: string;
  readonly type: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Repository<T extends EntityBase> {
  count(): Promise<number>;
  save(item: T): Promise<T>;
  delete(id: EntityBase["id"]): Promise<boolean>;
  getOne(id: EntityBase["id"]): Promise<T | null>;
  getAll(query?: { limit?: number }): Promise<T[]>;
  update(id: EntityBase["id"], item: T): Promise<T>;
}

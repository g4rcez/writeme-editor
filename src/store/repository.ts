export interface EntityBase {
  readonly id: string;
  readonly type: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Repository<T extends EntityBase> {
  getAll(): Promise<T[]>;
  count(): Promise<number>;
  save(item: T): Promise<T>;
  getOne(id: EntityBase["id"]): Promise<T | null>;
  update(id: EntityBase["id"], item: T): Promise<T>;
}

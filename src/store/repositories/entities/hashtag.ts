import { EntityBase, Repository } from "@/store/repository";

export class Hashtag implements EntityBase {
  public constructor(
    public id: string,
    public hashtag: string,
    public filename: string,
    public project: string,
    public createdAt: Date,
    public type: string,
    public updatedAt: Date,
  ) {}
}

export interface IHashtagRepository extends Repository<Hashtag> {}

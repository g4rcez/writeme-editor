import { Hashtag, IHashtagRepository } from "../entities/hashtag";
import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";

export class HashtagsRepository extends BaseRepository<Hashtag> implements IHashtagRepository {
  constructor() {
    super(new ElectronStorageAdapter(), "hashtags");
  }

  async findByHashtag(tag: string): Promise<Hashtag[]> {
    const all = await this.getAll();
    return all.filter((h) => h.hashtag === tag);
  }

  async sync(filename: string, tags: string[]): Promise<void> {
    await window.electronAPI.db.hashtags.sync(filename, tags);
  }
}

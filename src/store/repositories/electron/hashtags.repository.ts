import { EntityBase } from "@/store/repository";
import { Hashtag, IHashtagRepository } from "../entities/hashtag";

export class HashtagsRepository implements IHashtagRepository {
  async count(): Promise<number> {
    return await window.electronAPI.db.count("hashtags");
  }

  async getOne(id: EntityBase["id"]): Promise<Hashtag | null> {
    return (await window.electronAPI.db.get<Hashtag>("hashtags", id)) || null;
  }

  async update(id: EntityBase["id"], item: Hashtag): Promise<Hashtag> {
    await window.electronAPI.db.save("hashtags", { ...item, id });
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Hashtag[]> {
    const all = await window.electronAPI.db.getAll<Hashtag>("hashtags");
    if (query?.limit) {
      return all.slice(0, query.limit);
    }
    return all;
  }

  async save(hashtag: Hashtag): Promise<Hashtag> {
    await window.electronAPI.db.save("hashtags", hashtag);
    return hashtag;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getOne(id);
    if (!existing) return false;
    await window.electronAPI.db.delete("hashtags", id);
    return true;
  }

  async findByHashtag(tag: string): Promise<Hashtag[]> {
    const all = await this.getAll();
    return all.filter((h) => h.hashtag === tag);
  }

  async sync(filename: string, tags: string[]): Promise<void> {
    await window.electronAPI.db.hashtags.sync(filename, tags);
  }
}
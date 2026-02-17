import { EntityBase } from "@/store/repository";
import { db } from "./dexie-db";
import { Hashtag, IHashtagRepository } from "../entities/hashtag";

export class HashtagsRepository implements IHashtagRepository {
  async count(): Promise<number> {
    return await db.hashtags.count();
  }

  async getOne(id: EntityBase["id"]): Promise<Hashtag | null> {
    return (await db.hashtags.get(id)) || null;
  }

  async update(id: EntityBase["id"], item: Hashtag): Promise<Hashtag> {
    await db.hashtags.put(item, id);
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Hashtag[]> {
    let collection = db.hashtags.toCollection();
    if (query?.limit) {
      collection = collection.limit(query.limit);
    }
    return await collection.toArray();
  }

  async save(hashtag: Hashtag): Promise<Hashtag> {
    await db.hashtags.put(hashtag);
    return hashtag;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await db.hashtags.get(id);
    if (!existing) return false;
    await db.hashtags.delete(id);
    return true;
  }

  async findByHashtag(tag: string): Promise<Hashtag[]> {
    return await db.hashtags.where("hashtag").equals(tag).toArray();
  }

  async sync(filename: string, tags: string[]): Promise<void> {
    await db.transaction("rw", db.hashtags, async () => {
      const existing = await db.hashtags
        .where("filename")
        .equals(filename)
        .toArray();
      const existingTags = existing.map((e) => e.hashtag);

      const added = tags.filter((t) => !existingTags.includes(t));
      const removed = existingTags.filter((t) => !tags.includes(t));

      if (added.length === 0 && removed.length === 0) return;

      const idsToRemove = existing
        .filter((e) => removed.includes(e.hashtag))
        .map((e) => e.id);
      if (idsToRemove.length > 0) {
        await db.hashtags.bulkDelete(idsToRemove);
      }

      if (added.length > 0) {
        const newEntries = added.map((tag) => ({
          id: crypto.randomUUID(),
          hashtag: tag,
          filename: filename,
          project: "default",
          createdAt: new Date(),
          updatedAt: new Date(),
          type: "hashtag",
        }));
        await db.hashtags.bulkAdd(newEntries as Hashtag[]);
      }
    });
  }
}
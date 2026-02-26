import { db } from "./dexie-db";
import { type Hashtag, type IHashtagRepository } from "../entities/hashtag";
import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { uuid } from "@g4rcez/components";

export class HashtagsRepository
  extends BaseRepository<Hashtag>
  implements IHashtagRepository
{
  constructor() {
    super(new DexieStorageAdapter(), "hashtags");
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
          id: uuid(),
          hashtag: tag,
          type: "hashtag",
          filename: filename,
          project: "default",
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await db.hashtags.bulkAdd(newEntries);
      }
    });
  }
}

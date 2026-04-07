import { db } from "../store/repositories/browser/dexie-db";
import { isElectron } from "./is-electron";

export async function migrateDexieToSqlite() {
  if (!isElectron()) return;

  const MIGRATION_KEY = "dexie_sqlite_migration_v1";
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    console.log("Starting Dexie to SQLite migration...");
    
    // Migrate Notes
    const notes = await db.notes.toArray();
    console.log(`Migrating ${notes.length} notes...`);
    for (const note of notes) {
      await window.electronAPI.db.save("notes", note);
    }

    // Migrate Tabs
    const tabs = await db.tabs.toArray();
    console.log(`Migrating ${tabs.length} tabs...`);
    for (const tab of tabs) {
      await window.electronAPI.db.save("tabs", tab);
    }

    // Migrate Hashtags
    const hashtags = await db.hashtags.toArray();
    console.log(`Migrating ${hashtags.length} hashtags...`);
    for (const hashtag of hashtags) {
      await window.electronAPI.db.save("hashtags", hashtag);
    }

    // Migrate Projects
    const projects = await db.projects.toArray();
    console.log(`Migrating ${projects.length} projects...`);
    for (const project of projects) {
      await window.electronAPI.db.save("projects", project);
    }

    localStorage.setItem(MIGRATION_KEY, "true");
    console.log("Migration complete.");
    window.location.reload(); // Reload to fetch fresh data from SQLite
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

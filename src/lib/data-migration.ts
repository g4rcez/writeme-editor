import { db } from "@/store/repositories/browser/dexie-db";

const WWW_ORIGIN = "https://www.writeme.dev";
const APP_ORIGIN = "https://app.writeme.dev";

export type MigrationCounts = {
  notes: number;
  tabs: number;
  hashtags: number;
  settings: number;
  scripts: number;
};

type MigrationPayload = {
  type: "writeme-migration";
  version: 1;
  notes: unknown[];
  tabs: unknown[];
  hashtags: unknown[];
  settings: unknown[];
  scripts: unknown[];
};

async function importAllData(data: MigrationPayload): Promise<MigrationCounts> {
  await Promise.all([
    db.notes.bulkPut(data.notes as Parameters<typeof db.notes.bulkPut>[0]),
    db.tabs.bulkPut(data.tabs as Parameters<typeof db.tabs.bulkPut>[0]),
    db.hashtags.bulkPut(data.hashtags as Parameters<typeof db.hashtags.bulkPut>[0]),
    db.settings.bulkPut(data.settings as Parameters<typeof db.settings.bulkPut>[0]),
    db.scripts.bulkPut(data.scripts as Parameters<typeof db.scripts.bulkPut>[0]),
  ]);
  return {
    notes: data.notes.length,
    tabs: data.tabs.length,
    hashtags: data.hashtags.length,
    settings: data.settings.length,
    scripts: data.scripts.length,
  };
}

export function startMigration(): Promise<MigrationCounts> {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${WWW_ORIGIN}/#/migrate`, "_blank", "width=480,height=320");
    if (!popup) {
      reject(new Error("Popup was blocked. Please allow popups for this site."));
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== WWW_ORIGIN) return;
      const data = event.data as MigrationPayload;
      if (data?.type !== "writeme-migration") return;
      window.removeEventListener("message", onMessage);
      importAllData(data).then(resolve).catch(reject);
    };

    window.addEventListener("message", onMessage);
  });
}

export async function exportToFile(): Promise<void> {
  const [notes, tabs, hashtags, settings, scripts] = await Promise.all([
    db.notes.toArray(),
    db.tabs.toArray(),
    db.hashtags.toArray(),
    db.settings.toArray(),
    db.scripts.toArray(),
  ]);

  const payload: MigrationPayload = {
    type: "writeme-migration",
    version: 1,
    notes,
    tabs,
    hashtags,
    settings,
    scripts,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `writeme-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<MigrationCounts> {
  const text = await file.text();
  const data = JSON.parse(text) as MigrationPayload;
  if (data?.type !== "writeme-migration") {
    throw new Error("Invalid backup file format.");
  }
  return importAllData(data);
}

export async function sendMigrationData(): Promise<void> {
  const [notes, tabs, hashtags, settings, scripts] = await Promise.all([
    db.notes.toArray(),
    db.tabs.toArray(),
    db.hashtags.toArray(),
    db.settings.toArray(),
    db.scripts.toArray(),
  ]);

  const payload: MigrationPayload = {
    type: "writeme-migration",
    version: 1,
    notes,
    tabs,
    hashtags,
    settings,
    scripts,
  };

  window.opener.postMessage(payload, APP_ORIGIN);
}

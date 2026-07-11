import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => tmpdir() } }));

import { migrateCredentialRow } from "./credential-storage";
import { DatabaseManager } from "./database";

let directory: string;
let manager: DatabaseManager;
const secureStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
  decryptString: vi.fn((value: Buffer) =>
    value.toString().replace(/^encrypted:/, ""),
  ),
};

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "writeme-credentials-"));
  manager = new DatabaseManager(path.join(directory, "test.sqlite"));
  secureStorage.isEncryptionAvailable.mockReturnValue(true);
  secureStorage.encryptString.mockClear();
  secureStorage.decryptString.mockClear();
});

afterEach(async () => {
  manager?.close();
  await rm(directory, { recursive: true, force: true });
});

describe("credential migration", () => {
  it("retains the source credential when encryption is unavailable", () => {
    const source = { adapterId: "openai", apiKey: "secret" };
    secureStorage.isEncryptionAvailable.mockReturnValue(false);

    expect(migrateCredentialRow(source, manager, secureStorage)).toEqual({
      status: "skipped",
    });
    expect(
      manager.db
        .prepare("SELECT * FROM aiCredentials WHERE adapterId = ?")
        .get(source.adapterId),
    ).toBeUndefined();
    expect(source.apiKey).toBe("secret");
  });

  it("reports success only after writing encrypted credentials", () => {
    const result = migrateCredentialRow(
      {
        adapterId: "openai",
        apiKey: "secret",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      manager,
      secureStorage,
    );
    const stored = manager.db
      .prepare("SELECT apiKey FROM aiCredentials WHERE adapterId = ?")
      .get("openai") as { apiKey: string };

    expect(result).toEqual({ status: "imported" });
    expect(stored.apiKey).toBe(Buffer.from("encrypted:secret").toString("base64"));
    expect(secureStorage.encryptString).toHaveBeenCalledWith("secret");
  });
});

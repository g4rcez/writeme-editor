import { describe, expect, test } from "bun:test";
import { OpenFileArgsSchema, OpenFolderArgsSchema } from "../schemas/open.ts";
import {
  QueryNotesArgsSchema,
  QuerySettingsArgsSchema,
  QueryTagsArgsSchema,
} from "../schemas/query.ts";

describe("OpenFileArgsSchema", () => {
  test("accepts absolute path", () => {
    expect(() =>
      OpenFileArgsSchema.parse({ filePath: "/some/file.md", wait: false }),
    ).not.toThrow();
  });

  test("rejects relative path", () => {
    expect(() =>
      OpenFileArgsSchema.parse({ filePath: "relative/path.md", wait: false }),
    ).toThrow();
  });

  test("accepts null filePath", () => {
    expect(() =>
      OpenFileArgsSchema.parse({ filePath: null, wait: false }),
    ).not.toThrow();
  });

  test("defaults both fields when empty", () => {
    const result = OpenFileArgsSchema.parse({});
    expect(result.filePath).toBeNull();
    expect(result.wait).toBe(false);
  });
});

describe("OpenFolderArgsSchema", () => {
  test("accepts absolute folder path", () => {
    expect(() =>
      OpenFolderArgsSchema.parse({ folderPath: "/some/folder" }),
    ).not.toThrow();
  });

  test("rejects relative folder path", () => {
    expect(() =>
      OpenFolderArgsSchema.parse({ folderPath: "relative/folder" }),
    ).toThrow();
  });
});

describe("QueryNotesArgsSchema", () => {
  test("default limit is 20", () => {
    expect(QueryNotesArgsSchema.parse({}).limit).toBe(20);
  });

  test("rejects limit > 1000", () => {
    expect(() => QueryNotesArgsSchema.parse({ limit: 1001 })).toThrow();
  });

  test("rejects limit < 1", () => {
    expect(() => QueryNotesArgsSchema.parse({ limit: 0 })).toThrow();
  });

  test("accepts valid type", () => {
    expect(() => QueryNotesArgsSchema.parse({ type: "quick" })).not.toThrow();
  });

  test("rejects invalid type", () => {
    expect(() => QueryNotesArgsSchema.parse({ type: "invalid" })).toThrow();
  });
});

describe("QueryTagsArgsSchema", () => {
  test("default json is false", () => {
    expect(QueryTagsArgsSchema.parse({}).json).toBe(false);
  });
});

describe("QuerySettingsArgsSchema", () => {
  test("default json is false", () => {
    expect(QuerySettingsArgsSchema.parse({}).json).toBe(false);
  });
});

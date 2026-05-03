import {
  QueryNotesArgsSchema,
  QueryProjectsArgsSchema,
  QuerySettingsArgsSchema,
  QueryTagsArgsSchema,
} from "../schemas/query.ts";
import {
  queryNotes,
  queryProjects,
  querySettings,
  queryTags,
} from "../lib/db.ts";

function printTable<T extends Record<string, unknown>>(
  rows: T[],
  columns: (keyof T)[],
): void {
  if (rows.length === 0) {
    console.log("No results.");
    return;
  }

  const widths = columns.map((col) =>
    Math.max(
      String(col).length,
      ...rows.map((r) => String(r[col] ?? "").length),
    ),
  );

  const header = columns
    .map((col, i) => String(col).padEnd(widths[i]!))
    .join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    console.log(
      columns
        .map((col, i) => String(row[col] ?? "").padEnd(widths[i]!))
        .join("  "),
    );
  }
}

export async function handleQuery(
  subcommand: string,
  rawArgs: Record<string, unknown>,
): Promise<void> {
  switch (subcommand) {
    case "notes": {
      const args = QueryNotesArgsSchema.parse(rawArgs);
      const rows = queryNotes({
        tag: args.tag,
        type: args.type,
        search: args.search,
        limit: args.limit,
      });
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        printTable(rows as Record<string, unknown>[], [
          "id",
          "title",
          "noteType",
          "filePath",
          "updatedAt",
          "favorite",
        ]);
      }
      break;
    }
    case "tags": {
      const args = QueryTagsArgsSchema.parse(rawArgs);
      const rows = queryTags({ note: args.note });
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        printTable(rows as Record<string, unknown>[], ["hashtag", "filename"]);
      }
      break;
    }
    case "settings": {
      const args = QuerySettingsArgsSchema.parse(rawArgs);
      const rows = querySettings();
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        rows.forEach((s) => console.log(`${s.name} = ${s.value}`));
      }
      break;
    }
    case "projects": {
      const args = QueryProjectsArgsSchema.parse(rawArgs);
      const rows = queryProjects();
      if (args.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        printTable(rows as Record<string, unknown>[], [
          "id",
          "title",
          "folderPath",
        ]);
      }
      break;
    }
    default: {
      console.error(
        `Unknown query subcommand: ${subcommand}\nAvailable: notes, tags, settings, projects`,
      );
      process.exit(1);
    }
  }
}

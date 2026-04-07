import { Script } from "@/store/repositories/entities/script";
import { Dates } from "./dates";

export type SystemVariable = {
  name: string;
  description: string;
  value: (content: string, dict: Record<string, string>) => string;
};

export const SYSTEM_VARIABLES: SystemVariable[] = [
  {
    name: "DATE",
    description: "Current date in YYYY-MM-DD format.",
    value: () => Dates.yearMonthDay(new Date()),
  },
  {
    name: "TIME",
    description: "Current time in HH:mm format.",
    value: () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
  },
  {
    name: "DATETIME",
    description: "Current date and time.",
    value: () => {
      const now = new Date();
      return `${Dates.yearMonthDay(now)} ${now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`;
    },
  },
  {
    name: "YEAR",
    description: "Current year (e.g., 2024).",
    value: () => new Date().getFullYear().toString(),
  },
  {
    name: "MONTH",
    description: "Current month (01-12).",
    value: () => (new Date().getMonth() + 1).toString().padStart(2, "0"),
  },
  {
    name: "DAY",
    description: "Current day of the month (01-31).",
    value: () => new Date().getDate().toString().padStart(2, "0"),
  },
  {
    name: "TITLE",
    description: "The title of the note being created.",
    value: (_, dict) => dict.TITLE || "",
  },
];

/**
 * Extracts all {{VARIABLE}} placeholders from content
 */
export const extractVariables = (content: string): string[] => {
  const regex = /\{\{([^{}]+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
};

/**
 * Filters out system variables and script variables to get only user-defined ones
 */
export const getUserVariables = (
  content: string,
  scriptNames: string[] = [],
): string[] => {
  const allVars = extractVariables(content);
  return allVars.filter(
    (v) =>
      !SYSTEM_VARIABLES.some((sv) => sv.name === v.toUpperCase()) &&
      !scriptNames.includes(v),
  );
};

const executeScript = (script: Script, context: any): string => {
  try {
    const fn = new Function("context", script.content);
    const result = fn(context);
    return result?.toString() || "";
  } catch (error) {
    console.error(`Failed to execute script ${script.name}:`, error);
    return `[Error in ${script.name}]`;
  }
};

const sanitize = (s: string) => s.replace(/\{\{/g, "").replace(/\}\}/g, "");

const compareScriptName = (name: string, script: Script) =>
  sanitize(name) === sanitize(script.name);

/**
 * Replaces all placeholders with provided, system, or script values
 */
export const substituteVariables = (
  content: string,
  userValues: Record<string, string> = {},
  scripts: Script[] = [],
): string => {
  return content.replace(/\{\{([^{}]+)\}\}/g, (_, variableName) => {
    const name = variableName.trim();
    const upperName = name.toUpperCase();
    if (name in userValues) {
      return userValues[name];
    }
    if (upperName in userValues) {
      return userValues[upperName];
    }
    const systemVar = SYSTEM_VARIABLES.find((sv) => sv.name === upperName);
    if (systemVar) {
      return systemVar.value(content, userValues);
    }
    const script = scripts.find((script) => compareScriptName(name, script));
    if (script) {
      return executeScript(script, { userValues, content });
    }
    return "";
  });
};

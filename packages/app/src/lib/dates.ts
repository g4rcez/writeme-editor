import { format, isValid } from "date-fns";
import { parse as chronoParse } from "chrono-node";

const timezoneMap: Record<string, string> = {
  // North America
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
  ET: "America/New_York",
  PT: "America/Los_Angeles",
  MT: "America/Denver",
  CT: "America/Chicago",

  // Europe
  GMT: "UTC",
  UTC: "UTC",
  CET: "Europe/Paris",
  CEST: "Europe/Paris",
  EET: "Europe/Athens",
  EEST: "Europe/Athens",
  WET: "Europe/Lisbon",
  WEST: "Europe/Lisbon",
  BST: "Europe/London",

  // South America
  BRT: "America/Sao_Paulo",
  BRST: "America/Sao_Paulo",
  BRL: "America/Sao_Paulo",

  // Asia/Pacific
  JST: "Asia/Tokyo",
  KST: "Asia/Seoul",
  IST: "Asia/Kolkata",
  SGT: "Asia/Singapore",
  HKT: "Asia/Hong_Kong",
  WIB: "Asia/Jakarta",
  MSK: "Europe/Moscow",
  AEST: "Australia/Sydney",
  AEDT: "Australia/Sydney",
  ACST: "Australia/Adelaide",
  ACDT: "Australia/Adelaide",
  AWST: "Australia/Perth",
  NZST: "Pacific/Auckland",
  NZDT: "Pacific/Auckland",
};

export const Dates = {
  valid: isValid,
  isoDate: (d: Date) => format(d, "yyyy-MM-dd"),
  time: (d: Date) => format(d, "HH:mm"),
  yearMonthDay: (d: Date) => format(d, "yyyy-MM-dd"),
  evaluateTimezone: (expr: string): string | null => {
    const match = expr.match(/(.+)\s+to\s+([a-zA-Z/_]{2,})$/i);
    if (!match) return null;
    const timePart = match?.[1]?.trim();
    const target = match?.[2]?.trim().toUpperCase();
    const results = chronoParse(timePart!);
    if (results.length === 0) return null;
    try {
      const result = results[0];
      if ((result?.start as any).knownValues.hour === undefined) return null;
      const targetIANA = timezoneMap[target!] || target;
      const date = result?.start.date();
      if (!date) {
        return null;
      }
      return new Intl.DateTimeFormat(undefined, {
        timeZone: targetIANA,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }).format(date);
    } catch (e) {
      return null;
    }
  },
};

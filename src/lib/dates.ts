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

  // Europe — fixed offsets so the abbreviation always means its stated UTC offset
  GMT: "UTC",
  UTC: "UTC",
  CET: "Etc/GMT-1",
  CEST: "Etc/GMT-2",
  EET: "Etc/GMT-2",
  EEST: "Etc/GMT-3",
  WET: "UTC",
  WEST: "Etc/GMT-1",
  BST: "Etc/GMT-1",

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

const cityMap: Record<string, string> = {
  // Americas
  "new york": "America/New_York",
  "nova york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  chicago: "America/Chicago",
  toronto: "America/Toronto",
  montreal: "America/Toronto",
  vancouver: "America/Vancouver",
  "mexico city": "America/Mexico_City",
  "ciudad de mexico": "America/Mexico_City",
  "rio de janeiro": "America/Sao_Paulo",
  rio: "America/Sao_Paulo",
  "sao paulo": "America/Sao_Paulo",
  "são paulo": "America/Sao_Paulo",
  "buenos aires": "America/Argentina/Buenos_Aires",
  santiago: "America/Santiago",
  lima: "America/Lima",
  bogota: "America/Bogota",
  bogotá: "America/Bogota",
  caracas: "America/Caracas",
  montevideo: "America/Montevideo",
  // Europe
  london: "Europe/London",
  londres: "Europe/London",
  paris: "Europe/Paris",
  berlin: "Europe/Berlin",
  madrid: "Europe/Madrid",
  rome: "Europe/Rome",
  roma: "Europe/Rome",
  amsterdam: "Europe/Amsterdam",
  brussels: "Europe/Brussels",
  bruxelas: "Europe/Brussels",
  bruxelles: "Europe/Brussels",
  vienna: "Europe/Vienna",
  viena: "Europe/Vienna",
  wien: "Europe/Vienna",
  prague: "Europe/Prague",
  praga: "Europe/Prague",
  praha: "Europe/Prague",
  warsaw: "Europe/Warsaw",
  varsóvia: "Europe/Warsaw",
  warszawa: "Europe/Warsaw",
  budapest: "Europe/Budapest",
  stockholm: "Europe/Stockholm",
  estocolmo: "Europe/Stockholm",
  oslo: "Europe/Oslo",
  helsinki: "Europe/Helsinki",
  helsinque: "Europe/Helsinki",
  lisbon: "Europe/Lisbon",
  lisboa: "Europe/Lisbon",
  athens: "Europe/Athens",
  atenas: "Europe/Athens",
  moscow: "Europe/Moscow",
  moscou: "Europe/Moscow",
  moskva: "Europe/Moscow",
  luxembourg: "Europe/Luxembourg",
  luxemburgo: "Europe/Luxembourg",
  zurich: "Europe/Zurich",
  zurique: "Europe/Zurich",
  zürich: "Europe/Zurich",
  geneva: "Europe/Zurich",
  genebra: "Europe/Zurich",
  genève: "Europe/Zurich",
  bern: "Europe/Zurich",
  berna: "Europe/Zurich",
  copenhagen: "Europe/Copenhagen",
  copenhague: "Europe/Copenhagen",
  københavn: "Europe/Copenhagen",
  bucharest: "Europe/Bucharest",
  bucareste: "Europe/Bucharest",
  sofia: "Europe/Sofia",
  belgrade: "Europe/Belgrade",
  belgrado: "Europe/Belgrade",
  bratislava: "Europe/Bratislava",
  vilnius: "Europe/Vilnius",
  riga: "Europe/Riga",
  tallinn: "Europe/Tallinn",
  reykjavik: "Atlantic/Reykjavik",
  reiquiavique: "Atlantic/Reykjavik",
  dublin: "Europe/Dublin",
  dublim: "Europe/Dublin",
  istanbul: "Europe/Istanbul",
  istambul: "Europe/Istanbul",
  zagreb: "Europe/Zagreb",
  // Asia
  tokyo: "Asia/Tokyo",
  tóquio: "Asia/Tokyo",
  seoul: "Asia/Seoul",
  seul: "Asia/Seoul",
  beijing: "Asia/Shanghai",
  pequim: "Asia/Shanghai",
  peking: "Asia/Shanghai",
  shanghai: "Asia/Shanghai",
  "hong kong": "Asia/Hong_Kong",
  singapore: "Asia/Singapore",
  singapura: "Asia/Singapore",
  mumbai: "Asia/Kolkata",
  bombaim: "Asia/Kolkata",
  bombay: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  "new delhi": "Asia/Kolkata",
  "nova delhi": "Asia/Kolkata",
  kolkata: "Asia/Kolkata",
  calcutá: "Asia/Kolkata",
  bangkok: "Asia/Bangkok",
  bancoque: "Asia/Bangkok",
  jakarta: "Asia/Jakarta",
  jacarta: "Asia/Jakarta",
  dubai: "Asia/Dubai",
  "tel aviv": "Asia/Jerusalem",
  karachi: "Asia/Karachi",
  dhaka: "Asia/Dhaka",
  daca: "Asia/Dhaka",
  manila: "Asia/Manila",
  manilha: "Asia/Manila",
  taipei: "Asia/Taipei",
  taipé: "Asia/Taipei",
  "kuala lumpur": "Asia/Kuala_Lumpur",
  riyadh: "Asia/Riyadh",
  riade: "Asia/Riyadh",
  tehran: "Asia/Tehran",
  teerã: "Asia/Tehran",
  baghdad: "Asia/Baghdad",
  bagdá: "Asia/Baghdad",
  colombo: "Asia/Colombo",
  // Africa
  cairo: "Africa/Cairo",
  johannesburg: "Africa/Johannesburg",
  joanesburgo: "Africa/Johannesburg",
  lagos: "Africa/Lagos",
  nairobi: "Africa/Nairobi",
  casablanca: "Africa/Casablanca",
  accra: "Africa/Accra",
  "addis ababa": "Africa/Addis_Ababa",
  "adis abeba": "Africa/Addis_Ababa",
  tunis: "Africa/Tunis",
  algiers: "Africa/Algiers",
  argel: "Africa/Algiers",
  // Oceania
  sydney: "Australia/Sydney",
  sidney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane",
  perth: "Australia/Perth",
  adelaide: "Australia/Adelaide",
  auckland: "Pacific/Auckland",
  honolulu: "Pacific/Honolulu",
};

const resolveLocation = (location: string): string | null => {
  const upper = location.toUpperCase();
  if (timezoneMap[upper]) return timezoneMap[upper];
  const lower = location.toLowerCase();
  if (cityMap[lower]) return cityMap[lower];
  return location;
};

export const Dates = {
  valid: isValid,
  isoDate: (d: Date) => format(d, "yyyy-MM-dd"),
  time: (d: Date) => format(d, "HH:mm"),
  yearMonthDay: (d: Date) => format(d, "yyyy-MM-dd"),
  evaluateTimezone: (expr: string): string | null => {
    const match = expr.match(/^(.+?)\s+(?:in|to)\s+(.+)$/i);
    if (!match) return null;
    const timePart = match[1]!.trim();
    const locationRaw = match[2]!.trim();
    const targetIANA = resolveLocation(locationRaw);
    if (!targetIANA) return null;
    try {
      const date = /^now$/i.test(timePart)
        ? new Date()
        : (() => {
            const results = chronoParse(timePart);
            if (results.length === 0) return null;
            const result = results[0]!;
            if ((result.start as any).knownValues.hour === undefined)
              return null;
            return result.start.date();
          })();
      if (!date) return null;
      return new Intl.DateTimeFormat(undefined, {
        timeZone: targetIANA,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(date);
    } catch {
      return null;
    }
  },
};

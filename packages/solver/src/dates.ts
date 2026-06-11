import { add, differenceInCalendarDays, format, isValid, sub } from "date-fns";
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
  // Sourced from Raycast / SoulverCore (528 cities)
  aba: "Africa/Lagos",
  abeokuta: "Africa/Lagos",
  aberdeen: "Europe/London",
  abidjan: "Africa/Abidjan",
  abobo: "Africa/Abidjan",
  "abu dhabi": "Asia/Dubai",
  abuja: "Africa/Lagos",
  accra: "Africa/Accra",
  "addis ababa": "Africa/Addis_Ababa",
  adelaide: "Australia/Adelaide",
  aden: "Asia/Aden",
  agadir: "Africa/Casablanca",
  ahmedabad: "Asia/Kolkata",
  ahvaz: "Asia/Tehran",
  albuquerque: "America/Denver",
  aleppo: "Asia/Damascus",
  alexandria: "Africa/Cairo",
  algiers: "Africa/Algiers",
  almaty: "Asia/Almaty",
  ambon: "Asia/Jayapura",
  amiens: "Europe/Paris",
  amman: "Asia/Amman",
  amsterdam: "Europe/Amsterdam",
  anchorage: "America/Anchorage",
  ankara: "Europe/Istanbul",
  antalya: "Europe/Istanbul",
  antananarivo: "Indian/Antananarivo",
  antwerpen: "Europe/Brussels",
  arhus: "Europe/Copenhagen",
  ashgabat: "Asia/Ashgabat",
  astrakhan: "Europe/Astrakhan",
  asuncion: "America/Asuncion",
  athens: "Europe/Athens",
  atyrau: "Asia/Atyrau",
  auckland: "Pacific/Auckland",
  austin: "America/Chicago",
  baghdad: "Asia/Baghdad",
  baku: "Asia/Baku",
  baltimore: "America/New_York",
  bamako: "Africa/Bamako",
  "bandar seri begawan": "Asia/Brunei",
  bangkok: "Asia/Bangkok",
  barcelona: "Europe/Madrid",
  bari: "Europe/Rome",
  barnaul: "Asia/Barnaul",
  basel: "Europe/Zurich",
  "baton rouge": "America/Chicago",
  batumi: "Asia/Tbilisi",
  beijing: "Asia/Shanghai",
  beirut: "Asia/Beirut",
  belem: "America/Belem",
  belfast: "Europe/London",
  belgrade: "Europe/Belgrade",
  "belo horizonte": "America/Sao_Paulo",
  bengaluru: "Asia/Kolkata",
  "benin city": "Africa/Lagos",
  benoni: "Africa/Johannesburg",
  bergen: "Europe/Oslo",
  berlin: "Europe/Berlin",
  bern: "Europe/Zurich",
  birmingham: "Europe/London",
  bishkek: "Asia/Bishkek",
  blantyre: "Africa/Blantyre",
  bogota: "America/Bogota",
  boise: "America/Boise",
  bologna: "Europe/Rome",
  bordeaux: "Europe/Paris",
  boston: "America/New_York",
  boumerdas: "Africa/Algiers",
  brasilia: "America/Sao_Paulo",
  bratislava: "Europe/Bratislava",
  brazzaville: "Africa/Brazzaville",
  bremen: "Europe/Berlin",
  brest: "Europe/Paris",
  brighton: "Europe/London",
  brisbane: "Australia/Brisbane",
  bristol: "Europe/London",
  brooklyn: "America/New_York",
  brussels: "Europe/Brussels",
  bucharest: "Europe/Bucharest",
  budapest: "Europe/Budapest",
  "buenos aires": "America/Argentina/Buenos_Aires",
  bulawayo: "Africa/Harare",
  busan: "Asia/Seoul",
  cairns: "Australia/Brisbane",
  cairo: "Africa/Cairo",
  calgary: "America/Edmonton",
  camayenne: "Africa/Conakry",
  cambridge: "Europe/London",
  "campo grande": "America/Campo_Grande",
  canberra: "Australia/Sydney",
  cancun: "America/Cancun",
  "cape town": "Africa/Johannesburg",
  caracas: "America/Caracas",
  cardiff: "Europe/London",
  carrefour: "America/Port-au-Prince",
  casablanca: "Africa/Casablanca",
  catania: "Europe/Rome",
  chelyabinsk: "Asia/Yekaterinburg",
  chengdu: "Asia/Shanghai",
  chennai: "Asia/Kolkata",
  "chiang mai": "Asia/Bangkok",
  chicago: "America/Chicago",
  chisinau: "Europe/Chisinau",
  chita: "Asia/Chita",
  chittagong: "Asia/Dhaka",
  chongqing: "Asia/Shanghai",
  christchurch: "Pacific/Auckland",
  cincinnati: "America/New_York",
  cologne: "Europe/Berlin",
  colombo: "Asia/Colombo",
  conakry: "Africa/Conakry",
  copenhagen: "Europe/Copenhagen",
  cordoba: "America/Argentina/Cordoba",
  cork: "Europe/Dublin",
  culiacan: "America/Mazatlan",
  cupertino: "America/Los_Angeles",
  "da nang": "Asia/Ho_Chi_Minh",
  dakar: "Africa/Dakar",
  dallas: "America/Chicago",
  damascus: "Asia/Damascus",
  "dar es salaam": "Africa/Dar_es_Salaam",
  darwin: "Australia/Darwin",
  delhi: "Asia/Kolkata",
  denpasar: "Asia/Makassar",
  denver: "America/Denver",
  "des moines": "America/Chicago",
  detroit: "America/Detroit",
  dhaka: "Asia/Dhaka",
  dijon: "Europe/Paris",
  dili: "Asia/Dili",
  djibouti: "Africa/Djibouti",
  doha: "Asia/Qatar",
  dortmund: "Europe/Berlin",
  douala: "Africa/Douala",
  dresden: "Europe/Berlin",
  dubai: "Asia/Dubai",
  dublin: "Europe/Dublin",
  duisburg: "Europe/Berlin",
  durban: "Africa/Johannesburg",
  dushanbe: "Asia/Dushanbe",
  dusseldorf: "Europe/Berlin",
  "east jerusalem": "Asia/Hebron",
  edinburgh: "Europe/London",
  edmonton: "America/Edmonton",
  "el paso": "America/Denver",
  enugu: "Africa/Lagos",
  essen: "Europe/Berlin",
  fes: "Africa/Casablanca",
  florence: "Europe/Rome",
  "fort worth": "America/Chicago",
  fortaleza: "America/Fortaleza",
  "frankfurt am main": "Europe/Berlin",
  freetown: "Africa/Freetown",
  frisco: "America/Chicago",
  fukuoka: "Asia/Tokyo",
  gaza: "Asia/Gaza",
  geelong: "Australia/Melbourne",
  geneva: "Europe/Zurich",
  genoa: "Europe/Rome",
  gent: "Europe/Brussels",
  georgetown: "America/Guyana",
  giza: "Africa/Cairo",
  glasgow: "Europe/London",
  "gold coast": "Australia/Brisbane",
  graz: "Europe/Vienna",
  guangzhou: "Asia/Shanghai",
  "guatemala city": "America/Guatemala",
  guayaquil: "America/Guayaquil",
  halifax: "America/Halifax",
  hamburg: "Europe/Berlin",
  hamilton: "Pacific/Auckland",
  hannover: "Europe/Berlin",
  hanoi: "Asia/Ho_Chi_Minh",
  harare: "Africa/Harare",
  havana: "America/Havana",
  hebron: "Asia/Hebron",
  helsinki: "Europe/Helsinki",
  hermosillo: "America/Hermosillo",
  hiroshima: "Asia/Tokyo",
  "ho chi minh city": "Asia/Ho_Chi_Minh",
  hobart: "Australia/Hobart",
  "hong kong": "Asia/Hong_Kong",
  honolulu: "Pacific/Honolulu",
  houston: "America/Chicago",
  hyderabad: "Asia/Karachi",
  ibadan: "Africa/Lagos",
  ilorin: "Africa/Lagos",
  indianapolis: "America/Indiana/Indianapolis",
  innsbruck: "Europe/Vienna",
  irkutsk: "Asia/Irkutsk",
  isfahan: "Asia/Tehran",
  islamabad: "Asia/Karachi",
  istanbul: "Europe/Istanbul",
  izmir: "Europe/Istanbul",
  jackson: "America/Chicago",
  jakarta: "Asia/Jakarta",
  jeddah: "Asia/Riyadh",
  jerusalem: "Asia/Jerusalem",
  johannesburg: "Africa/Johannesburg",
  jos: "Africa/Lagos",
  juarez: "America/Ojinaga",
  kabul: "Asia/Kabul",
  kaduna: "Africa/Lagos",
  kahriz: "Asia/Tehran",
  kaliningrad: "Europe/Kaliningrad",
  kampala: "Africa/Kampala",
  kandahar: "Asia/Kabul",
  kano: "Africa/Lagos",
  "kansas city": "America/Chicago",
  karachi: "Asia/Karachi",
  karaj: "Asia/Tehran",
  kathmandu: "Asia/Kathmandu",
  kaunas: "Europe/Vilnius",
  kawasaki: "Asia/Tokyo",
  kazan: "Europe/Moscow",
  kerman: "Asia/Tehran",
  kermanshah: "Asia/Tehran",
  kharkiv: "Europe/Kiev",
  khartoum: "Africa/Khartoum",
  kigali: "Africa/Kigali",
  kingston: "America/Jamaica",
  kinshasa: "Africa/Kinshasa",
  kobe: "Asia/Tokyo",
  kolkata: "Asia/Kolkata",
  kostanay: "Asia/Qostanay",
  "kota bharu": "Asia/Kuala_Lumpur",
  krakow: "Europe/Warsaw",
  krasnodar: "Europe/Moscow",
  krasnoyarsk: "Asia/Krasnoyarsk",
  "kuala lumpur": "Asia/Kuala_Lumpur",
  kuching: "Asia/Kuching",
  kumasi: "Africa/Accra",
  kursk: "Europe/Moscow",
  kutaisi: "Asia/Tbilisi",
  "kuwait city": "Asia/Kuwait",
  kyiv: "Europe/Kiev",
  kyoto: "Asia/Tokyo",
  "la laguna": "Atlantic/Canary",
  "la paz": "America/La_Paz",
  "la rioja": "America/Argentina/La_Rioja",
  lagos: "Africa/Lagos",
  "las palmas de gran canaria": "Atlantic/Canary",
  lasvegas: "America/Los_Angeles",
  leeds: "Europe/London",
  leicester: "Europe/London",
  leipzig: "Europe/Berlin",
  libreville: "Africa/Libreville",
  lille: "Europe/Paris",
  lilongwe: "Africa/Blantyre",
  lima: "America/Lima",
  linz: "Europe/Vienna",
  lisbon: "Europe/Lisbon",
  "little rock": "America/Chicago",
  liverpool: "Europe/London",
  ljubljana: "Europe/Ljubljana",
  "logan city": "Australia/Brisbane",
  lome: "Africa/Lome",
  london: "Europe/London",
  "los angeles": "America/Los_Angeles",
  "los mochis": "America/Mazatlan",
  luanda: "Africa/Luanda",
  lubumbashi: "Africa/Lubumbashi",
  lusaka: "Africa/Lusaka",
  "luxembourg city": "Europe/Luxembourg",
  lviv: "Europe/Kiev",
  lyon: "Europe/Paris",
  macau: "Asia/Macau",
  maceio: "America/Maceio",
  madison: "America/Chicago",
  madrid: "Europe/Madrid",
  maiduguri: "Africa/Lagos",
  makassar: "Asia/Makassar",
  male: "Indian/Maldives",
  manama: "Asia/Bahrain",
  manchester: "Europe/London",
  manhattan: "America/New_York",
  manila: "Asia/Manila",
  maputo: "Africa/Maputo",
  marrakesh: "Africa/Casablanca",
  marseille: "Europe/Paris",
  mashhad: "Asia/Tehran",
  matola: "Africa/Maputo",
  mazatlan: "America/Mazatlan",
  "mbuji-mayi": "Africa/Lubumbashi",
  mecca: "Asia/Riyadh",
  medellin: "America/Bogota",
  medina: "Asia/Riyadh",
  melbourne: "Australia/Melbourne",
  memphis: "America/Chicago",
  mendoza: "America/Argentina/Mendoza",
  merida: "America/Merida",
  messina: "Europe/Rome",
  "mexico city": "America/Mexico_City",
  miami: "America/New_York",
  milan: "Europe/Rome",
  milwaukee: "America/Chicago",
  minneapolis: "America/Chicago",
  minsk: "Europe/Minsk",
  modena: "Europe/Rome",
  mogadishu: "Africa/Mogadishu",
  monrovia: "Africa/Monrovia",
  monterrey: "America/Monterrey",
  montevideo: "America/Montevideo",
  montpellier: "Europe/Paris",
  montreal: "America/Toronto",
  moscow: "Europe/Moscow",
  mumbai: "Asia/Kolkata",
  munich: "Europe/Berlin",
  murmansk: "Europe/Moscow",
  muscat: "Asia/Muscat",
  "n'djamena": "Africa/Ndjamena",
  nagoya: "Asia/Tokyo",
  nairobi: "Africa/Nairobi",
  nanchong: "Asia/Shanghai",
  nanjing: "Asia/Shanghai",
  nantes: "Europe/Paris",
  naples: "Europe/Rome",
  nashville: "America/Chicago",
  nassau: "America/Nassau",
  "new orleans": "America/Chicago",
  "new york": "America/New_York",
  newcastle: "Australia/Sydney",
  niamey: "Africa/Niamey",
  nice: "Europe/Paris",
  nicosia: "Asia/Nicosia",
  "nizhniy novgorod": "Europe/Moscow",
  nottingham: "Europe/London",
  nouakchott: "Africa/Nouakchott",
  "novi sad": "Europe/Belgrade",
  novosibirsk: "Asia/Novosibirsk",
  "nur-sultan": "Asia/Nur-Sultan",
  nuremberg: "Europe/Berlin",
  odense: "Europe/Copenhagen",
  odessa: "Europe/Kiev",
  "oklahoma city": "America/Chicago",
  omaha: "America/Chicago",
  omdurman: "Africa/Khartoum",
  omsk: "Asia/Omsk",
  oral: "Asia/Oral",
  oran: "Africa/Algiers",
  orenburg: "Asia/Yekaterinburg",
  orlando: "America/New_York",
  osaka: "Asia/Tokyo",
  osh: "Asia/Bishkek",
  oslo: "Europe/Oslo",
  ottawa: "America/Toronto",
  ouagadougou: "Africa/Ouagadougou",
  oxford: "Europe/London",
  oyo: "Africa/Lagos",
  padova: "Europe/Rome",
  palermo: "Europe/Rome",
  palmas: "America/Araguaina",
  panama: "America/Panama",
  paramaribo: "America/Paramaribo",
  paris: "Europe/Paris",
  parma: "Europe/Rome",
  pasadena: "America/Los_Angeles",
  "pasragad branch": "Asia/Tehran",
  perm: "Asia/Yekaterinburg",
  perth: "Australia/Perth",
  petrozavodsk: "Europe/Moscow",
  philadelphia: "America/New_York",
  "phnom penh": "Asia/Phnom_Penh",
  phoenix: "America/Phoenix",
  pietermaritzburg: "Africa/Johannesburg",
  pikine: "Africa/Dakar",
  pittsburgh: "America/New_York",
  plymouth: "Europe/London",
  podgorica: "Europe/Podgorica",
  "pointe-noire": "Africa/Brazzaville",
  pontianak: "Asia/Pontianak",
  "port elizabeth": "Africa/Johannesburg",
  "port harcourt": "Africa/Lagos",
  "port moresby": "Pacific/Port_Moresby",
  "port-au-prince": "America/Port-au-Prince",
  portland: "America/Los_Angeles",
  porto: "Europe/Lisbon",
  "porto velho": "America/Porto_Velho",
  prague: "Europe/Prague",
  pretoria: "Africa/Johannesburg",
  pristina: "Europe/Belgrade",
  pskov: "Europe/Moscow",
  pyongyang: "Asia/Pyongyang",
  qom: "Asia/Tehran",
  quebec: "America/Toronto",
  queens: "America/New_York",
  "quezon city": "Asia/Manila",
  quito: "America/Guayaquil",
  rabat: "Africa/Casablanca",
  raleigh: "America/New_York",
  rasht: "Asia/Tehran",
  recife: "America/Recife",
  regina: "America/Regina",
  reykjavik: "Atlantic/Reykjavik",
  riga: "Europe/Riga",
  "rio branco": "America/Rio_Branco",
  "rio de janeiro": "America/Sao_Paulo",
  riyadh: "Asia/Riyadh",
  rome: "Europe/Rome",
  "rostov-na-donu": "Europe/Moscow",
  rotterdam: "Europe/Amsterdam",
  sacramento: "America/Los_Angeles",
  "saint petersburg": "Europe/Moscow",
  saitama: "Asia/Tokyo",
  sale: "Africa/Casablanca",
  "salt lake city": "America/Denver",
  salta: "America/Argentina/Salta",
  salvador: "America/Bahia",
  salzburg: "Europe/Vienna",
  samara: "Europe/Samara",
  samarkand: "Asia/Samarkand",
  "san antonio": "America/Chicago",
  "san diego": "America/Los_Angeles",
  "san fernando del valle de catamarca": "America/Argentina/Catamarca",
  "san francisco": "America/Los_Angeles",
  "san jose": "America/Costa_Rica",
  "san juan": "America/Puerto_Rico",
  "san luis": "America/Argentina/San_Luis",
  "san miguel de tucuman": "America/Argentina/Tucuman",
  "san salvador": "America/El_Salvador",
  "san salvador de jujuy": "America/Argentina/Jujuy",
  sanaa: "Asia/Aden",
  "santa cruz de la sierra": "America/La_Paz",
  "santa cruz de tenerife": "Atlantic/Canary",
  santarem: "America/Santarem",
  santiago: "America/Santiago",
  "santo domingo": "America/Santo_Domingo",
  "sao paulo": "America/Sao_Paulo",
  sapporo: "Asia/Tokyo",
  sarajevo: "Europe/Sarajevo",
  saratov: "Europe/Saratov",
  saskatoon: "America/Regina",
  seattle: "America/Los_Angeles",
  seoul: "Asia/Seoul",
  sevastopol: "Europe/Zaporozhye",
  shanghai: "Asia/Shanghai",
  sharjah: "Asia/Dubai",
  sheffield: "Europe/London",
  shenzhen: "Asia/Shanghai",
  shiraz: "Asia/Tehran",
  simferopol: "Europe/Simferopol",
  singapore: "Asia/Singapore",
  skopje: "Europe/Skopje",
  smolensk: "Europe/Moscow",
  sochi: "Europe/Moscow",
  sofia: "Europe/Sofia",
  soweto: "Africa/Johannesburg",
  split: "Europe/Zagreb",
  springfield: "America/New_York",
  stockholm: "Europe/Stockholm",
  strasbourg: "Europe/Paris",
  stuttgart: "Europe/Berlin",
  surabaya: "Asia/Jakarta",
  sydney: "Australia/Sydney",
  tabriz: "Asia/Tehran",
  taipei: "Asia/Taipei",
  tallahassee: "America/New_York",
  tallinn: "Europe/Tallinn",
  tampa: "America/New_York",
  tangier: "Africa/Casablanca",
  tashkent: "Asia/Tashkent",
  tbilisi: "Asia/Tbilisi",
  tebessa: "Africa/Algiers",
  tegucigalpa: "America/Tegucigalpa",
  tehran: "Asia/Tehran",
  "tel aviv": "Asia/Jerusalem",
  tepic: "America/Mazatlan",
  "the bronx": "America/New_York",
  "the hague": "Europe/Amsterdam",
  tianjin: "Asia/Shanghai",
  tijuana: "America/Tijuana",
  tirana: "Europe/Tirane",
  tokyo: "Asia/Tokyo",
  tomsk: "Asia/Tomsk",
  toowoomba: "Australia/Brisbane",
  toronto: "America/Toronto",
  toulouse: "Europe/Paris",
  tours: "Europe/Paris",
  townsville: "Australia/Brisbane",
  trieste: "Europe/Rome",
  tripoli: "Africa/Tripoli",
  trondheim: "Europe/Oslo",
  tulsa: "America/Chicago",
  tunis: "Africa/Tunis",
  turin: "Europe/Rome",
  turku: "Europe/Helsinki",
  tver: "Europe/Moscow",
  tyumen: "Asia/Yekaterinburg",
  ufa: "Asia/Yekaterinburg",
  "ulan bator": "Asia/Ulaanbaatar",
  uppsala: "Europe/Stockholm",
  urumqi: "Asia/Urumqi",
  utrecht: "Europe/Amsterdam",
  valencia: "Europe/Madrid",
  valletta: "Europe/Malta",
  vancouver: "America/Vancouver",
  venice: "Europe/Rome",
  verona: "Europe/Rome",
  victoria: "America/Vancouver",
  vienna: "Europe/Vienna",
  vientiane: "Asia/Vientiane",
  vilnius: "Europe/Vilnius",
  vladikavkaz: "Europe/Moscow",
  vladivostok: "Asia/Vladivostok",
  volgograd: "Europe/Volgograd",
  voronezh: "Europe/Moscow",
  warsaw: "Europe/Warsaw",
  washington: "America/New_York",
  wellington: "Pacific/Auckland",
  wichita: "America/Chicago",
  winnipeg: "America/Winnipeg",
  wollongong: "Australia/Sydney",
  wuhan: "Asia/Shanghai",
  "xi'an": "Asia/Shanghai",
  yakutsk: "Asia/Yakutsk",
  yangon: "Asia/Yangon",
  yaounde: "Africa/Douala",
  yazd: "Asia/Tehran",
  yekaterinburg: "Asia/Yekaterinburg",
  yerevan: "Asia/Yerevan",
  yokohama: "Asia/Tokyo",
  york: "Europe/London",
  "yuzhno-sakhalinsk": "Asia/Sakhalin",
  zagreb: "Europe/Zagreb",
  zaria: "Africa/Lagos",
  zhongshan: "Asia/Urumqi",
  zurich: "Europe/Zurich",

  // Portuguese and alternate aliases
  rio: "America/Sao_Paulo",
  "nova york": "America/New_York",
  "são paulo": "America/Sao_Paulo",
  brasília: "America/Sao_Paulo",
  assunção: "America/Asuncion",
  "são francisco": "America/Los_Angeles",
  "nova orlães": "America/Chicago",
  "cidade do méxico": "America/Mexico_City",
  londres: "Europe/London",
  edimburgo: "Europe/London",
  cardife: "Europe/London",
  dublim: "Europe/Dublin",
  bruxelas: "Europe/Brussels",
  antuérpia: "Europe/Brussels",
  viena: "Europe/Vienna",
  praga: "Europe/Prague",
  varsóvia: "Europe/Warsaw",
  estocolmo: "Europe/Stockholm",
  helsinque: "Europe/Helsinki",
  copenhague: "Europe/Copenhagen",
  atenas: "Europe/Athens",
  moscou: "Europe/Moscow",
  "são petersburgo": "Europe/Moscow",
  luxemburgo: "Europe/Luxembourg",
  zurique: "Europe/Zurich",
  genebra: "Europe/Zurich",
  berna: "Europe/Zurich",
  bucareste: "Europe/Bucharest",
  belgrado: "Europe/Belgrade",
  istambul: "Europe/Istanbul",
  reiquiavique: "Atlantic/Reykjavik",
  milão: "Europe/Rome",
  florença: "Europe/Rome",
  veneza: "Europe/Rome",
  nápoles: "Europe/Rome",
  munique: "Europe/Berlin",
  colônia: "Europe/Berlin",
  tóquio: "Asia/Tokyo",
  seul: "Asia/Seoul",
  pequim: "Asia/Shanghai",
  singapura: "Asia/Singapore",
  bombaim: "Asia/Kolkata",
  "nova delhi": "Asia/Kolkata",
  calcutá: "Asia/Kolkata",
  bancoque: "Asia/Bangkok",
  jacarta: "Asia/Jakarta",
  manilha: "Asia/Manila",
  taipé: "Asia/Taipei",
  riade: "Asia/Riyadh",
  teerã: "Asia/Tehran",
  bagdá: "Asia/Baghdad",
  amã: "Asia/Amman",
  beirute: "Asia/Beirut",
  damasco: "Asia/Damascus",
  mascate: "Asia/Muscat",
  "abu dabi": "Asia/Dubai",
  tachkente: "Asia/Tashkent",
  katmandu: "Asia/Kathmandu",
  "nom pen": "Asia/Phnom_Penh",
  "cidade de ho chi minh": "Asia/Ho_Chi_Minh",
  joanesburgo: "Africa/Johannesburg",
  "cidade do cabo": "Africa/Johannesburg",
  argel: "Africa/Algiers",
  cartum: "Africa/Khartoum",
  "adis abeba": "Africa/Addis_Ababa",
  "dar es salã": "Africa/Dar_es_Salaam",
  sidney: "Australia/Sydney",
  "nova zelândia": "Pacific/Auckland",
};

const resolveLocation = (location: string): string | null => {
  const upper = location.toUpperCase();
  if (timezoneMap[upper]) return timezoneMap[upper];
  const lower = location.toLowerCase();
  if (cityMap[lower]) return cityMap[lower];
  return location;
};

type DurationKey =
  | "years"
  | "months"
  | "weeks"
  | "days"
  | "hours"
  | "minutes"
  | "seconds";

const normalizeUnit = (
  raw: string,
): { unit: DurationKey; multiplier: number } => {
  const u = raw.toLowerCase();
  if (/decades?/.test(u)) return { unit: "years", multiplier: 10 };
  if (/centur(y|ies)/.test(u)) return { unit: "years", multiplier: 100 };
  if (/quarters?/.test(u)) return { unit: "months", multiplier: 3 };
  if (/^days?$/.test(u)) return { unit: "days", multiplier: 1 };
  if (/^weeks?$/.test(u)) return { unit: "weeks", multiplier: 1 };
  if (/^months?$/.test(u)) return { unit: "months", multiplier: 1 };
  if (/^years?$/.test(u)) return { unit: "years", multiplier: 1 };
  if (/^hours?$/.test(u)) return { unit: "hours", multiplier: 1 };
  if (/^minutes?$/.test(u)) return { unit: "minutes", multiplier: 1 };
  if (/^seconds?$/.test(u)) return { unit: "seconds", multiplier: 1 };
  return { unit: "days", multiplier: 1 };
};

const UNIT_PATTERN =
  "milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|quarters?|years?|decades?|centur(?:y|ies)";

const DATE_BASE_RE = new RegExp(
  `^(today|tomorrow|yesterday|now)((?:\\s*[+-]\\s*\\d+\\s*(?:${UNIT_PATTERN}))+)?$`,
  "i",
);

const DATE_OP_RE = new RegExp(`([+-])\\s*(\\d+)\\s*(${UNIT_PATTERN})`, "gi");

const DATE_AGO_RE = new RegExp(`^(\\d+)\\s+(${UNIT_PATTERN})\\s+ago$`, "i");

const DATE_REL_RE = new RegExp(
  `^(\\d+)\\s+(${UNIT_PATTERN})((?:\\s*[+-]\\s*\\d+(?:\\s+(?:${UNIT_PATTERN}))?)+)$`,
  "i",
);

const DATE_REL_OP_RE = new RegExp(
  `([+-])\\s*(\\d+)(?:\\s+(${UNIT_PATTERN}))?`,
  "gi",
);

const EPOCH_MS_THRESHOLD = 1e12;

type UnitInfo = { unit: DurationKey; multiplier: number };

const applyOps = (
  date: Date,
  source: string,
  re: RegExp,
  defaultUnit?: UnitInfo,
): Date => {
  let result = date;
  for (const op of source.matchAll(re)) {
    const sign = op[1];
    const amount = parseInt(op[2]!, 10);
    const u = op[3] ? normalizeUnit(op[3]!) : defaultUnit;
    if (!u) continue;
    const duration = { [u.unit]: amount * u.multiplier };
    result = sign === "+" ? add(result, duration) : sub(result, duration);
  }
  return result;
};

const tryAgo = (trimmed: string): string | null => {
  const m = trimmed.match(DATE_AGO_RE);
  if (!m) return null;
  const amount = parseInt(m[1]!, 10);
  const { unit, multiplier } = normalizeUnit(m[2]!);
  return format(sub(new Date(), { [unit]: amount * multiplier }), "yyyy-MM-dd");
};

const tryRelative = (trimmed: string): string | null => {
  const m = trimmed.match(DATE_REL_RE);
  if (!m) return null;
  const baseAmount = parseInt(m[1]!, 10);
  const baseUnit = normalizeUnit(m[2]!);
  const seed = add(new Date(), {
    [baseUnit.unit]: baseAmount * baseUnit.multiplier,
  });
  return format(applyOps(seed, m[3]!, DATE_REL_OP_RE, baseUnit), "yyyy-MM-dd");
};

const tryAnchored = (trimmed: string): string | null => {
  if (!DATE_BASE_RE.test(trimmed)) return null;
  const baseMatch = trimmed.match(/^(today|tomorrow|yesterday|now)/i);
  if (!baseMatch) return null;
  const baseWord = baseMatch[1]!.toLowerCase();
  let seed = new Date();
  if (baseWord === "tomorrow") seed = add(seed, { days: 1 });
  else if (baseWord === "yesterday") seed = sub(seed, { days: 1 });
  return format(
    applyOps(seed, trimmed.slice(baseWord.length), DATE_OP_RE),
    "yyyy-MM-dd",
  );
};

const parseTimePart = (timePart: string): Date | null => {
  if (/^now$/i.test(timePart)) return new Date();
  const results = chronoParse(timePart);
  if (results.length === 0) return null;
  const result = results[0]!;
  const knownHour = (
    result.start as unknown as { knownValues: { hour?: number } }
  ).knownValues.hour;
  if (knownHour === undefined) return null;
  return result.start.date();
};

export const Dates = {
  valid: isValid,
  isoDate: (d: Date) => format(d, "yyyy-MM-dd"),
  time: (d: Date) => format(d, "HH:mm"),
  yearMonthDay: (d: Date) => format(d, "yyyy-MM-dd"),
  evaluateEpoch: (expr: string): string | null => {
    const match =
      expr.match(/^(?:epoch|unix|timestamp)\s+(\d+)$/i) ||
      expr.match(/^(\d+)\s+as\s+date$/i);
    if (!match) return null;
    const raw = Number(match[1]);
    if (!Number.isFinite(raw) || raw < 0) return null;
    const ms = raw > EPOCH_MS_THRESHOLD ? raw : raw * 1000;
    const date = new Date(ms);
    if (!isValid(date)) return null;
    return date
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, " UTC");
  },
  evaluateTimezone: (expr: string): string | null => {
    const match = expr.match(/^(.+?)\s+(?:in|to)\s+(.+)$/i);
    if (!match) return null;
    const timePart = match[1]!.trim();
    const targetIANA = resolveLocation(match[2]!.trim());
    if (!targetIANA) return null;
    try {
      const date = parseTimePart(timePart);
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
  evaluateDaysUntil: (expr: string): string | null => {
    const match = expr
      .trim()
      .match(
        /^(?:how\s+many\s+)?days?\s+(to|until|till|before|since|after)\s+(.+)$/i,
      );
    if (!match) return null;
    const direction = match[1]!.toLowerCase();
    const dateStr = match[2]!.trim();
    const parsed = chronoParse(dateStr);
    if (parsed.length === 0) return null;
    const result = parsed[0]!;
    let target = result.start.date();
    if (!isValid(target)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFuture = /to|until|till|before/.test(direction);
    if (isFuture && target < today && !result.start.isCertain("year")) {
      target = add(target, { years: 1 });
    }
    const diff = isFuture
      ? differenceInCalendarDays(target, today)
      : differenceInCalendarDays(today, target);
    return diff === 1 || diff === -1 ? `${diff} day` : `${diff} days`;
  },
  evaluateNatural: (expr: string): string | null =>
    Dates.evaluateDaysUntil(expr) ??
    Dates.evaluateDateArithmetic(expr) ??
    Dates.evaluateEpoch(expr) ??
    Dates.evaluateTimezone(expr),
  evaluateDateArithmetic: (expr: string): string | null => {
    const trimmed = expr.trim();
    return tryAgo(trimmed) ?? tryRelative(trimmed) ?? tryAnchored(trimmed);
  },
};

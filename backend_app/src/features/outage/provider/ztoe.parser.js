import * as cheerio from "cheerio";

const INTERVAL_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return clean(value)
    .toLocaleLowerCase("uk-UA")
    .replace(/[’']/g, "'")
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStreet(value) {
  return normalizeText(value)
    .replace(/^вулиця\s+/, "")
    .replace(/^вул\s+/, "")
    .replace(/^провулок\s+/, "")
    .replace(/^пров\s+/, "")
    .replace(/^проспект\s+/, "")
    .replace(/^просп\s+/, "")
    .replace(/^бульвар\s+/, "")
    .replace(/^бул\s+/, "")
    .replace(/^площа\s+/, "")
    .replace(/^пл\s+/, "")
    .trim();
}

function normalizeBuilding(value) {
  return normalizeText(value)
    .replace(/\bкорпус\b/g, "корп")
    .replace(/\bкорп\.?\b/g, "корп")
    .replace(/\s+/g, " ")
    .trim();
}

function buildingMatches(target, source) {
  const wanted = normalizeBuilding(target);
  if (!wanted) return false;

  const candidates = clean(source)
    .split(",")
    .map(normalizeBuilding);
  if (candidates.includes(wanted)) return true;

  // OSM may return a compound house number such as "14, к.1.2,3", while ZTOE stores the same
  // residential group as separate comma-delimited values ("14, корпус, 1, 14, корпус, 2...").
  // The base house number is enough to identify the feeder queue; prefer the household row below
  // when both household and legal-consumer rows exist.
  const baseNumber = wanted.match(/^\d+[а-яa-z]?(?:\/\d+)?/i)?.[0];
  if (baseNumber && candidates.includes(baseNumber)) return true;

  const compound = wanted.match(/^(\S+)\s+корп\s+(\S+)$/i);
  if (!compound) return false;

  const sourceText = normalizeBuilding(source).replace(/\s*,\s*/g, " ");
  const base = compound[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const corpWord = "(?:корп|корпус)";
  const number = compound[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${base}\\s+${corpWord}\\.?\\s+${number}(?:$|\\s)`, "i").test(sourceText);
}

function addressMatches(target, row) {
  const targetCity = normalizeText(target.city).replace(/^місто\s+/, "");
  const sourceCity = normalizeText(row.city).replace(/^місто\s+/, "");

  return (
    (!targetCity || !sourceCity || targetCity === sourceCity) &&
    normalizeStreet(target.street) === normalizeStreet(row.street) &&
    buildingMatches(target.building, row.buildings)
  );
}

function parseDate(value) {
  const match = clean(value).match(DATE_RE);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseSourceDate($) {
  let date = null;
  $("td, th").each((_, cell) => {
    if (date) return;
    date = parseDate($(cell).text());
  });
  return date;
}

function parseAddressRows($) {
  const rows = [];
  $("tr").each((_, row) => {
    const cells = $(row).children("td,th");
    if (cells.length !== 7) return;

    const values = cells.map((__, cell) => clean($(cell).text())).get();
    if (values[0] === "РЕМ" || !/^\d+$/.test(values[4]) || !/^\d+$/.test(values[5])) return;

    rows.push({
      rem: values[0],
      city: values[1],
      street: values[2],
      buildings: values[3],
      queueNumber: Number(values[4]),
      subqueue: Number(values[5]),
      note: values[6],
    });
  });
  return rows;
}

function statusFromStyle(style = "") {
  const normalized = style.toLocaleLowerCase("uk-UA");
  if (normalized.includes("#ff0000") || normalized.includes("red")) return "off";
  if (normalized.includes("#ffff00") || normalized.includes("yellow") || normalized.includes("orange")) {
    return "maybe";
  }
  return "on";
}

function parseScheduleRows($) {
  const intervals = [];
  let scheduleDate = null;
  const schedules = [];

  $("tr").each((_, row) => {
    const cells = $(row).children("td,th");
    const texts = cells.map((__, cell) => clean($(cell).text())).get();
    if (texts.length >= 2 && texts.some((text) => INTERVAL_RE.test(text))) {
      if (!intervals.length) {
        texts.forEach((text) => {
          if (INTERVAL_RE.test(text)) intervals.push(text);
        });
      }
      return;
    }

    const queueLabel = texts.find((text) => /^\d+\.\d+$/.test(text));
    if (!queueLabel || texts.length < intervals.length + 1 || !intervals.length) return;

    const queueCells = cells.toArray();
    const labelIndex = texts.indexOf(queueLabel);
    const slotCells = queueCells
      .slice(labelIndex + 1)
      .filter((cell) => $(cell).attr("style")?.toLocaleLowerCase().includes("background"))
      .slice(0, intervals.length);

    if (slotCells.length !== intervals.length) return;

    schedules.push({
      queueNumber: Number(queueLabel.split(".")[0]),
      subqueue: Number(queueLabel.split(".")[1]),
      slots: intervals.map((interval, index) => {
        const [from, to] = interval.split("-");
        return { from, to, status: statusFromStyle($(slotCells[index]).attr("style")) };
      }),
    });
  });

  $("td, th").each((_, cell) => {
    if (scheduleDate) return;
    const value = parseDate($(cell).text());
    if (value) scheduleDate = value;
  });

  const bodyText = $("body").text();
  const hasActiveCommand = !/команди\s+нек\s+укренерго[\s\S]*не\s+надходило/i.test(bodyText);

  return { date: scheduleDate, schedules, hasActiveCommand };
}

export function parseZtoePage(html, pageId) {
  const $ = cheerio.load(html, { decodeEntities: true });
  const schedule = parseScheduleRows($);
  const bodyDate = $("body").text().match(/\b\d{2}\.\d{2}\.\d{4}\b/)?.[0];
  return {
    pageId,
    date: schedule.date || parseSourceDate($) || parseDate(bodyDate),
    updatedAt: clean($("body").text().match(/Дата оновлення інформації\s*-\s*([^\n]+)/i)?.[1]),
    hasActiveCommand: schedule.hasActiveCommand,
    addresses: parseAddressRows($),
    schedules: schedule.schedules,
  };
}

export function findAddressInParsedPage(parsedPage, address) {
  const matches = parsedPage.addresses.filter((row) => addressMatches(address, row));
  // The source can contain both household and legal-consumer rows for one building. Prefer the
  // household row because the app is intended for residents.
  return matches.find((row) => /побутові/i.test(row.note) && !/непобутові/i.test(row.note)) || matches[0] || null;
}

export { addressMatches, normalizeBuilding, normalizeStreet, parseScheduleRows };

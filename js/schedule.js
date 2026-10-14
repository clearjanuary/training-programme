import { PROGRAMME_WEEKS, DAY_ORDER } from './programme.js';

const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

export const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Parses "YYYY-MM-DD" as a local date; rejects impossible dates like 2026-02-31.
export function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

// Whole days since the epoch, via UTC so daylight-saving shifts can't skew differences.
export const dayNumber = (date) =>
  Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);

export const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));

const MONDAY = 1;

// Blocks start on a Monday: today if it is one, otherwise next Monday.
export const defaultStartDate = (today) =>
  (today.getDay() === MONDAY ? addDays(today, 0) : addDays(mondayOf(today), 7));

export function programmePosition(date, startISO) {
  const start = parseISODate(startISO);
  if (!start) throw new Error('Invalid start date');
  const days = dayNumber(date) - dayNumber(start);
  if (days < 0) return { status: 'before', daysUntil: -days };
  const week = Math.floor(days / 7) + 1;
  if (week > PROGRAMME_WEEKS) return { status: 'complete' };
  return { status: 'active', week, weekday: date.getDay() };
}

export function dateForSession(startISO, week, weekday) {
  const start = parseISODate(startISO);
  if (!start) throw new Error('Invalid start date');
  return addDays(start, (week - 1) * 7 + DAY_ORDER.indexOf(weekday));
}

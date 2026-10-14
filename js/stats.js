import {
  PROGRAMME_WEEKS, DAY_ORDER, weekSessions, plannedKm, sessionKey,
} from './programme.js';
import { estimateOneRepMax, completedSets } from './progression.js';
import { dateForSession, dayNumber, parseISODate, programmePosition } from './schedule.js';

const WEEKS = Array.from({ length: PROGRAMME_WEEKS }, (_, i) => i + 1);
const RUN_KINDS = Object.freeze(['runEasy', 'runQuality', 'runLong']);

const allSets = (logs, exerciseId) =>
  Object.values(logs).flatMap((log) => completedSets(log?.sets?.[exerciseId]));

export const actualKm = (logs, week) =>
  RUN_KINDS.reduce((sum, kind) => sum + (Number(logs[sessionKey(week, kind)]?.run?.distanceKm) || 0), 0);

// Kilometres from extra (unplanned) runs dated within the given programme week.
export function extraRunKm(extras, startDate, week) {
  return extras
    .filter((extra) => extra.type === 'run')
    .filter((extra) => {
      const date = parseISODate(extra.date);
      const position = date && programmePosition(date, startDate);
      return position?.status === 'active' && position.week === week;
    })
    .reduce((sum, extra) => sum + (Number(extra.distanceKm) || 0), 0);
}

export const weeklyVolume = (logs, settings, extras = []) =>
  WEEKS.map((week) => ({
    week,
    planned: plannedKm(week, settings),
    actual: actualKm(logs, week) + extraRunKm(extras, settings.startDate, week),
  }));

const WEEKLY_OVERSHOOT = 1.2;
const RUN_OVERSHOOT_KM = 3;
const RUN_OVERSHOOT_RATIO = 1.25;
const oneDecimal = (km) => Math.round(km * 10) / 10;

// A week more than 20% over plan is the classic set-up for a running niggle.
export function volumeWarning({ planned, actual }, label) {
  if (!(planned > 0) || actual <= planned * WEEKLY_OVERSHOOT) return null;
  return `${label} you ran ${oneDecimal(actual)} km against ${planned} km planned. Keep the next few runs easy and pick the shorter club routes.`;
}

export function runOverage(distanceKm, plannedKm) {
  const over = distanceKm - plannedKm;
  if (over <= RUN_OVERSHOOT_KM || distanceKm <= plannedKm * RUN_OVERSHOOT_RATIO) return null;
  return `That's ${oneDecimal(over)} km more than planned. Fine now and then; keep your next two runs easy.`;
}

export function liftBests(logs, exerciseId) {
  return allSets(logs, exerciseId).reduce((best, set) => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps);
    const e1rm = estimateOneRepMax(weight, reps);
    return e1rm > (best?.e1rm ?? 0) ? { weight, reps, e1rm } : best;
  }, null);
}

export function bestReps(logs, exerciseId, { bodyweightOnly = false } = {}) {
  const reps = allSets(logs, exerciseId)
    .filter((set) => !bodyweightOnly || !(Number(set.weight) > 0))
    .map((set) => Number(set.reps));
  return reps.length ? Math.max(...reps) : null;
}

// Training sessions (not rest days) scheduled on or before `today`.
export function dueSessionKeys(settings, today) {
  const limit = dayNumber(today);
  return WEEKS.flatMap((week) => weekSessions(week, settings))
    .filter((session) => session.type !== 'rest')
    .filter((session) => dayNumber(dateForSession(settings.startDate, session.week, session.weekday)) <= limit)
    .map((session) => session.key);
}

// Sessions earlier in `week` (which must contain `today`) that haven't been logged:
// e.g. Friday's strength session still waiting on Saturday.
export function pendingSessions(logs, settings, week, today) {
  const todayIndex = DAY_ORDER.indexOf(today.getDay());
  return weekSessions(week, settings).filter((session) => session.type !== 'rest'
    && DAY_ORDER.indexOf(session.weekday) < todayIndex
    && !logs[session.key]?.done
    && !logs[session.key]?.skipped);
}

const BACKUP_INTERVAL_DAYS = 14;

export function backupDue(state, today) {
  if (!Object.keys(state.logs).length) return false;
  const last = parseISODate(state.settings.lastBackup);
  return !last || dayNumber(today) - dayNumber(last) >= BACKUP_INTERVAL_DAYS;
}

// Where an imported run most likely belongs: today's run, else the latest
// unlogged run earlier in the week, else the next unlogged one.
export function defaultRunSession(sessions, logs, today) {
  const runs = sessions.filter((session) => session.type === 'run');
  const todayRun = runs.find((session) => session.weekday === today.getDay());
  if (todayRun) return todayRun;
  const todayIndex = DAY_ORDER.indexOf(today.getDay());
  const open = runs.filter((session) => !logs[session.key]?.done);
  const earlier = open.filter((session) => DAY_ORDER.indexOf(session.weekday) < todayIndex);
  return earlier.at(-1) ?? open[0] ?? runs[0];
}

// Skipped sessions (illness, travel) are left out rather than counted as missed.
export function adherence(logs, dueKeys) {
  const skipped = dueKeys.filter((key) => logs[key]?.skipped).length;
  return {
    done: dueKeys.filter((key) => logs[key]?.done).length,
    due: dueKeys.length - skipped,
    skipped,
  };
}

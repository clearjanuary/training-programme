import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actualKm, weeklyVolume, liftBests, bestReps, dueSessionKeys, adherence, pendingSessions,
  backupDue, defaultRunSession, volumeWarning, runOverage, extraRunKm,
} from '../js/stats.js';
import { parseISODate } from '../js/schedule.js';
import { DEFAULT_LAYOUT, weekSessions } from '../js/programme.js';

const done = (weight, reps) => ({ weight, reps, done: true });
const settings = { startDate: '2026-10-12', layout: [...DEFAULT_LAYOUT], clubRuns: ['runEasy', 'runLong'] };

test('actualKm sums the logged runs for one week', () => {
  const logs = {
    'w1-runEasy': { run: { distanceKm: 5.2 } },
    'w1-runLong': { run: { distanceKm: 8 } },
    'w2-runEasy': { run: { distanceKm: 6 } },
  };
  assert.equal(actualKm(logs, 1), 13.2);
  assert.equal(actualKm(logs, 3), 0);
});

test('weeklyVolume lists all twelve weeks with planned and logged km', () => {
  const volume = weeklyVolume({ 'w1-runEasy': { run: { distanceKm: 5 } } }, settings);
  assert.equal(volume.length, 12);
  assert.deepEqual(volume[0], { week: 1, planned: 20, actual: 5 });
});

test('liftBests picks the ticked set with the highest estimated 1RM', () => {
  const logs = {
    'w1-gymA': { sets: { backSquat: [done(60, 8), done(70, 3), { weight: 100, reps: 5, done: false }] } },
  };
  const best = liftBests(logs, 'backSquat');
  assert.equal(best.weight, 70);
  assert.equal(best.reps, 3);
  assert.equal(Math.round(best.e1rm), 77);
});

test('liftBests returns null when there is no data', () => {
  assert.equal(liftBests({}, 'deadlift'), null);
});

test('bestReps can ignore weighted sets', () => {
  const logs = { 'w6-gymB': { sets: { dip: [done(null, 15), done(5, 18)] } } };
  assert.equal(bestReps(logs, 'dip'), 18);
  assert.equal(bestReps(logs, 'dip', { bodyweightOnly: true }), 15);
  assert.equal(bestReps({}, 'dip'), null);
});

test('dueSessionKeys lists training sessions up to and including today', () => {
  assert.deepEqual(dueSessionKeys(settings, parseISODate('2026-10-14')), ['w1-gymA', 'w1-gymB', 'w1-runQuality']);
  assert.deepEqual(dueSessionKeys(settings, parseISODate('2026-10-01')), []);
});

test('pendingSessions lists unlogged sessions from earlier this week', () => {
  const logs = { 'w1-gymA': { done: true } };
  const saturday = parseISODate('2026-10-17');
  const pending = pendingSessions(logs, settings, 1, saturday).map((s) => s.key);
  assert.deepEqual(pending, ['w1-gymB', 'w1-runQuality', 'w1-runEasy', 'w1-gymC']);
  assert.deepEqual(pendingSessions(logs, settings, 1, parseISODate('2026-10-12')), []);
});

test('backupDue asks after two weeks, or when never backed up, once there is data', () => {
  const today = parseISODate('2026-10-30');
  const empty = { settings: { lastBackup: null }, logs: {} };
  assert.equal(backupDue(empty, today), false);
  const logged = { ...empty, logs: { 'w1-gymA': { done: true } } };
  assert.equal(backupDue(logged, today), true);
  assert.equal(backupDue({ ...logged, settings: { lastBackup: '2026-10-20' } }, today), false);
  assert.equal(backupDue({ ...logged, settings: { lastBackup: '2026-10-16' } }, today), true);
});

test('defaultRunSession prefers today, then the latest unlogged earlier run', () => {
  const sessions = weekSessions(1, settings);
  assert.equal(defaultRunSession(sessions, {}, parseISODate('2026-10-15')).kind, 'runEasy');
  const saturday = parseISODate('2026-10-17');
  assert.equal(defaultRunSession(sessions, {}, saturday).kind, 'runEasy');
  assert.equal(defaultRunSession(sessions, { 'w1-runEasy': { done: true } }, saturday).kind, 'runQuality');
});

test('adherence counts finished sessions and leaves skipped ones out', () => {
  const logs = { 'w1-gymA': { done: true }, 'w1-gymB': { done: false }, 'w1-runQuality': { skipped: true } };
  assert.deepEqual(
    adherence(logs, ['w1-gymA', 'w1-gymB', 'w1-runQuality', 'w1-runEasy']),
    { done: 1, due: 3, skipped: 1 },
  );
});

test('pendingSessions leaves out skipped sessions', () => {
  const logs = { 'w1-gymA': { done: true }, 'w1-gymB': { skipped: true, skipReason: 'ill' } };
  const pending = pendingSessions(logs, settings, 1, parseISODate('2026-10-15')).map((s) => s.key);
  assert.deepEqual(pending, ['w1-runQuality']);
});

test('extra runs count towards the week they fall in', () => {
  const extras = [
    { id: 'a', date: '2026-10-13', type: 'run', distanceKm: 4, durationSec: 1500 },
    { id: 'b', date: '2026-10-14', type: 'erg', distanceKm: 5, durationSec: 1200 },
    { id: 'c', date: '2026-10-20', type: 'run', distanceKm: 6, durationSec: 2000 },
  ];
  assert.equal(extraRunKm(extras, settings.startDate, 1), 4);
  assert.equal(extraRunKm(extras, settings.startDate, 2), 6);
  const volume = weeklyVolume({ 'w1-runEasy': { run: { distanceKm: 5 } } }, settings, extras);
  assert.equal(volume[0].actual, 9);
  assert.equal(volume[1].actual, 6);
});

test('volumeWarning flags a week more than 20% over plan', () => {
  assert.equal(volumeWarning({ planned: 20, actual: 23 }, 'This week'), null);
  assert.match(volumeWarning({ planned: 20, actual: 26 }, 'Last week'), /^Last week you ran 26 km against 20 km/);
  assert.equal(volumeWarning({ planned: 0, actual: 5 }, 'This week'), null);
});

test('runOverage flags a single run well past its plan', () => {
  assert.equal(runOverage(10, 8), null);
  assert.equal(runOverage(21, 20), null);
  assert.match(runOverage(21, 10), /11 km more than planned/);
});

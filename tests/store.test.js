import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, withSettings, withLog, withoutLogs, validateState, validateExtra, withExtra, withoutExtra,
  validateBodyEntry, withBodyEntry, withoutBodyEntry,
  createRepository, memoryStorage, STORAGE_KEY,
} from '../js/store.js';

test('body entries replace the same date and stay sorted', () => {
  const base = createState({ startDate: '2026-10-12' });
  const one = withBodyEntry(base, { date: '2026-10-19', weightKg: 78.4, waistCm: null });
  const two = withBodyEntry(one, { date: '2026-10-12', weightKg: 79, waistCm: 90 });
  const replaced = withBodyEntry(two, { date: '2026-10-19', weightKg: 78.1, waistCm: 89 });
  assert.deepEqual(base.body, []);
  assert.deepEqual(replaced.body.map((e) => [e.date, e.weightKg]), [['2026-10-12', 79], ['2026-10-19', 78.1]]);
  assert.deepEqual(withoutBodyEntry(replaced, '2026-10-12').body.map((e) => e.date), ['2026-10-19']);
});

test('validateBodyEntry needs a date and a sensible weight or waist', () => {
  assert.equal(validateBodyEntry({ date: '2026-10-19', weightKg: 78, waistCm: null }), null);
  assert.equal(validateBodyEntry({ date: '2026-10-19', weightKg: null, waistCm: 88 }), null);
  assert.match(validateBodyEntry({ date: '2026-10-19', weightKg: null, waistCm: null }), /weight or waist/i);
  assert.match(validateBodyEntry({ date: '2026-10-19', weightKg: 900, waistCm: null }), /weight/i);
  assert.match(validateBodyEntry({ date: 'soon', weightKg: 78, waistCm: null }), /date/i);
});

test('validateState checks swaps and body entries, and fills them in for older saves', () => {
  const old = { version: 1, settings: { startDate: '2026-10-12', fiveK: '24:00' }, logs: {} };
  const state = validateState(old);
  assert.deepEqual(state.settings.swaps, {});
  assert.deepEqual(state.body, []);
  const good = createState({ startDate: '2026-10-12', swaps: { backSquat: 'gobletSquat' } });
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(good))).settings.swaps, { backSquat: 'gobletSquat' });
  assert.throws(() => validateState({ ...good, settings: { ...good.settings, swaps: { backSquat: 'deadlift' } } }), /swap/i);
  assert.throws(() => validateState({ ...good, body: [{ date: 'x', weightKg: 1 }] }), /body/i);
});

const extra = (patch = {}) => ({
  id: 'x1', date: '2026-10-14', type: 'run', distanceKm: 4.2, durationSec: 1500, avgHr: null, notes: '', ...patch,
});

test('extras can be added and removed without touching the original', () => {
  const original = createState({ startDate: '2026-10-12' });
  const added = withExtra(original, extra());
  assert.deepEqual(original.extras, []);
  assert.equal(added.extras.length, 1);
  assert.deepEqual(withoutExtra(added, 'x1').extras, []);
  assert.deepEqual(withoutLogs(added).extras, []);
});

test('validateExtra accepts good entries and explains bad ones', () => {
  assert.equal(validateExtra(extra()), null);
  assert.equal(validateExtra(extra({ type: 'erg', distanceKm: null })), null);
  assert.match(validateExtra(extra({ distanceKm: null })), /distance/i);
  assert.match(validateExtra(extra({ type: 'yoga' })), /type/i);
  assert.match(validateExtra(extra({ durationSec: 0 })), /time/i);
  assert.match(validateExtra(extra({ date: '14/10' })), /date/i);
  assert.match(validateExtra(extra({ avgHr: 400 })), /heart rate/i);
});

test('validateState keeps extras and fills them in for older saves', () => {
  const state = withExtra(createState({ startDate: '2026-10-12' }), extra());
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))).extras, state.extras);
  const old = { version: 1, settings: { startDate: '2026-10-12', fiveK: '24:00' }, logs: {} };
  assert.deepEqual(validateState(old).extras, []);
  assert.throws(() => validateState({ ...state, extras: [extra({ type: 'yoga' })] }), /extra activity/i);
});
import { DEFAULT_LAYOUT } from '../js/programme.js';

const silent = { error: () => {} };

test('updates return new objects and leave the original untouched', () => {
  const original = createState({ startDate: '2026-10-12' });
  const changed = withLog(withSettings(original, { fiveK: '23:30' }), 'w1-gymA', { done: true });
  assert.equal(original.settings.fiveK, '24:00');
  assert.deepEqual(original.logs, {});
  assert.equal(changed.settings.fiveK, '23:30');
  assert.equal(changed.logs['w1-gymA'].done, true);
  assert.deepEqual(withoutLogs(changed).logs, {});
});

test('new state starts with the run club layout', () => {
  const { settings } = createState();
  assert.deepEqual(settings.layout, [...DEFAULT_LAYOUT]);
  assert.deepEqual(settings.clubRuns, ['runEasy', 'runLong']);
});

test('validateState accepts a round-tripped state', () => {
  const state = withLog(createState({ startDate: '2026-10-12' }), 'w2-runLong', { done: true });
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
});

test('validateState fills in a layout for older saves', () => {
  const old = { version: 1, settings: { startDate: '2026-10-12', fiveK: '24:00' }, logs: {} };
  const state = validateState(old);
  assert.deepEqual(state.settings.layout, [...DEFAULT_LAYOUT]);
  assert.deepEqual(state.settings.clubRuns, ['runEasy', 'runLong']);
});

test('validateState moves weekday-keyed logs onto session keys', () => {
  const old = {
    version: 1,
    settings: { startDate: '2026-10-12', fiveK: '24:00' },
    logs: { 'w1-d1': { done: true }, 'w2-d0': { done: true }, 'w1-d6': { done: false } },
  };
  assert.deepEqual(Object.keys(validateState(old).logs).sort(), ['w1-gymA', 'w2-runLong']);
});

test('validateState rejects bad backups with a clear message', () => {
  const good = createState({ startDate: '2026-10-12' });
  const settings = (patch) => ({ ...good, settings: { ...good.settings, ...patch } });
  assert.throws(() => validateState(null), /backup/i);
  assert.throws(() => validateState(settings({ startDate: '12/10/26' })), /start date/i);
  assert.throws(() => validateState(settings({ fiveK: 'fast' })), /5 km/i);
  assert.throws(() => validateState(settings({ layout: ['rest'] })), /seven/i);
  assert.throws(() => validateState(settings({ clubRuns: ['gymA'] })), /run club/i);
  assert.throws(() => validateState(settings({ lastBackup: 'yesterday' })), /backup date/i);
  assert.throws(() => validateState({ ...good, logs: { tuesday: {} } }), /session/i);
  assert.throws(() => validateState({ ...good, logs: { 'w1-gymA': 'done' } }), /session/i);
});

test('repository saves and loads state', () => {
  const repo = createRepository(memoryStorage(), silent);
  const state = createState({ startDate: '2026-10-12' });
  assert.equal(repo.save(state), true);
  assert.deepEqual(repo.load(), { state, error: null });
});

test('repository returns an empty result when nothing is saved', () => {
  assert.deepEqual(createRepository(memoryStorage(), silent).load(), { state: null, error: null });
});

test('repository keeps a copy of corrupt data instead of discarding it', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{oops');
  const result = createRepository(storage, silent).load();
  assert.equal(result.state, null);
  assert.ok(result.error);
  assert.equal(storage.getItem(`${STORAGE_KEY}/corrupt`), '{oops');
});

test('repository reports save failures', () => {
  const full = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.equal(createRepository(full, silent).save(createState()), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, withSettings, withLog, withoutLogs, validateState,
  createRepository, memoryStorage, STORAGE_KEY,
} from '../js/store.js';
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

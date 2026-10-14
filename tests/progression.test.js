import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findLastPerformance, findRecentPerformances, suggestLoad, estimateOneRepMax, roundToHalf,
  warmUpSets, adaptLadder,
} from '../js/progression.js';

const item = { weighted: true, sets: 3, reps: [6, 8] };
const sets = (...pairs) => pairs.map(([weight, reps]) => ({ weight, reps, done: true }));

test('with no history it asks for a starting weight', () => {
  const result = suggestLoad({ item, increment: 2.5, last: null });
  assert.equal(result.weight, null);
  assert.match(result.reason, /first/i);
});

test('adds the increment when every set hits the top of the range', () => {
  const last = { sets: sets([40, 8], [40, 8], [40, 8]) };
  assert.equal(suggestLoad({ item, increment: 2.5, last }).weight, 42.5);
});

test('repeats the weight when a set falls below the range', () => {
  const last = { sets: sets([40, 7], [40, 6], [40, 5]) };
  const result = suggestLoad({ item, increment: 2.5, last });
  assert.equal(result.weight, 40);
  assert.match(result.reason, /short/);
});

test('repeats the weight and asks for another rep when inside the range', () => {
  const last = { sets: sets([40, 8], [40, 7], [40, 7]) };
  const result = suggestLoad({ item, increment: 2.5, last });
  assert.equal(result.weight, 40);
  assert.match(result.reason, /one more rep/);
});

test('needs every planned set completed before progressing', () => {
  const last = { sets: sets([40, 8], [40, 8]) };
  assert.equal(suggestLoad({ item, increment: 2.5, last }).weight, 40);
});

test('deload keeps the last working weight', () => {
  const last = { sets: sets([40, 8], [40, 8], [40, 8]) };
  const result = suggestLoad({ item, increment: 2.5, last, deload: true });
  assert.equal(result.weight, 40);
  assert.match(result.reason, /deload/i);
});

test('bodyweight items get no suggestion', () => {
  assert.equal(suggestLoad({ item: { ...item, weighted: false }, increment: 0, last: null }), null);
});

test('weighted dips start at their start weight after bodyweight work', () => {
  const dips = { weighted: true, sets: 3, reps: [8, 10], startWeight: 5 };
  const last = { sets: sets([0, 15], [0, 15], [0, 15]) };
  assert.equal(suggestLoad({ item: dips, increment: 2.5, last }).weight, 5);
});

test('optional-load exercises start at bodyweight', () => {
  const calves = { weighted: true, optionalLoad: true, sets: 3, reps: [10, 15] };
  const result = suggestLoad({ item: calves, increment: 2, last: null });
  assert.equal(result.weight, null);
  assert.match(result.reason, /bodyweight/i);
});

test('findLastPerformance skips deload weeks, the current week and unticked sets', () => {
  const logs = {
    'w3-gymA': { sets: { backSquat: sets([60, 8], [60, 8], [60, 7]) } },
    'w4-gymA': { sets: { backSquat: sets([60, 6]) } },
    'w5-gymA': { sets: { backSquat: [{ weight: 62.5, reps: 8, done: false }] } },
    'w6-gymA': { sets: { backSquat: sets([65, 8]) } },
  };
  const last = findLastPerformance(logs, 'backSquat', 6);
  assert.equal(last.week, 3);
  assert.equal(last.sets.length, 3);
});

test('findLastPerformance picks the most recent earlier week', () => {
  const logs = {
    'w1-gymA': { sets: { pullUp: sets([0, 3]) } },
    'w2-gymA': { sets: { pullUp: sets([0, 4]) } },
  };
  assert.equal(findLastPerformance(logs, 'pullUp', 3).week, 2);
  assert.equal(findLastPerformance(logs, 'pullUp', 2).week, 1);
});

test('findLastPerformance returns null with no history', () => {
  assert.equal(findLastPerformance({}, 'deadlift', 2), null);
});

test('a first barbell session explains how to find a working weight', () => {
  const result = suggestLoad({ item: { ...item, barbell: true }, increment: 2.5, last: null });
  assert.equal(result.weight, null);
  assert.match(result.reason, /empty bar/i);
});

test('two stalled sessions at the same weight drop the load by about 10%', () => {
  const last = { sets: sets([60, 5], [60, 5], [60, 4]) };
  const previous = { sets: sets([60, 6], [60, 5], [60, 5]) };
  const result = suggestLoad({ item, increment: 2.5, last, previous });
  assert.equal(result.weight, 55);
  assert.match(result.reason, /drop/i);
});

test('dumbbell work stops at the heaviest pair and suggests other ways to progress', () => {
  const dumbbells = { weighted: true, sets: 3, reps: [8, 12], maxLoad: 25 };
  const last = { sets: sets([25, 12], [25, 12], [25, 12]) };
  const result = suggestLoad({ item: dumbbells, increment: 2.5, last });
  assert.equal(result.weight, 25);
  assert.match(result.reason, /heaviest/i);
  const below = { sets: sets([22.5, 12], [22.5, 12], [22.5, 12]) };
  assert.equal(suggestLoad({ item: dumbbells, increment: 2.5, last: below }).weight, 25);
});

test('one bad session is not a stall', () => {
  const last = { sets: sets([60, 5], [60, 5], [60, 4]) };
  const previous = { sets: sets([57.5, 8], [57.5, 8], [57.5, 8]) };
  assert.equal(suggestLoad({ item, increment: 2.5, last, previous }).weight, 60);
});

test('findRecentPerformances returns the latest non-deload weeks, newest first', () => {
  const logs = {
    'w1-gymA': { sets: { backSquat: sets([50, 8]) } },
    'w2-gymA': { sets: { backSquat: sets([52.5, 8]) } },
    'w3-gymA': { sets: { backSquat: sets([55, 8]) } },
  };
  assert.deepEqual(findRecentPerformances(logs, 'backSquat', 4, 2).map((p) => p.week), [3, 2]);
});

test('warmUpSets ramps from the empty bar to the working weight', () => {
  assert.deepEqual(warmUpSets(60), [
    { weight: 20, reps: 8 }, { weight: 30, reps: 5 }, { weight: 42.5, reps: 3 }, { weight: 50, reps: 1 },
  ]);
  assert.deepEqual(warmUpSets(40), [{ weight: 20, reps: 8 }, { weight: 27.5, reps: 3 }, { weight: 35, reps: 1 }]);
  assert.deepEqual(warmUpSets(25), []);
  assert.deepEqual(warmUpSets(null), []);
});

test('a missed ladder repeats last week instead of advancing', () => {
  const current = { exercise: 'pullUp', plan: 'pullUp', sets: 5, reps: [4, 4], weighted: false };
  const previous = { exercise: 'pullUp', plan: 'pullUp', sets: 6, reps: [3, 3], weighted: false };
  const missed = { week: 2, sets: sets([0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [0, 2]) };
  const { item: adapted, note } = adaptLadder(current, previous, missed);
  assert.equal(adapted.sets, 6);
  assert.deepEqual(adapted.reps, [3, 3]);
  assert.match(note, /repeat/i);
  const hit = { week: 2, sets: sets(...Array(6).fill([0, 3])) };
  assert.equal(adaptLadder(current, previous, hit).item, current);
  assert.equal(adaptLadder(current, null, null).item, current);
});

test('estimateOneRepMax uses the Epley formula', () => {
  assert.equal(estimateOneRepMax(100, 5), 100 * (1 + 5 / 30));
  assert.equal(estimateOneRepMax(0, 5), 0);
});

test('roundToHalf rounds to the nearest 0.5 kg', () => {
  assert.equal(roundToHalf(42.26), 42.5);
  assert.equal(roundToHalf(42.2), 42);
});

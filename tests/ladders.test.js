import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LADDERS, levelIndex, ladderLevelUps } from '../js/ladders.js';
import { EXERCISES } from '../js/programme.js';

test('every ladder level is a known exercise with a valid target', () => {
  for (const [id, ladder] of Object.entries(LADDERS)) {
    assert.ok(ladder.start >= 0 && ladder.start < ladder.levels.length, `${id} start`);
    for (const level of ladder.levels) {
      assert.ok(EXERCISES[level.exercise], `${id} → ${level.exercise}`);
      assert.ok(level.reps[0] > 0 && level.reps[0] <= level.reps[1], `${id} ${level.exercise} reps`);
    }
  }
});

test('the four skill goals each have a ladder', () => {
  for (const skill of ['planche', 'frontLever', 'muscleUp', 'lSit']) assert.ok(LADDERS[skill], skill);
});

test('levelIndex uses the saved level, falls back to the start, and stays in range', () => {
  assert.equal(levelIndex('push', {}), LADDERS.push.start);
  assert.equal(levelIndex('push', { push: 3 }), 3);
  assert.equal(levelIndex('push', { push: 99 }), LADDERS.push.levels.length - 1);
});

const item = (patch) => ({
  ladder: 'planche', exercise: 'plancheLean', sets: 3, reps: [15, 30], level: 0, levelCount: 5, nextExercise: 'frogStand', ...patch,
});
const done = (...reps) => reps.map((r) => ({ reps: r, done: true }));

test('ladderLevelUps moves up a level when every set reaches the top of the range', () => {
  const log = { sets: { plancheLean: done(30, 30, 32) } };
  assert.deepEqual(ladderLevelUps([item()], log, {}), { levels: { planche: 1 }, promoted: ['frogStand'] });
});

test('ladderLevelUps stays put when a set falls short, sets are missing, or it is the top level', () => {
  assert.deepEqual(ladderLevelUps([item()], { sets: { plancheLean: done(30, 30, 25) } }, {}).promoted, []);
  assert.deepEqual(ladderLevelUps([item()], { sets: { plancheLean: done(30, 30) } }, {}).promoted, []);
  assert.deepEqual(ladderLevelUps([item({ nextExercise: null })], { sets: { plancheLean: done(30, 30, 30) } }, {}).promoted, []);
  assert.deepEqual(ladderLevelUps([{ exercise: 'pullUp', sets: 3, reps: [3, 3] }], { sets: { pullUp: done(3, 3, 3) } }, {}).promoted, []);
});

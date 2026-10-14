import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSession, sessionOnDay, sessionFromKey, weekSessions, plannedKm, parseSessionKey, sessionKey,
  weekPhase, validateLayout, layoutWarnings, EXERCISES, PROGRAMME_WEEKS, DEFAULT_LAYOUT,
} from '../js/programme.js';

const weeks = Array.from({ length: PROGRAMME_WEEKS }, (_, i) => i + 1);
// Index = Date#getDay(): Sun, Mon … Sat.
const CLASSIC = { layout: ['runLong', 'gymA', 'runEasy', 'gymB', 'runQuality', 'gymC', 'rest'], clubRuns: [] };
const findItem = (session, exercise) => session.items.find((item) => item.exercise === exercise);

test('the default week is strength Mon/Tue/Fri, intervals Wed, club easy Thu, club long Sun', () => {
  const days = weekSessions(1).map((s) => [s.weekday, s.kind, Boolean(s.club)]);
  assert.deepEqual(days, [
    [1, 'gymA', false], [2, 'gymB', false], [3, 'runQuality', false], [4, 'runEasy', true],
    [5, 'gymC', false], [6, 'rest', false], [0, 'runLong', true],
  ]);
});

test('a run club easy run uses the 5 km route, then 10 km in weeks 9–11', () => {
  const routes = weeks.map((week) => getSession(week, 'runEasy', { club: true }).plannedKm);
  assert.deepEqual(routes, [5, 5, 5, 5, 5, 5, 5, 5, 10, 10, 10, 5]);
  const easy = getSession(9, 'runEasy', { club: true });
  assert.match(easy.title, /run club/i);
  assert.equal(easy.steps[0].zone, 'easy');
  assert.match(easy.steps[0].detail, /10 km/);
});

test('every week has three gym sessions, three runs and one rest day in any valid layout', () => {
  for (const settings of [undefined, CLASSIC]) {
    for (const week of weeks) {
      const types = weekSessions(week, settings).map((s) => s.type);
      assert.equal(types.filter((t) => t === 'gym').length, 3, `week ${week} gym`);
      assert.equal(types.filter((t) => t === 'run').length, 3, `week ${week} run`);
      assert.equal(types.filter((t) => t === 'rest').length, 1, `week ${week} rest`);
    }
  }
});

test('every gym item references a known exercise and has a valid target', () => {
  for (const week of weeks) {
    for (const kind of ['gymA', 'gymB', 'gymC']) {
      for (const item of getSession(week, kind).items) {
        assert.ok(EXERCISES[item.exercise], `unknown exercise ${item.exercise}`);
        if (item.test) continue;
        assert.ok(item.sets >= 1, `${item.exercise} sets in week ${week}`);
        assert.ok(item.reps[0] <= item.reps[1], `${item.exercise} reps in week ${week}`);
      }
    }
  }
});

test('deload weeks cut barbell sets and raise reps in reserve', () => {
  const normal = findItem(getSession(3, 'gymA'), 'backSquat');
  const deload = findItem(getSession(4, 'gymA'), 'backSquat');
  assert.equal(normal.sets, 3);
  assert.equal(deload.sets, 2);
  assert.equal(deload.rir, 4);
});

test('pull-ups follow the weekly plan and are tested in week 12', () => {
  const first = findItem(getSession(1, 'gymA'), 'pullUp');
  assert.equal(first.sets, 5);
  assert.deepEqual(first.reps, [3, 3]);
  const final = findItem(getSession(12, 'gymA'), 'pullUp');
  assert.equal(final.test, true);
  assert.equal(final.sets, 1);
});

test('dips switch from bodyweight to weighted in week 7', () => {
  const week6 = findItem(getSession(6, 'gymB'), 'dip');
  assert.equal(week6.weighted, false);
  assert.deepEqual(week6.reps, [15, 15]);
  const week7 = findItem(getSession(7, 'gymB'), 'dip');
  assert.equal(week7.weighted, true);
  assert.equal(week7.startWeight, 5);
});

test('solo running volume builds gradually with lighter deload weeks', () => {
  const km = weeks.map((week) => plannedKm(week, CLASSIC));
  assert.equal(km[0], 20);
  assert.ok(km[3] < km[2], 'week 4 deload');
  assert.ok(km[7] < km[6], 'week 8 deload');
  assert.equal(Math.max(...km), 33);
});

test('default (run club) volume builds the same way', () => {
  const km = weeks.map((week) => plannedKm(week));
  assert.deepEqual(km, [20, 21, 23, 17, 24, 25, 26, 20, 32, 34, 36, 23]);
});

test('a run club quality session wraps effort guidance around the club 5 km', () => {
  const tempo = getSession(2, 'runQuality', { club: true });
  assert.match(tempo.title, /run club/i);
  assert.equal(tempo.plannedKm, 8);
  const clubStep = tempo.steps.find((s) => s.label === 'Run club');
  assert.equal(clubStep.zone, 'threshold');
  const deload = getSession(4, 'runQuality', { club: true });
  assert.equal(deload.plannedKm, 5);
  const trial = getSession(12, 'runQuality', { club: true });
  assert.equal(trial.test, true);
  assert.match(trial.title, /time trial/i);
});

test('a run club long run targets the planned distance', () => {
  const long = getSession(5, 'runLong', { club: true });
  assert.equal(long.plannedKm, 11);
  assert.match(long.steps[0].detail, /11 km/);
  assert.match(long.title, /run club/i);
});

test('the solo week 12 quality session is a 5 km time trial', () => {
  const trial = sessionOnDay(12, 4, CLASSIC);
  assert.equal(trial.test, true);
  assert.match(trial.title, /time trial/i);
});

test('sessions follow the layout, and keys stay the same when a session moves', () => {
  const saturdayC = { layout: ['runLong', 'gymA', 'gymB', 'runEasy', 'runQuality', 'rest', 'gymC'], clubRuns: [] };
  const session = sessionOnDay(1, 6, saturdayC);
  assert.equal(session.kind, 'gymC');
  assert.equal(session.key, 'w1-gymC');
  assert.equal(sessionFromKey('w1-gymC', saturdayC).weekday, 6);
  assert.equal(sessionFromKey('w1-gymC').weekday, 5);
  assert.equal(sessionFromKey('w13-gymC'), null);
  assert.equal(sessionOnDay(1, 5, saturdayC).type, 'rest');
});

test('validateLayout requires seven days with every session exactly once', () => {
  assert.equal(validateLayout(DEFAULT_LAYOUT), null);
  assert.match(validateLayout(['rest', 'gymA', 'gymA', 'runEasy', 'runQuality', 'gymC', 'runLong']), /Strength B/);
  assert.match(validateLayout(['rest']), /seven/i);
  assert.match(validateLayout(['yoga', 'gymA', 'gymB', 'runEasy', 'runQuality', 'gymC', 'runLong']), /unknown/i);
});

test('layoutWarnings flags heavy legs right before the long run or quality run', () => {
  assert.deepEqual(layoutWarnings(DEFAULT_LAYOUT), []);
  const saturdayC = ['runLong', 'gymA', 'gymB', 'runEasy', 'runQuality', 'rest', 'gymC'];
  assert.match(layoutWarnings(saturdayC)[0], /Strength C.*long run/);
  const squatBeforeQuality = ['runLong', 'gymB', 'runEasy', 'gymA', 'runQuality', 'gymC', 'rest'];
  assert.match(layoutWarnings(squatBeforeQuality)[0], /Strength A.*quality run/);
});

test('session keys round-trip and reject bad input', () => {
  assert.equal(sessionKey(3, 'gymB'), 'w3-gymB');
  assert.deepEqual(parseSessionKey('w3-gymB'), { week: 3, kind: 'gymB' });
  assert.equal(parseSessionKey('w3-d2'), null);
  assert.equal(parseSessionKey('w3-rest'), null);
  assert.equal(parseSessionKey('banana'), null);
});

test('getSession rejects weeks and sessions outside the programme', () => {
  assert.throws(() => getSession(13, 'gymA'), RangeError);
  assert.throws(() => getSession(0, 'gymA'), RangeError);
  assert.throws(() => getSession(1, 'yoga'), RangeError);
  assert.throws(() => sessionOnDay(1, 7), RangeError);
});

test('sessions open with power work, include Nordics, and end with mobility', () => {
  assert.equal(getSession(1, 'gymA').items[0].exercise, 'broadJump');
  assert.equal(getSession(1, 'gymB').items[0].exercise, 'pogoHops');
  assert.ok(getSession(1, 'gymC').items.some((i) => i.exercise === 'nordicCurl'));
  assert.match(getSession(1, 'gymA').coolDown, /couch stretch/i);
});

test('weight steps match the garage: 2.5 kg dumbbells up to 25 kg, small barbell jumps for presses', () => {
  for (const [id, exercise] of Object.entries(EXERCISES)) {
    if (exercise.maxLoad) {
      assert.equal(exercise.increment, 2.5, `${id} dumbbell step`);
      assert.equal(exercise.maxLoad, 25, `${id} heaviest dumbbell`);
    }
  }
  assert.equal(EXERCISES.overheadPress.increment, 1);
  assert.equal(EXERCISES.benchPress.increment, 2);
  assert.equal(EXERCISES.backSquat.increment, 2.5);
  assert.equal(getSession(1, 'gymA').items.find((i) => i.exercise === 'inclineDbPress').maxLoad, 25);
});

test('every alternative is a known exercise', () => {
  for (const [id, exercise] of Object.entries(EXERCISES)) {
    for (const alt of exercise.alternatives ?? []) assert.ok(EXERCISES[alt], `${id} → ${alt}`);
  }
});

test('swaps replace an exercise but keep its slot and targets', () => {
  const settings = { swaps: { backSquat: 'gobletSquat', pullUp: 'chinUp' } };
  const session = sessionOnDay(1, 1, settings);
  const squat = session.items.find((i) => i.slot === 'backSquat');
  assert.equal(squat.exercise, 'gobletSquat');
  assert.equal(squat.barbell, false);
  assert.equal(squat.weighted, true);
  assert.deepEqual(squat.reps, [6, 8]);
  const ladder = session.items.find((i) => i.slot === 'pullUp');
  assert.equal(ladder.exercise, 'chinUp');
  assert.deepEqual(ladder.reps, [3, 3]);
  assert.equal(sessionFromKey('w1-gymA', settings).items[1].exercise, 'gobletSquat');
});

test('swaps to an exercise that is not an alternative are ignored', () => {
  const squat = sessionOnDay(1, 1, { swaps: { backSquat: 'deadlift' } }).items.find((i) => i.slot === 'backSquat');
  assert.equal(squat.exercise, 'backSquat');
});

test('weekPhase labels build, deload and test weeks', () => {
  assert.equal(weekPhase(1), 'Build');
  assert.equal(weekPhase(4), 'Deload');
  assert.equal(weekPhase(12), 'Test week');
});

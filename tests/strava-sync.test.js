import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRun, planStravaImports, applyStravaImports } from '../js/strava-sync.js';
import { createState, withLog } from '../js/store.js';

const state = createState({ startDate: '2026-10-12' });
const activity = (patch = {}) => ({
  id: 101, name: 'Evening run', sport_type: 'Run', start_date_local: '2026-10-15T18:30:00Z',
  distance: 5120, moving_time: 1700, average_heartrate: 141.6, ...patch,
});

test('toRun keeps the local date and converts units', () => {
  assert.deepEqual(toRun(activity()), {
    stravaId: '101', name: 'Evening run', date: '2026-10-15', distanceKm: 5.12, durationSec: 1700, avgHr: 142,
  });
  assert.equal(toRun(activity({ average_heartrate: undefined })).avgHr, null);
});

test('runs match the session planned for that day', () => {
  const plans = planStravaImports([activity()], state);
  assert.deepEqual(plans.map((p) => [p.run.stravaId, p.key]), [['101', 'w1-runEasy']]);
});

test('a run the day after an unlogged session is matched to it (a late session)', () => {
  const plans = planStravaImports([activity({ start_date_local: '2026-10-16T07:00:00Z' })], state);
  assert.equal(plans[0].key, 'w1-runEasy');
});

test('runs with no open session that day or the day before become extra runs; non-runs and repeats are ignored', () => {
  const logged = withLog(
    withLog(state, 'w1-runEasy', { done: true, run: { distanceKm: 5, stravaId: '101' } }),
    'w1-runQuality', { done: true, run: { distanceKm: 7 } },
  );
  const plans = planStravaImports([
    activity(),
    activity({ id: 102, start_date_local: '2026-10-15T07:00:00Z' }),
    activity({ id: 103, sport_type: 'Ride' }),
    activity({ id: 104, start_date_local: '2026-09-01T07:00:00Z' }),
  ], logged);
  assert.deepEqual(plans.map((p) => [p.run.stravaId, p.key]), [['102', null]]);
});

test('two runs never claim the same session', () => {
  const plans = planStravaImports([
    activity({ id: 201, start_date_local: '2026-10-14T07:00:00Z' }),
    activity({ id: 202, start_date_local: '2026-10-14T18:00:00Z' }),
  ], state);
  assert.deepEqual(plans.map((p) => p.key), ['w1-runQuality', null]);
});

test('applyStravaImports logs sessions and extras without touching the original state', () => {
  const plans = planStravaImports([
    activity(),
    activity({ id: 301, start_date_local: '2026-10-13T07:00:00Z', name: 'Lunch jog' }),
  ], state);
  const next = applyStravaImports(state, plans);
  assert.deepEqual(state.logs, {});
  assert.equal(next.logs['w1-runEasy'].done, true);
  assert.equal(next.logs['w1-runEasy'].run.stravaId, '101');
  assert.equal(next.logs['w1-runEasy'].run.source, 'Strava');
  assert.equal(next.extras.length, 1);
  assert.equal(next.extras[0].stravaId, '301');
  assert.equal(next.extras[0].notes, 'Lunch jog');
});

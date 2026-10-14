import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, summarisePoints, parseRunLink } from '../js/import.js';

test('parseRunLink reads the values sent by an Apple Shortcut', () => {
  assert.deepEqual(parseRunLink('km=5.02&sec=1500&hr=148&src=Garmin'), {
    distanceKm: 5.02, durationSec: 1500, avgHr: 148, source: 'Garmin',
  });
  assert.deepEqual(parseRunLink('m=10000&min=55.5'), {
    distanceKm: 10, durationSec: 3330, avgHr: null, source: 'Apple Health',
  });
  assert.equal(parseRunLink('km=5,5&sec=1800').distanceKm, 5.5);
});

test('parseRunLink rejects missing or impossible values', () => {
  assert.throws(() => parseRunLink('sec=1500'), /distance/i);
  assert.throws(() => parseRunLink('km=5'), /time/i);
  assert.throws(() => parseRunLink('km=500&sec=100'), /distance/i);
  assert.equal(parseRunLink('km=5&sec=1500&hr=999').avgHr, null);
});

test('haversineKm measures one degree of latitude as about 111 km', () => {
  const km = haversineKm({ lat: 51, lon: 0 }, { lat: 52, lon: 0 });
  assert.ok(Math.abs(km - 111.2) < 0.1, `got ${km}`);
});

test('summarisePoints totals distance, duration and average heart rate', () => {
  const start = Date.parse('2026-10-11T08:00:00Z');
  const points = [
    { lat: 51.0, lon: 0, time: start, hr: 140 },
    { lat: 51.009, lon: 0, time: start + 300_000, hr: 150 },
    { lat: 51.018, lon: 0, time: start + 600_000, hr: 160 },
  ];
  const summary = summarisePoints(points);
  assert.ok(Math.abs(summary.distanceKm - 2.0) < 0.01, `got ${summary.distanceKm}`);
  assert.equal(summary.durationSec, 600);
  assert.equal(summary.avgHr, 150);
});

test('summarisePoints ignores missing heart rate and needs at least two points', () => {
  const start = Date.parse('2026-10-11T08:00:00Z');
  const summary = summarisePoints([
    { lat: 51, lon: 0, time: start, hr: null },
    { lat: 51.009, lon: 0, time: start + 300_000, hr: null },
  ]);
  assert.equal(summary.avgHr, null);
  assert.throws(() => summarisePoints([{ lat: 51, lon: 0, time: start }]), /not enough/i);
});

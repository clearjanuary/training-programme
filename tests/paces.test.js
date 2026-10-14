import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDuration, formatDuration, zonePaces, describeZone, paceOf, fiveKFromParts,
} from '../js/paces.js';

test('fiveKFromParts builds a padded time and rejects out-of-range input', () => {
  assert.equal(fiveKFromParts('24', '5'), '24:05');
  assert.equal(fiveKFromParts('23', ''), '23:00');
  assert.equal(fiveKFromParts('', '30'), null);
  assert.equal(fiveKFromParts('90', '0'), null);
  assert.equal(fiveKFromParts('24', '60'), null);
  assert.equal(fiveKFromParts('24.5', '0'), null);
});

test('parseDuration reads mm:ss and h:mm:ss', () => {
  assert.equal(parseDuration('24:00'), 1440);
  assert.equal(parseDuration('1:55:30'), 6930);
  assert.equal(parseDuration(' 55:07 '), 3307);
});

test('parseDuration rejects malformed input', () => {
  for (const bad of ['', '24', '24:60', '1:60:00', 'ab:cd', '0:00', null, '1:2:3:4']) {
    assert.equal(parseDuration(bad), null, String(bad));
  }
});

test('formatDuration pads seconds and adds hours when needed', () => {
  assert.equal(formatDuration(288), '4:48');
  assert.equal(formatDuration(6930), '1:55:30');
  assert.equal(formatDuration(65.4), '1:05');
});

test('zone paces are derived from a 24:00 5 km', () => {
  const paces = zonePaces(1440);
  assert.equal(paces.interval.fast, 288);
  assert.equal(paces.easy.fast, 388);
  assert.equal(paces.easy.slow, 423);
  assert.equal(describeZone('threshold', 1440), '5:21–5:31 /km');
});

test('describeZone returns null for an unknown zone', () => {
  assert.equal(describeZone('sprint', 1440), null);
});

test('paceOf divides time by distance and guards against zero distance', () => {
  assert.equal(paceOf(5, 1440), 288);
  assert.equal(paceOf(0, 100), null);
});

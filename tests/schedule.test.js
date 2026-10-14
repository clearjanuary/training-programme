import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, parseISODate, mondayOf, programmePosition, dateForSession, defaultStartDate,
} from '../js/schedule.js';

test('defaultStartDate is today on a Monday, otherwise next Monday', () => {
  assert.equal(toISODate(defaultStartDate(parseISODate('2026-10-14'))), '2026-10-19');
  assert.equal(toISODate(defaultStartDate(parseISODate('2026-10-19'))), '2026-10-19');
  assert.equal(toISODate(defaultStartDate(parseISODate('2026-10-18'))), '2026-10-19');
});

const day = (iso) => parseISODate(iso);

test('parseISODate round-trips valid dates and rejects impossible ones', () => {
  assert.equal(toISODate(day('2026-10-12')), '2026-10-12');
  assert.equal(parseISODate('2026-02-31'), null);
  assert.equal(parseISODate('nope'), null);
  assert.equal(parseISODate(undefined), null);
});

test('mondayOf returns the Monday of the same week', () => {
  assert.equal(toISODate(mondayOf(day('2026-10-13'))), '2026-10-12');
  assert.equal(toISODate(mondayOf(day('2026-10-18'))), '2026-10-12');
  assert.equal(toISODate(mondayOf(day('2026-10-12'))), '2026-10-12');
});

test('programmePosition maps dates onto weeks and weekdays', () => {
  const start = '2026-10-12';
  assert.deepEqual(programmePosition(day('2026-10-10'), start), { status: 'before', daysUntil: 2 });
  assert.deepEqual(programmePosition(day('2026-10-13'), start), { status: 'active', week: 1, weekday: 2 });
  assert.deepEqual(programmePosition(day('2026-10-18'), start), { status: 'active', week: 1, weekday: 0 });
  assert.deepEqual(programmePosition(day('2026-10-19'), start), { status: 'active', week: 2, weekday: 1 });
  assert.deepEqual(programmePosition(day('2027-01-03'), start), { status: 'active', week: 12, weekday: 0 });
  assert.deepEqual(programmePosition(day('2027-01-04'), start), { status: 'complete' });
});

test('programmePosition is unaffected by daylight-saving changes', () => {
  assert.equal(programmePosition(day('2026-03-30'), '2026-03-23').week, 2);
});

test('programmePosition rejects an invalid start date', () => {
  assert.throws(() => programmePosition(new Date(), 'soon'), /start date/i);
});

test('dateForSession finds the calendar date of a session', () => {
  assert.equal(toISODate(dateForSession('2026-10-12', 2, 0)), '2026-10-25');
  assert.equal(toISODate(dateForSession('2026-10-12', 1, 1)), '2026-10-12');
});

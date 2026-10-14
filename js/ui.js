import { dateForSession, dayNumber } from './schedule.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Every piece of dynamic text goes through esc() before reaching innerHTML.
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const formatLongDate = (date) =>
  date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatShortDate = (date) =>
  date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatKm = (km) => `${Number(km).toFixed(Number.isInteger(km) ? 0 : 1)} km`;

export const phaseClass = (phase) => `phase-${phase.toLowerCase().replace(/\s+/g, '-')}`;

export const STATUS_LABEL = Object.freeze({
  done: 'Done', missed: 'Not logged', today: 'Today', upcoming: 'Upcoming', rest: 'Rest',
});

export function sessionStatus(session, log, startDate, today) {
  if (session.type === 'rest') return 'rest';
  if (log?.done) return 'done';
  const diff = dayNumber(dateForSession(startDate, session.week, session.weekday)) - dayNumber(today);
  if (diff < 0) return 'missed';
  return diff === 0 ? 'today' : 'upcoming';
}

export function sessionHeader(session, startDate) {
  const date = dateForSession(startDate, session.week, session.weekday);
  const badge = session.phase === 'Build' ? '' : `<span class="badge ${phaseClass(session.phase)}">${esc(session.phase)}</span>`;
  return `
    <header class="page-head">
      <button type="button" class="back" data-action="back">‹ Back</button>
      <p class="eyebrow">Week ${session.week} · ${esc(formatLongDate(date))}</p>
      <h1>${esc(session.title)}</h1>
      <p class="muted">${esc(session.subtitle)}</p>
      ${badge}
    </header>`;
}

export const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

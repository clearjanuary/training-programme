import { EXTRA_TYPES } from '../programme.js';
import { parseISODate, toISODate, programmePosition, dayNumber } from '../schedule.js';
import { withExtra, withoutExtra, validateExtra, newExtraId } from '../store.js';
import { formatDuration } from '../paces.js';
import { weeklyVolume, volumeWarning } from '../stats.js';
import { esc, formatKm, formatShortDate } from '../ui.js';

const RECENT_LIMIT = 10;
const MAX_NOTES = 500;

function extraRow(extra) {
  const what = [EXTRA_TYPES[extra.type], extra.distanceKm ? formatKm(extra.distanceKm) : null, formatDuration(extra.durationSec)]
    .filter(Boolean).join(' · ');
  return `
    <li class="plan-row">
      <span class="plan-date">${esc(formatShortDate(parseISODate(extra.date)))}</span>
      <span class="plan-main">
        <span class="plan-title">${esc(what)}</span>
        ${extra.notes ? `<span class="plan-sub">${esc(extra.notes)}</span>` : ''}
      </span>
      <button type="button" class="btn small-btn" data-delete="${esc(extra.id)}" aria-label="Delete ${esc(what)}">Delete</button>
    </li>`;
}

export function renderExtra({ state, today }) {
  const recent = [...(state.extras ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_LIMIT);
  const types = Object.entries(EXTRA_TYPES).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
  const todayISO = toISODate(today);
  return `
    <header class="page-head">
      <button type="button" class="back" data-action="back">‹ Back</button>
      <p class="eyebrow">Outside the plan</p>
      <h1>Extra activity</h1>
      <p class="muted">Extra runs count towards your weekly running distance.</p>
    </header>
    <form class="card run-log" data-form="extra" novalidate>
      <div class="grid-2">
        <label class="stack">Activity<select name="type">${types}</select></label>
        <label class="stack">Date<input type="date" name="date" value="${todayISO}" max="${todayISO}"></label>
        <label class="stack">Distance (km)
          <input name="distance" type="number" inputmode="decimal" step="0.01" min="0" placeholder="optional">
        </label>
        <div class="stack">Time
          <div class="time-inputs">
            <label><input name="minutes" type="number" inputmode="numeric" min="0" aria-label="Minutes"><span class="unit">min</span></label>
            <label><input name="seconds" type="number" inputmode="numeric" min="0" max="59" aria-label="Seconds"><span class="unit">sec</span></label>
          </div>
        </div>
        <label class="stack">Avg heart rate
          <input name="hr" type="number" inputmode="numeric" placeholder="optional">
        </label>
      </div>
      <label class="stack">Notes<textarea name="notes" rows="2" placeholder="e.g. 20 min easy erg"></textarea></label>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Save activity</button>
    </form>
    ${recent.length ? `<section class="card"><h2 class="section-title">Recent extras</h2><ol class="plan-list">${recent.map(extraRow).join('')}</ol></section>` : ''}`;
}

function readExtraForm(form, today) {
  const value = (name) => form.elements[name].value.trim();
  const number = (name) => (value(name) === '' ? null : Number(value(name)));
  const minutes = number('minutes') ?? 0;
  const seconds = number('seconds') ?? 0;
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || seconds < 0 || seconds > 59) {
    return { error: 'Enter the time as whole minutes and seconds (0–59).' };
  }
  const date = parseISODate(value('date'));
  if (date && dayNumber(date) > dayNumber(today)) return { error: "That date hasn't happened yet." };
  const distance = number('distance');
  const hr = number('hr');
  const extra = {
    id: newExtraId(),
    date: value('date'),
    type: value('type'),
    distanceKm: distance === null ? null : Math.round(distance * 100) / 100,
    durationSec: minutes * 60 + seconds,
    avgHr: hr === null ? null : Math.round(hr),
    notes: value('notes').slice(0, MAX_NOTES),
  };
  const error = validateExtra(extra);
  return error ? { error } : { extra };
}

export function bindExtra(root, ctx) {
  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else ctx.navigate('#/today');
  });

  const form = root.querySelector('[data-form="extra"]');
  const errorEl = form.querySelector('.form-error');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { extra, error } = readExtraForm(form, ctx.today);
    errorEl.textContent = error ?? '';
    errorEl.hidden = !error;
    if (error) return;
    const next = withExtra(ctx.state, extra);
    const position = programmePosition(parseISODate(extra.date), next.settings.startDate);
    const week = position.status === 'active' ? position.week : null;
    const warning = extra.type === 'run' && week
      ? volumeWarning(weeklyVolume(next.logs, next.settings, next.extras)[week - 1], 'This week')
      : null;
    ctx.commit(next, { render: false });
    ctx.toast(warning ?? `${EXTRA_TYPES[extra.type]} saved.`);
    ctx.navigate('#/today');
  });

  root.addEventListener('click', (event) => {
    const id = event.target.closest('[data-delete]')?.dataset.delete;
    if (!id || !window.confirm('Delete this activity?')) return;
    ctx.commit(withoutExtra(ctx.state, id));
    ctx.toast('Activity deleted.');
  });
}

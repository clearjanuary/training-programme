import { EXERCISES } from '../programme.js';
import {
  weeklyVolume, liftBests, bestReps, dueSessionKeys, adherence, bodyTrend,
} from '../stats.js';
import { withBodyEntry, withoutBodyEntry, validateBodyEntry } from '../store.js';
import { parseISODate, toISODate } from '../schedule.js';
import { esc, formatKm, formatShortDate } from '../ui.js';
import { LADDERS, levelIndex } from '../ladders.js';

function ladderRows(levels, skill) {
  return Object.entries(LADDERS)
    .filter(([, ladder]) => Boolean(ladder.skill) === skill)
    .map(([id, ladder]) => {
      const index = levelIndex(id, levels);
      const current = EXERCISES[ladder.levels[index].exercise].name;
      return `<li><span>${esc(ladder.name)}</span><strong>${index + 1}/${ladder.levels.length} · ${esc(current)}</strong></li>`;
    }).join('');
}

function skillsCard(levels = {}) {
  return `
    <section class="card">
      <h2 class="section-title">Skills</h2>
      <ul class="paces">${ladderRows(levels, true)}</ul>
      <h3 class="sub-title">Strength progressions</h3>
      <ul class="paces">${ladderRows(levels, false)}</ul>
      <p class="muted small">Levels move up after a session where every set hits the top of its range.</p>
    </section>`;
}

const MAIN_LIFTS = Object.freeze(['backSquat', 'benchPress', 'deadlift', 'overheadPress']);
const STARTING_PULL_UPS = 5;
const STARTING_DIPS = 15;
const RECENT_BODY_ENTRIES = 6;

const percent = (value, max) => (max > 0 ? Math.min(100, (value / max) * 100) : 0);

function volumeBars(volume) {
  const max = Math.max(...volume.map((v) => Math.max(v.planned, v.actual)));
  return volume.map(({ week, planned, actual }) => `
    <li class="bar-row">
      <span class="bar-week">W${week}</span>
      <span class="bar-track" aria-hidden="true">
        <span class="bar planned" style="width:${percent(planned, max).toFixed(1)}%"></span>
        <span class="bar actual" style="width:${percent(actual, max).toFixed(1)}%"></span>
      </span>
      <span class="bar-value">${esc(actual ? actual.toFixed(1) : '0')} / ${planned} km</span>
    </li>`).join('');
}

function liftRows(logs) {
  return MAIN_LIFTS.map((id) => {
    const best = liftBests(logs, id);
    return `
      <tr>
        <th scope="row">${esc(EXERCISES[id].name)}</th>
        <td>${best ? `${esc(best.weight)} kg × ${esc(best.reps)}` : '–'}</td>
        <td>${best ? `${Math.round(best.e1rm)} kg` : '–'}</td>
      </tr>`;
  }).join('');
}

function trendLine(trend, unit, label, count) {
  if (!trend) return label;
  if (count < 2) return `${label}, first entry`;
  if (!trend.change) return `${label}, unchanged`;
  const sign = trend.change > 0 ? '+' : '';
  return `${label}, ${sign}${trend.change} ${unit} since ${formatShortDate(parseISODate(trend.since))}`;
}

function bodyRow(entry) {
  const what = [
    entry.weightKg !== null ? `${entry.weightKg} kg` : null,
    entry.waistCm !== null ? `${entry.waistCm} cm waist` : null,
  ].filter(Boolean).join(' · ');
  return `
    <li class="plan-row">
      <span class="plan-date">${esc(formatShortDate(parseISODate(entry.date)))}</span>
      <span class="plan-main"><span class="plan-title">${esc(what)}</span></span>
      <button type="button" class="btn small-btn" data-delete-body="${esc(entry.date)}" aria-label="Delete ${esc(what)}">Delete</button>
    </li>`;
}

function bodyCard(body, today) {
  const { weight, waist } = bodyTrend(body);
  const weights = body.filter((e) => e.weightKg !== null).length;
  const waists = body.filter((e) => e.waistCm !== null).length;
  const recent = [...body].reverse().slice(0, RECENT_BODY_ENTRIES);
  return `
    <section class="card">
      <h2 class="section-title">Body</h2>
      <div class="stats">
        <div><span class="stat">${weight ? esc(weight.latest) : '–'}</span>${esc(trendLine(weight, 'kg', 'kg', weights))}</div>
        <div><span class="stat">${waist ? esc(waist.latest) : '–'}</span>${esc(trendLine(waist, 'cm', 'cm waist', waists))}</div>
      </div>
      <p class="muted small body-tip">Weigh in once a week: same day, first thing, before food. Measure your waist at the navel, relaxed. A smaller waist with steady or rising weight means more muscle and less fat.</p>
      <form class="body-form" data-form="body" novalidate>
        <label class="stack full">Date<input type="date" name="date" value="${toISODate(today)}" max="${toISODate(today)}"></label>
        <label class="stack">Weight (kg)<input type="number" name="weight" inputmode="decimal" step="0.1" placeholder="optional"></label>
        <label class="stack">Waist (cm)<input type="number" name="waist" inputmode="decimal" step="0.5" placeholder="optional"></label>
        <button class="btn primary full" type="submit">Save measurement</button>
      </form>
      ${recent.length ? `<ol class="plan-list">${recent.map(bodyRow).join('')}</ol>` : ''}
    </section>`;
}

export function renderProgress({ state, today }) {
  const { logs, settings } = state;
  const extras = state.extras ?? [];
  const { done, due, skipped } = adherence(logs, dueSessionKeys(settings, today));
  const volume = weeklyVolume(logs, settings, extras);
  const extraMinutes = Math.round(extras.reduce((sum, e) => sum + e.durationSec, 0) / 60);
  const totalKm = volume.reduce((sum, v) => sum + v.actual, 0);
  const pullUps = bestReps(logs, 'pullUp');
  const dips = bestReps(logs, 'dip', { bodyweightOnly: true });

  return `
    <header class="page-head">
      <p class="eyebrow">So far</p>
      <h1>Progress</h1>
    </header>
    <section class="card">
      <div class="stats">
        <div><span class="stat">${done}/${due}</span>sessions done${skipped ? ` (${skipped} skipped)` : ''}</div>
        <div><span class="stat">${esc(formatKm(Math.round(totalKm * 10) / 10))}</span>run in total</div>
      </div>
    </section>
    ${bodyCard(state.body ?? [], today)}
    <section class="card">
      <h2 class="section-title">Running volume</h2>
      ${extras.length ? `<p class="muted small">Includes extra runs. ${extras.length} extra ${extras.length === 1 ? 'activity' : 'activities'} logged, ${extraMinutes} min in total.</p>` : ''}
      <p class="legend"><span class="key planned"></span>Planned <span class="key actual"></span>Logged</p>
      <ol class="bars">${volumeBars(volume)}</ol>
    </section>
    ${settings.style === 'barbell' ? `
    <section class="card">
      <h2 class="section-title">Strength</h2>
      <table class="lifts">
        <thead><tr><th scope="col">Lift</th><th scope="col">Best set</th><th scope="col">Est. 1RM</th></tr></thead>
        <tbody>${liftRows(logs)}</tbody>
      </table>
      <p class="muted small">Estimated one-rep max from your best set. It's a trend to watch, not a number to test.</p>
    </section>` : skillsCard(settings.levels)}
    <section class="card">
      <h2 class="section-title">Pull-ups and dips</h2>
      <div class="stats">
        <div><span class="stat">${pullUps ?? '–'}</span>best pull-up set (started at ${STARTING_PULL_UPS})</div>
        <div><span class="stat">${dips ?? '–'}</span>best bodyweight dip set (started at ${STARTING_DIPS})</div>
      </div>
    </section>`;
}

const ONE_DECIMAL = (value) => Math.round(value * 10) / 10;

export function bindProgress(root, ctx) {
  const form = root.querySelector('[data-form="body"]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const number = (name) => (form.elements[name].value.trim() === '' ? null : ONE_DECIMAL(Number(form.elements[name].value)));
    const entry = { date: form.elements.date.value, weightKg: number('weight'), waistCm: number('waist') };
    const error = validateBodyEntry(entry);
    if (error) {
      ctx.toast(error);
      return;
    }
    ctx.commit(withBodyEntry(ctx.state, entry));
    ctx.toast('Measurement saved.');
  });

  root.addEventListener('click', (event) => {
    const date = event.target.closest('[data-delete-body]')?.dataset.deleteBody;
    if (!date || !window.confirm('Delete this measurement?')) return;
    ctx.commit(withoutBodyEntry(ctx.state, date));
  });
}

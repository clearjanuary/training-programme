import { EXERCISES } from '../programme.js';
import {
  weeklyVolume, liftBests, bestReps, dueSessionKeys, adherence,
} from '../stats.js';
import { esc, formatKm } from '../ui.js';

const MAIN_LIFTS = Object.freeze(['backSquat', 'benchPress', 'deadlift', 'overheadPress']);
const STARTING_PULL_UPS = 5;
const STARTING_DIPS = 15;

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
    <section class="card">
      <h2 class="section-title">Running volume</h2>
      ${extras.length ? `<p class="muted small">Includes extra runs. ${extras.length} extra ${extras.length === 1 ? 'activity' : 'activities'} logged, ${extraMinutes} min in total.</p>` : ''}
      <p class="legend"><span class="key planned"></span>Planned <span class="key actual"></span>Logged</p>
      <ol class="bars">${volumeBars(volume)}</ol>
    </section>
    <section class="card">
      <h2 class="section-title">Strength</h2>
      <table class="lifts">
        <thead><tr><th scope="col">Lift</th><th scope="col">Best set</th><th scope="col">Est. 1RM</th></tr></thead>
        <tbody>${liftRows(logs)}</tbody>
      </table>
      <p class="muted small">Estimated one-rep max from your best set. It's a trend to watch, not a number to test.</p>
    </section>
    <section class="card">
      <h2 class="section-title">Bodyweight</h2>
      <div class="stats">
        <div><span class="stat">${pullUps ?? '–'}</span>best pull-up set (started at ${STARTING_PULL_UPS})</div>
        <div><span class="stat">${dips ?? '–'}</span>best bodyweight dip set (started at ${STARTING_DIPS})</div>
      </div>
    </section>`;
}

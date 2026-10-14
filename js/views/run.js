import {
  parseDuration, formatDuration, formatPace, describeZone, paceOf, ZONE_LABELS,
} from '../paces.js';
import { parseActivity } from '../import.js';
import { withLog, DEFAULT_SETTINGS } from '../store.js';
import { toISODate } from '../schedule.js';
import { esc, sessionHeader, formatKm } from '../ui.js';
import { runOverage } from '../stats.js';
import { skipBanner, skipControl, clearSkip } from './skip.js';

const MAX_RUN_KM = 100;
const HR_RANGE = Object.freeze([30, 230]);
const RPE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

function stepItem(step, fiveK) {
  const pace = step.zone
    ? `<span class="pace zone-${step.zone}"><span class="pace-label">${esc(ZONE_LABELS[step.zone])}</span>${esc(describeZone(step.zone, fiveK))}</span>`
    : '';
  return `
    <li class="step">
      <div><p class="step-label">${esc(step.label)}</p><p>${esc(step.detail)}</p></div>
      ${pace}
    </li>`;
}

function loggedSummary(run) {
  const pace = paceOf(run.distanceKm, run.durationSec);
  return `
    <section class="card done-card">
      <p class="eyebrow">Logged${run.source ? ` · ${esc(run.source)}` : ''}</p>
      <div class="stats">
        <div><span class="stat">${esc(formatKm(run.distanceKm))}</span>distance</div>
        <div><span class="stat">${esc(formatDuration(run.durationSec))}</span>time</div>
        <div><span class="stat">${pace ? esc(formatPace(pace)) : '–'}</span>per km</div>
        <div><span class="stat">${run.avgHr ?? '–'}</span>avg heart rate</div>
      </div>
    </section>`;
}

export function renderRun(session, ctx) {
  const { state } = ctx;
  const fiveK = parseDuration(state.settings.fiveK) ?? parseDuration(DEFAULT_SETTINGS.fiveK);
  const log = state.logs[session.key];
  const run = log?.run ?? {};
  const minutes = run.durationSec ? Math.floor(run.durationSec / 60) : '';
  const seconds = run.durationSec ? run.durationSec % 60 : '';
  const rpe = RPE_OPTIONS.map((n) => `<option value="${n}"${run.rpe === n ? ' selected' : ''}>${n}</option>`).join('');
  return `
    ${sessionHeader(session, state.settings.startDate)}
    ${skipBanner(log)}
    <section class="card">
      <h2 class="section-title">Session · about ${session.plannedKm} km</h2>
      <ol class="steps">${session.steps.map((step) => stepItem(step, fiveK)).join('')}</ol>
    </section>
    ${log?.done && run.distanceKm ? loggedSummary(run) : ''}
    <form class="card run-log" novalidate>
      <h2 class="section-title">${log?.done ? 'Edit your run' : 'Log your run'}</h2>
      <label class="btn file-btn">
        <input type="file" class="sr-only" data-action="import">
        Import GPX or TCX file
      </label>
      <p class="muted small">Export the activity from Garmin Connect, Polar Flow or Strava, save it to Files, then choose it here.</p>
      <div class="grid-2">
        <label class="stack">Distance (km)
          <input name="distance" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(run.distanceKm ? Number(run.distanceKm.toFixed(2)) : '')}">
        </label>
        <div class="stack">Time
          <div class="time-inputs">
            <label><input name="minutes" type="number" inputmode="numeric" min="0" value="${esc(minutes)}" aria-label="Minutes"><span class="unit">min</span></label>
            <label><input name="seconds" type="number" inputmode="numeric" min="0" max="59" value="${esc(seconds)}" aria-label="Seconds"><span class="unit">sec</span></label>
          </div>
        </div>
        <label class="stack">Avg heart rate
          <input name="hr" type="number" inputmode="numeric" min="${HR_RANGE[0]}" max="${HR_RANGE[1]}" value="${esc(run.avgHr ?? '')}" placeholder="optional">
        </label>
        <label class="stack">Effort (1–10)
          <select name="rpe"><option value="">–</option>${rpe}</select>
        </label>
      </div>
      <label class="stack">Notes
        <textarea name="notes" rows="2" placeholder="How did it feel?">${esc(run.notes ?? '')}</textarea>
      </label>
      <input type="hidden" name="source" value="${esc(run.source ?? 'Manual entry')}">
      <p class="form-error" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Save run</button>
    </form>
    ${skipControl(log)}`;
}

function readRunForm(form) {
  const data = new FormData(form);
  const number = (name) => (data.get(name) === '' ? null : Number(data.get(name)));
  const distanceKm = number('distance');
  const minutes = number('minutes') ?? 0;
  const seconds = number('seconds') ?? 0;
  const avgHr = number('hr');
  const rpe = number('rpe');

  if (!(distanceKm > 0 && distanceKm <= MAX_RUN_KM)) return { error: 'Enter a distance between 0 and 100 km.' };
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds > 59 || minutes < 0 || seconds < 0) {
    return { error: 'Enter the time as whole minutes and seconds (0–59).' };
  }
  const durationSec = minutes * 60 + seconds;
  if (durationSec <= 0) return { error: 'Enter how long the run took.' };
  if (avgHr !== null && !(avgHr >= HR_RANGE[0] && avgHr <= HR_RANGE[1])) {
    return { error: `Heart rate should be between ${HR_RANGE[0]} and ${HR_RANGE[1]}.` };
  }
  return {
    run: {
      distanceKm, durationSec, avgHr: avgHr === null ? null : Math.round(avgHr), rpe,
      notes: String(data.get('notes') ?? '').trim().slice(0, 500),
      source: String(data.get('source') ?? 'Manual entry'),
    },
  };
}

export function bindRun(root, session, ctx) {
  const form = root.querySelector('form.run-log');
  const errorEl = form.querySelector('.form-error');
  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  form.querySelector('[data-action="import"]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const activity = parseActivity(await file.text());
      form.distance.value = activity.distanceKm.toFixed(2);
      form.minutes.value = Math.floor(activity.durationSec / 60);
      form.seconds.value = activity.durationSec % 60;
      form.hr.value = activity.avgHr ?? '';
      form.source.value = `${activity.source}: ${file.name}`;
      showError('');
      ctx.toast('Run imported. Check the numbers, then save.');
    } catch (error) {
      showError(error.message);
    } finally {
      event.target.value = '';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { run, error } = readRunForm(form);
    if (error) {
      showError(error);
      return;
    }
    const existing = ctx.state.logs[session.key] ?? {};
    ctx.commit(withLog(ctx.state, session.key, { ...clearSkip(existing), done: true, date: existing.date ?? toISODate(new Date()), run }));
    ctx.toast(runOverage(run.distanceKm, session.plannedKm) ?? `${session.title} saved.`);
  });
}

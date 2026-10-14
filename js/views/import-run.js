import { weekSessions, DAY_NAMES } from '../programme.js';
import { programmePosition, toISODate } from '../schedule.js';
import { parseRunLink } from '../import.js';
import { defaultRunSession, runOverage } from '../stats.js';
import { withLog, withExtra, newExtraId } from '../store.js';
import { clearSkip } from './skip.js';

const EXTRA_CHOICE = 'extra';
import { formatDuration, formatPace, paceOf } from '../paces.js';
import { esc, formatKm } from '../ui.js';

// Landing page for the Apple Shortcut: #/import-run?km=5.02&sec=1500&hr=148&src=Garmin

function readLink(query) {
  try {
    return { run: parseRunLink(query) };
  } catch (error) {
    return { error: error.message };
  }
}

const message = (title, body) => `
  <header class="page-head"><p class="eyebrow">Import</p><h1>${esc(title)}</h1></header>
  <section class="card">
    <p class="muted">${esc(body)}</p>
    <p class="actions"><a class="btn" href="#/today">Back to today</a></p>
  </section>`;

function runSessionsThisWeek(state, today) {
  const position = programmePosition(today, state.settings.startDate);
  if (position.status !== 'active') return null;
  return weekSessions(position.week, state.settings).filter((s) => s.type === 'run');
}

export function renderImportRun({ state, today, params }) {
  const { run, error } = readLink(params.query);
  if (error) return message("Couldn't read that run", `${error} Check the Shortcut in Settings → Guide.`);
  const runs = runSessionsThisWeek(state, today);
  if (!runs) return message('No active week', 'Runs can only be imported during the 12-week block.');
  const chosen = defaultRunSession(runs, state.logs, today);
  const options = runs.map((s) => {
    const replaces = state.logs[s.key]?.done ? ' (replaces the logged run)' : '';
    return `<label class="check"><input type="radio" name="session" value="${s.key}"${s.key === chosen.key ? ' checked' : ''}>${esc(`${DAY_NAMES[s.weekday]} · ${s.title}${replaces}`)}</label>`;
  }).join('') + `<label class="check"><input type="radio" name="session" value="${EXTRA_CHOICE}">Extra run (not a planned session)</label>`;
  const pace = paceOf(run.distanceKm, run.durationSec);
  return `
    <header class="page-head"><p class="eyebrow">Import · ${esc(run.source)}</p><h1>Log this run</h1></header>
    <section class="card done-card">
      <div class="stats">
        <div><span class="stat">${esc(formatKm(run.distanceKm))}</span>distance</div>
        <div><span class="stat">${esc(formatDuration(run.durationSec))}</span>time</div>
        <div><span class="stat">${pace ? esc(formatPace(pace)) : '–'}</span>per km</div>
        <div><span class="stat">${run.avgHr ?? '–'}</span>avg heart rate</div>
      </div>
    </section>
    <form class="card" data-form="import-run">
      <h2 class="section-title">Which session was it?</h2>
      ${options}
      <button class="btn primary block" type="submit">Save run</button>
    </form>`;
}

export function bindImportRun(root, ctx) {
  const form = root.querySelector('[data-form="import-run"]');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { run } = readLink(ctx.params.query);
    if (run && form.session.value === EXTRA_CHOICE) {
      const extra = {
        id: newExtraId(), date: toISODate(ctx.today), type: 'run', distanceKm: run.distanceKm,
        durationSec: run.durationSec, avgHr: run.avgHr, notes: `Imported from ${run.source}`,
      };
      ctx.commit(withExtra(ctx.state, extra), { render: false });
      ctx.toast('Extra run saved.');
      ctx.navigate('#/today');
      return;
    }
    const runs = runSessionsThisWeek(ctx.state, ctx.today) ?? [];
    const session = runs.find((s) => s.key === form.session.value);
    if (!run || !session) {
      ctx.toast('Pick the session this run belongs to.');
      return;
    }
    const existing = clearSkip(ctx.state.logs[session.key] ?? {});
    const log = { ...existing, done: true, date: toISODate(ctx.today), run: { ...run, rpe: null, notes: '' } };
    ctx.commit(withLog(ctx.state, session.key, log), { render: false });
    ctx.toast(runOverage(run.distanceKm, session.plannedKm) ?? `${session.title} saved from ${run.source}.`);
    ctx.navigate(`#/session/${session.key}`);
  });
}

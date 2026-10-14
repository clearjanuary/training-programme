import { sessionOnDay, weekSessions, plannedKm, DAY_NAMES, PROGRAMME_WEEKS, EXERCISES } from '../programme.js';
import { programmePosition, dateForSession, parseISODate } from '../schedule.js';
import {
  actualKm, extraRunKm, pendingSessions, backupDue, weeklyVolume, volumeWarning, weighInDue,
} from '../stats.js';
import { exportBackup, markBackedUp, isIOSBrowserTab } from '../backup.js';
import { parseDuration, describeZone } from '../paces.js';
import { DEFAULT_SETTINGS } from '../store.js';
import {
  esc, formatLongDate, formatKm, phaseClass, sessionStatus, STATUS_LABEL,
} from '../ui.js';

const MAIN_STEP_LABELS = Object.freeze(['Main set', 'Time trial', 'Run club']);

const exerciseNames = (session) =>
  session.items.slice(0, 4).map((item) => EXERCISES[item.exercise].name).join(' · ');

function runSummary(session, fiveK) {
  const main = session.steps.find((s) => MAIN_STEP_LABELS.includes(s.label));
  if (main?.zone) return `${main.detail} · ${describeZone(main.zone, fiveK)}`;
  const extras = session.steps.slice(1).map((s) => s.label.toLowerCase()).join(' + ');
  return `Easy pace ${describeZone('easy', fiveK)}${extras ? ` · then ${extras}` : ''}`;
}

function todayCard(session, state, today) {
  if (session.type === 'rest') {
    return `
      <section class="card hero type-rest">
        <p class="eyebrow">Today</p>
        <h2>Rest day</h2>
        <p>Adaptation happens while you recover. A walk, ten minutes of mobility and an early night are ideal.</p>
      </section>`;
  }
  const status = sessionStatus(session, state.logs[session.key], state.settings.startDate, today);
  const fiveK = parseDuration(state.settings.fiveK) ?? parseDuration(DEFAULT_SETTINGS.fiveK);
  const summary = session.type === 'gym' ? exerciseNames(session) : runSummary(session, fiveK);
  const label = session.type === 'gym' ? 'Garage gym · about 60 min' : 'Run';
  return `
    <section class="card hero type-${session.type}">
      <p class="eyebrow">Today · ${label}</p>
      <h2>${esc(session.title)}</h2>
      <p class="hero-sub">${esc(session.subtitle)}</p>
      <p class="summary">${esc(summary)}</p>
      <p class="hero-actions">
        <a class="btn on-hero" href="#/session/${session.key}">${status === 'done' ? 'Done · view session' : session.type === 'run' ? 'See session' : 'Start session'}</a>
        ${session.type === 'run' && status !== 'done' ? `<a class="btn on-hero secondary" href="#/session/${session.key}?log">Log run</a>` : ''}
      </p>
    </section>`;
}

function catchUpCard(pending) {
  if (!pending.length) return '';
  const rows = pending.map((s) => `
    <li>
      <a class="plan-row type-${s.type}" href="#/session/${s.key}${s.type === 'run' ? '?log' : ''}">
        <span class="plan-date">Planned ${DAY_NAMES[s.weekday]}</span>
        <span class="plan-main">
          <span class="plan-title">${esc(s.title)}</span>
          <span class="plan-sub">${esc(s.subtitle)}</span>
        </span>
        <span class="status-pill">Log it</span>
      </a>
    </li>`).join('');
  return `
    <section class="card">
      <h2 class="section-title">Still to log this week</h2>
      <p class="muted small">Did a session on a different day? Log it here and it still counts.</p>
      <ol class="plan-list">${rows}</ol>
    </section>`;
}

function weekStrip(week, state, today) {
  const { startDate } = state.settings;
  const days = weekSessions(week, state.settings).map((session) => {
    const status = sessionStatus(session, state.logs[session.key], startDate, today);
    const date = dateForSession(startDate, week, session.weekday);
    const label = `${DAY_NAMES[session.weekday]} ${date.getDate()}: ${session.title}, ${STATUS_LABEL[status]}`;
    const inner = `
      <span class="day-name">${DAY_NAMES[session.weekday].charAt(0)}</span>
      <span class="day-date">${date.getDate()}</span>
      <span class="day-dot" aria-hidden="true"></span>`;
    const cls = `day type-${session.type} status-${status}`;
    return session.key
      ? `<li><a class="${cls}" href="#/session/${session.key}" aria-label="${esc(label)}">${inner}</a></li>`
      : `<li><span class="${cls}" aria-label="${esc(label)}">${inner}</span></li>`;
  }).join('');
  return `
    <section class="card">
      <h2 class="section-title">This week</h2>
      <ol class="week-strip">${days}</ol>
      <p class="muted small">Running: ${esc(formatKm(actualKm(state.logs, week) + extraRunKm(state.extras ?? [], startDate, week)))} of ${plannedKm(week, state.settings)} km planned</p>
      <p class="actions"><a class="btn" href="#/extra">+ Extra activity</a></p>
    </section>`;
}

function loadNotice(state, week) {
  const volume = weeklyVolume(state.logs, state.settings, state.extras ?? []);
  const warning = volumeWarning(volume[week - 1], 'This week')
    ?? (week > 1 ? volumeWarning(volume[week - 2], 'Last week') : null);
  if (!warning) return '';
  return `
    <section class="card notice">
      <h2 class="section-title">Running load check</h2>
      <p class="muted small">${esc(warning)}</p>
    </section>`;
}

function notices(state, today, week) {
  const cards = [loadNotice(state, week)];
  if (weighInDue(state.body ?? [], today)) {
    cards.push(`
      <section class="card notice">
        <h2 class="section-title">Weekly weigh-in</h2>
        <p class="muted small">Log your weight and waist so you can see the recomposition working.</p>
        <p class="actions"><a class="btn" href="#/progress">Log it</a></p>
      </section>`);
  }
  if (isIOSBrowserTab()) {
    cards.push(`
      <section class="card notice">
        <h2 class="section-title">Install the app</h2>
        <p class="muted small">You're in a Safari tab. Tap Share → Add to Home Screen and log from the installed app. Safari and the installed app keep separate data.</p>
      </section>`);
  }
  if (backupDue(state, today)) {
    const last = parseISODate(state.settings.lastBackup);
    cards.push(`
      <section class="card notice">
        <h2 class="section-title">Back up your log</h2>
        <p class="muted small">${last ? `Last backup ${esc(formatLongDate(last))}.` : 'No backup yet.'} Your log only lives on this phone; save a copy to Files or iCloud Drive.</p>
        <p class="actions"><button type="button" class="btn" data-action="backup">Back up now</button></p>
      </section>`);
  }
  return cards.join('');
}

export function bindToday(root, ctx) {
  root.querySelector('[data-action="backup"]')?.addEventListener('click', async () => {
    if (!(await exportBackup(ctx.state))) return;
    ctx.commit(markBackedUp(ctx.state));
    ctx.toast('Backup saved.');
  });
}

export function renderToday({ state, today }) {
  const { startDate } = state.settings;
  const position = programmePosition(today, startDate);
  const eyebrow = `<p class="eyebrow">${esc(formatLongDate(today))}</p>`;

  if (position.status === 'before') {
    const days = position.daysUntil === 1 ? '1 day' : `${position.daysUntil} days`;
    return `
      <header class="page-head">${eyebrow}<h1>Starts soon</h1></header>
      <section class="card">
        <p>Your 12-week block starts on <strong>${esc(formatLongDate(parseISODate(startDate)))}</strong>, in ${days}.</p>
        <p class="actions"><a class="btn" href="#/plan">Preview the plan</a></p>
      </section>`;
  }
  if (position.status === 'complete') {
    return `
      <header class="page-head">${eyebrow}<h1>Block complete</h1></header>
      <section class="card">
        <p>Twelve weeks done. Check your progress, export a backup, then start a new block in Settings with your new 5 km time.</p>
        <p class="actions"><a class="btn primary" href="#/settings">Go to Settings</a></p>
      </section>`;
  }

  const session = sessionOnDay(position.week, position.weekday, state.settings);
  const pending = pendingSessions(state.logs, state.settings, position.week, today);
  return `
    <header class="page-head">
      ${eyebrow}
      <h1>Week ${position.week} <span class="muted">of ${PROGRAMME_WEEKS}</span></h1>
      <span class="badge ${phaseClass(session.phase)}">${esc(session.phase)}</span>
    </header>
    ${todayCard(session, state, today)}
    ${catchUpCard(pending)}
    ${weekStrip(position.week, state, today)}
    ${notices(state, today, position.week)}`;
}

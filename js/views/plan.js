import { weekSessions, plannedKm, weekPhase, PROGRAMME_WEEKS } from '../programme.js';
import { programmePosition, dateForSession, parseISODate } from '../schedule.js';
import {
  esc, formatLongDate, formatShortDate, phaseClass, sessionStatus, STATUS_LABEL,
} from '../ui.js';

const TRAINING_SESSIONS_PER_WEEK = 6;

function planRow(session, state, today) {
  const date = formatShortDate(dateForSession(state.settings.startDate, session.week, session.weekday));
  if (session.type === 'rest') {
    return `
      <li class="plan-row type-rest">
        <span class="plan-date">${esc(date)}</span>
        <span class="plan-main"><span class="plan-title">Rest</span></span>
      </li>`;
  }
  const status = sessionStatus(session, state.logs[session.key], state.settings.startDate, today);
  return `
    <li>
      <a class="plan-row type-${session.type} status-${status}" href="#/session/${session.key}">
        <span class="plan-date">${esc(date)}</span>
        <span class="plan-main">
          <span class="plan-title">${esc(session.title)}</span>
          <span class="plan-sub">${esc(session.subtitle)}</span>
        </span>
        <span class="status-pill">${STATUS_LABEL[status]}</span>
      </a>
    </li>`;
}

function weekBlock(week, isCurrent, state, today) {
  const sessions = weekSessions(week, state.settings);
  const done = sessions.filter((s) => state.logs[s.key]?.done).length;
  const phase = weekPhase(week);
  return `
    <details class="card week" ${isCurrent ? 'open' : ''}>
      <summary>
        <span class="week-title">Week ${week}</span>
        ${phase === 'Build' ? '' : `<span class="badge ${phaseClass(phase)}">${esc(phase)}</span>`}
        <span class="week-meta">${done}/${TRAINING_SESSIONS_PER_WEEK} · ${plannedKm(week, state.settings)} km</span>
      </summary>
      <ol class="plan-list">${sessions.map((s) => planRow(s, state, today)).join('')}</ol>
    </details>`;
}

export function renderPlan({ state, today }) {
  const { startDate } = state.settings;
  const position = programmePosition(today, startDate);
  const current = { active: position.week, before: 1, complete: PROGRAMME_WEEKS }[position.status];
  const weeks = Array.from({ length: PROGRAMME_WEEKS }, (_, i) => i + 1)
    .map((week) => weekBlock(week, week === current, state, today))
    .join('');
  return `
    <header class="page-head">
      <p class="eyebrow">12-week block</p>
      <h1>Plan</h1>
      <p class="muted">Started ${esc(formatLongDate(parseISODate(startDate)))}. Weeks 4 and 8 are lighter; week 12 retests your 5 km, pull-ups and dips.</p>
    </header>
    ${weeks}`;
}

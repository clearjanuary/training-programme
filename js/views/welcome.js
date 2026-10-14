import { DAY_ORDER, DAY_NAMES_LONG, KIND_LABELS } from '../programme.js';
import { defaultStartDate, mondayOf, parseISODate, toISODate } from '../schedule.js';
import { parseDuration, fiveKFromParts } from '../paces.js';
import { withSettings } from '../store.js';
import { esc, formatLongDate } from '../ui.js';

export function renderWelcome({ state, today }) {
  const { layout, clubRuns, fiveK } = state.settings;
  const fiveKSec = parseDuration(fiveK);
  const week = DAY_ORDER.map((day) => {
    const kind = layout[day];
    const club = clubRuns.includes(kind) ? ' · run club' : '';
    return `<li><span>${DAY_NAMES_LONG[day]}</span><strong>${esc(KIND_LABELS[kind])}${club}</strong></li>`;
  }).join('');
  return `
    <header class="page-head">
      <p class="eyebrow">Welcome</p>
      <h1>Your 12-week block</h1>
      <p class="muted">Three strength sessions and three runs a week, building to a 5 km, pull-up and dip retest in week 12.</p>
    </header>
    <form class="card" data-form="welcome" novalidate>
      <label class="stack">Start date
        <input type="date" name="startDate" value="${toISODate(defaultStartDate(today))}">
      </label>
      <p class="muted small">Blocks start on a Monday; any date snaps to the Monday of its week.</p>
      <div class="stack welcome-gap">Current 5 km time
        <div class="time-inputs">
          <label><input name="minutes" type="number" inputmode="numeric" value="${Math.floor(fiveKSec / 60)}" aria-label="Minutes"><span class="unit">min</span></label>
          <label><input name="seconds" type="number" inputmode="numeric" value="${String(fiveKSec % 60).padStart(2, '0')}" aria-label="Seconds"><span class="unit">sec</span></label>
        </div>
      </div>
      <h3 class="sub-title">Your week</h3>
      <ul class="paces">${week}</ul>
      <p class="muted small">You can change the layout and run club days later in Settings.</p>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Start the plan</button>
    </form>`;
}

export function bindWelcome(root, ctx) {
  const form = root.querySelector('[data-form="welcome"]');
  const errorEl = form.querySelector('.form-error');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const picked = parseISODate(form.startDate.value);
    const fiveK = fiveKFromParts(form.minutes.value, form.seconds.value);
    const error = !picked ? 'Pick a start date.' : !fiveK ? 'Enter a 5 km time between 12 and 60 minutes.' : '';
    errorEl.textContent = error;
    errorEl.hidden = !error;
    if (error) return;
    const startDate = toISODate(mondayOf(picked));
    ctx.commit(withSettings(ctx.state, { startDate, fiveK }));
    ctx.toast(`Week 1 starts ${formatLongDate(parseISODate(startDate))}.`);
    ctx.navigate('#/today');
  });
}

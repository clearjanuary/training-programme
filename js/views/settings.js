import {
  parseDuration, describeZone, fiveKFromParts, ZONE_LABELS, ZONE_OFFSETS,
} from '../paces.js';
import {
  DAY_ORDER, DAY_NAMES_LONG, LAYOUT_OPTIONS, KIND_LABELS, CLUB_KINDS, validateLayout, layoutWarnings,
} from '../programme.js';
import { withSettings, withoutLogs, validateState } from '../store.js';
import { mondayOf, parseISODate, toISODate } from '../schedule.js';
import { exportBackup, markBackedUp } from '../backup.js';
import { esc, formatLongDate } from '../ui.js';

const GUIDE = [
  ['How weights progress', 'Each lift has a rep range, like 6–8. Stay at a weight until every set reaches the top of the range, then the app suggests the next step up. If you fall short of the bottom of the range, repeat the weight; if that happens two sessions running, it drops the weight about 10% so you can build back up. Pull-ups and dips follow a weekly ladder, and a missed week is repeated before moving on.'],
  ['Reps in reserve', '"2 in reserve" means stop each set when you could still do about 2 more good reps. Training near, not at, failure builds muscle with far less fatigue, which matters when you run three times a week.'],
  ['Deload weeks', 'Weeks 4 and 8 cut a set from each lift and ease the running back. You keep the same weights. It feels too easy, and that is the point: it lets the work of the previous three weeks sink in.'],
  ['Running paces', 'Most of your running is easy: you should be able to talk in full sentences. The big gains for your 10 km and half marathon come from more easy volume, with one quality session a week for speed. Retest your 5 km in week 12 and update it here.'],
  ['Eating for muscle', 'To build muscle while staying lean, aim for about 1.6–2.2 g of protein per kg of bodyweight a day, spread over 3–4 meals, and eat at around maintenance or a small surplus. Sleep 7–9 hours. Strength gains come from the gym; muscle is built in the kitchen and in bed.'],
  ['Install on your iPhone', 'Open the app in Safari, tap Share, then "Add to Home Screen", and always log from the installed app: Safari and the installed app keep separate data. Back up every couple of weeks.'],
];

const CLUB_LABELS = Object.freeze({
  runEasy: 'My easy run is a run club run (5 or 10 km)',
  runQuality: 'My quality run is a run club 5 km',
  runLong: 'My long run is a run club run (5–21 km)',
});

function layoutForm({ layout, clubRuns }) {
  const rows = DAY_ORDER.map((day) => {
    const options = LAYOUT_OPTIONS
      .map((kind) => `<option value="${kind}"${layout[day] === kind ? ' selected' : ''}>${esc(KIND_LABELS[kind])}</option>`)
      .join('');
    return `<label class="layout-row"><span>${DAY_NAMES_LONG[day]}</span><select name="day-${day}" aria-label="${DAY_NAMES_LONG[day]}">${options}</select></label>`;
  }).join('');
  const checks = CLUB_KINDS.map((kind) => `
    <label class="check"><input type="checkbox" name="club-${kind}"${clubRuns.includes(kind) ? ' checked' : ''}>${esc(CLUB_LABELS[kind])}</label>`).join('');
  return `
    <form class="card" data-form="layout" novalidate>
      <h2 class="section-title">Weekly layout</h2>
      <p class="muted small">Put each session on one day. A session you miss waits on Today until you log it, so Friday's strength session can be done on Saturday.</p>
      <div>${rows}</div>
      <h3 class="sub-title">Run club</h3>
      ${checks}
      <p class="form-error" role="alert" hidden></p>
      <button class="btn primary block" type="submit">Save layout</button>
    </form>`;
}

function pacesList(fiveK) {
  return Object.keys(ZONE_OFFSETS).map((zone) => `
    <li><span>${esc(ZONE_LABELS[zone])}</span><strong>${esc(describeZone(zone, fiveK))}</strong></li>`).join('');
}

function shortcutCard() {
  const link = `${location.origin}${location.pathname}#/import-run`;
  return `
    <section class="card">
      <h2 class="section-title">Import runs from Apple Health</h2>
      <p class="muted small">Garmin Connect, Polar Flow and Whoop can sync workouts to Apple Health. An Apple Shortcut can read your latest run there and open this link with the numbers filled in:</p>
      <p class="code">${esc(link)}?km=<em>distance</em>&amp;min=<em>minutes</em>&amp;hr=<em>avg&nbsp;HR</em>&amp;src=Garmin</p>
      <p class="muted small">In the Shortcuts app: Find Health Samples (your latest workout), get its distance in km, duration in minutes and average heart rate, then Open URLs with the link above. Health options in Shortcuts vary by iOS version, so test it once. Step-by-step instructions are in the README.</p>
      <p class="actions"><a class="btn" href="#/import-run?km=5&amp;min=27.5&amp;hr=145&amp;src=Test">Try a test import</a></p>
    </section>`;
}

export function renderSettings({ state }) {
  const { startDate, fiveK, lastBackup } = state.settings;
  const fiveKSec = parseDuration(fiveK);
  const backedUp = parseISODate(lastBackup);
  const guide = GUIDE.map(([title, body]) => `<details class="guide"><summary>${esc(title)}</summary><p>${esc(body)}</p></details>`).join('');
  return `
    <header class="page-head"><p class="eyebrow">Your programme</p><h1>Settings</h1></header>

    <section class="card">
      <h2 class="section-title">Start date</h2>
      <label class="stack">Week 1 begins on
        <input type="date" name="startDate" value="${esc(startDate)}">
      </label>
      <p class="muted small">Snaps to the Monday of the week you pick. Currently ${esc(formatLongDate(parseISODate(startDate)))}.</p>
    </section>

    ${layoutForm(state.settings)}

    <form class="card" data-form="fiveK" novalidate>
      <h2 class="section-title">Current 5 km time</h2>
      <div class="time-inputs">
        <label><input name="minutes" type="number" inputmode="numeric" value="${Math.floor(fiveKSec / 60)}" aria-label="Minutes"><span class="unit">min</span></label>
        <label><input name="seconds" type="number" inputmode="numeric" value="${String(fiveKSec % 60).padStart(2, '0')}" aria-label="Seconds"><span class="unit">sec</span></label>
        <button class="btn" type="submit">Update</button>
      </div>
      <ul class="paces">${pacesList(fiveKSec)}</ul>
    </form>

    <section class="card">
      <h2 class="section-title">Backup</h2>
      <p class="muted small">Your training log lives only on this phone. Export saves a copy to Files or iCloud Drive. ${backedUp ? `Last backup: ${esc(formatLongDate(backedUp))}.` : 'Not backed up yet.'}</p>
      <p class="actions">
        <button type="button" class="btn" data-action="export">Export backup</button>
        <label class="btn file-btn"><input type="file" class="sr-only" accept="application/json,.json" data-action="import">Import backup</label>
      </p>
    </section>

    ${shortcutCard()}

    <section class="card">
      <h2 class="section-title">Guide</h2>
      ${guide}
    </section>

    <section class="card">
      <h2 class="section-title">Start a new block</h2>
      <p class="muted small">Clears every logged session and lets you pick a new start date. Export a backup first.</p>
      <p class="actions"><button type="button" class="btn danger" data-action="reset">Clear log and restart</button></p>
    </section>`;
}

export function bindSettings(root, ctx) {
  root.querySelector('input[name="startDate"]').addEventListener('change', (event) => {
    const picked = parseISODate(event.target.value);
    if (!picked) {
      ctx.toast('Pick a valid date.');
      return;
    }
    const startDate = toISODate(mondayOf(picked));
    ctx.commit(withSettings(ctx.state, { startDate }));
    ctx.toast(`Week 1 now starts ${formatLongDate(parseISODate(startDate))}.`);
  });

  root.querySelector('[data-form="layout"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const layout = Array.from({ length: 7 }, (_, day) => form.elements[`day-${day}`].value);
    const errorEl = form.querySelector('.form-error');
    const error = validateLayout(layout);
    errorEl.textContent = error ?? '';
    errorEl.hidden = !error;
    if (error) return;
    const clubRuns = CLUB_KINDS.filter((kind) => form.elements[`club-${kind}`].checked);
    ctx.commit(withSettings(ctx.state, { layout, clubRuns }));
    const [warning] = layoutWarnings(layout);
    ctx.toast(warning ? `Saved. Heads up: ${warning}` : 'Weekly layout saved.');
  });

  root.querySelector('[data-form="fiveK"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const fiveK = fiveKFromParts(event.target.minutes.value, event.target.seconds.value);
    if (!fiveK) {
      ctx.toast('Enter a 5 km time between 12 and 60 minutes.');
      return;
    }
    ctx.commit(withSettings(ctx.state, { fiveK }));
    ctx.toast('Paces updated.');
  });

  root.querySelector('[data-action="export"]').addEventListener('click', async () => {
    if (!(await exportBackup(ctx.state))) return;
    ctx.commit(markBackedUp(ctx.state));
    ctx.toast('Backup saved.');
  });

  root.querySelector('[data-action="import"]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = validateState(JSON.parse(await file.text()));
      if (!window.confirm('Replace everything on this phone with the backup?')) return;
      ctx.commit(imported);
      ctx.toast('Backup restored.');
    } catch (error) {
      ctx.toast(error instanceof SyntaxError ? 'That file is not a valid backup.' : error.message);
    }
  });

  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    if (!window.confirm('Clear every logged session and start a new block?')) return;
    ctx.commit(withSettings(withoutLogs(ctx.state), { startDate: null }));
    ctx.toast('Log cleared. Pick your new start date.');
  });
}

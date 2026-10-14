import { EXERCISES, isDeloadWeek, getSession } from '../programme.js';
import {
  findRecentPerformances, suggestLoad, warmUpSets, adaptLadder,
} from '../progression.js';
import { formatDuration } from '../paces.js';
import { withLog, withSettings } from '../store.js';
import { toISODate, parseISODate } from '../schedule.js';
import { esc, sessionHeader, formatLongDate, CHECK_ICON } from '../ui.js';
import { startRest } from '../timer.js';
import { skipBanner, skipControl, clearSkip } from './skip.js';
import { LADDERS, ladderLevelUps } from '../ladders.js';

const UNIT_LABEL = Object.freeze({ reps: 'reps', s: 'sec', m: 'm' });
const repsText = ([min, max]) => (min === max ? `${min}` : `${min}–${max}`);
const unitOf = (exercise) => UNIT_LABEL[exercise.unit ?? 'reps'];

function targetText(item, exercise) {
  if (item.test) return 'Max reps · one all-out set';
  const side = exercise.perSide ? ' each side' : '';
  const reserve = item.rir === null ? '' : ` · ${item.rir} in reserve`;
  return `${item.sets} × ${repsText(item.reps)} ${unitOf(exercise)}${side}${reserve} · rest ${formatDuration(item.rest)}`;
}

function ladderHint(item, exercise) {
  const position = `Level ${item.level + 1} of ${item.levelCount}.`;
  if (!item.nextExercise) return `${position} Top level: keep adding reps or hold time.`;
  return `${position} Hit ${item.reps[1]} ${unitOf(exercise)} on every set to move up to ${EXERCISES[item.nextExercise].name}.`;
}

function levelControl(item) {
  const options = LADDERS[item.ladder].levels
    .map((lvl, i) => `<option value="${i}"${i === item.level ? ' selected' : ''}>${i + 1}. ${esc(EXERCISES[lvl.exercise].name)}</option>`)
    .join('');
  return `
    <label class="stack swap">Level
      <select data-level="${item.ladder}">${options}</select>
    </label>`;
}

function swapControl(item) {
  const alternatives = EXERCISES[item.slot]?.alternatives ?? [];
  if (!alternatives.length) return '';
  const options = alternatives
    .map((id) => `<option value="${id}"${item.exercise === id ? ' selected' : ''}>${esc(EXERCISES[id].name)}</option>`)
    .join('');
  return `
    <label class="stack swap">Swap exercise
      <select data-swap="${item.slot}"><option value="">${esc(EXERCISES[item.slot].name)} (planned)</option>${options}</select>
    </label>`;
}

function lastTimeText(last) {
  const sets = last.sets.map((s) => (Number(s.weight) > 0 ? `${s.weight}×${s.reps}` : `${s.reps}`)).join(', ');
  return `Last time (week ${last.week}): ${sets}`;
}

const warmUpText = (kg) =>
  warmUpSets(kg).map((set) => `${set.weight}×${set.reps}`).join(' · ');

function setRow(item, exercise, index, set, defaultWeight) {
  const n = index + 1;
  const unit = unitOf(exercise);
  const placeholder = item.test ? 'max' : repsText(item.reps);
  const weightValue = set.weight ?? defaultWeight ?? '';
  const weight = item.weighted
    ? `<label class="field"><input type="number" inputmode="decimal" min="0" step="0.5" data-field="weight"
         value="${esc(weightValue)}" placeholder="${item.optionalLoad ? 'BW' : '–'}" aria-label="Set ${n} weight in kg"><span class="unit">kg</span></label>`
    : `<span class="field static">${exercise.load === 'none' ? 'No weight' : 'Bodyweight'}</span>`;
  return `
    <div class="set-row${set.done ? ' is-done' : ''}" data-set="${index}">
      <span class="set-num">${n}</span>
      ${weight}
      <label class="field"><input type="number" inputmode="numeric" min="0" step="1" data-field="reps"
        value="${esc(set.reps ?? '')}" placeholder="${esc(placeholder)}" aria-label="Set ${n} ${unit}"><span class="unit">${unit}</span></label>
      <button type="button" class="tick" data-action="tick" aria-pressed="${Boolean(set.done)}" aria-label="Set ${n} done">${CHECK_ICON}</button>
    </div>`;
}

// This week's target for an item: the planned one, or last week's ladder step repeated if it was missed.
function resolveTarget(item, session, last) {
  if (!item.plan || !last || isDeloadWeek(session.week)) return { target: item, ladderNote: null };
  const previousItem = getSession(last.week, session.kind).items.find((i) => i.slot === item.slot);
  const { item: target, note } = adaptLadder(item, previousItem, last);
  return { target, ladderNote: note };
}

function exerciseCard(item, index, session, state, log) {
  const exercise = EXERCISES[item.exercise];
  const [last = null, previous = null] = findRecentPerformances(state.logs, item.exercise, session.week, 2);
  const { target, ladderNote } = resolveTarget(item, session, last);
  const suggestion = suggestLoad({
    item: target, increment: exercise.increment ?? 0, last, previous, deload: isDeloadWeek(session.week),
  });
  const sets = log.sets?.[item.exercise] ?? [];
  // Later sets default to the weight used earlier this session, then to the suggestion.
  const defaultWeight = (i) =>
    sets.slice(0, i).reverse().find((s) => s?.weight != null)?.weight ?? suggestion?.weight;
  const rows = Array.from({ length: target.sets }, (_, i) => setRow(target, exercise, i, sets[i] ?? {}, defaultWeight(i))).join('');
  const complete = sets.filter((s) => s?.done).length >= target.sets;
  const hint = suggestion
    ? `<p class="hint">${suggestion.weight ? `<strong>${esc(suggestion.weight)} kg</strong> · ` : ''}${esc(suggestion.reason)}</p>`
    : '';
  const warmUp = target.barbell ? warmUpText(defaultWeight(0)) : '';
  const minReps = target.test ? '' : target.reps[0];
  return `
    <section class="card exercise${complete ? ' is-complete' : ''}" data-ex="${item.exercise}" data-min-reps="${minReps}" data-rest="${target.rest}">
      <div class="exercise-head">
        <span class="exercise-num" aria-hidden="true">${complete ? CHECK_ICON : index + 1}</span>
        <div>
          <h2>${esc(exercise.name)}</h2>
          <p class="target">${esc(targetText(target, exercise))}</p>
        </div>
      </div>
      ${hint}
      ${ladderNote ? `<p class="hint">${esc(ladderNote)}</p>` : ''}
      ${target.ladder ? `<p class="hint">${esc(ladderHint(target, exercise))}</p>` : ''}
      ${target.note ? `<p class="hint">${esc(target.note)}</p>` : ''}
      ${warmUp ? `<p class="last">Warm-up sets: ${esc(warmUp)}</p>` : ''}
      ${last ? `<p class="last">${esc(lastTimeText(last))}</p>` : ''}
      <div class="sets">${rows}</div>
      <details class="cue"><summary>How to do it</summary><p>${esc(exercise.cue)}</p>${target.ladder ? levelControl(target) : swapControl(item)}</details>
    </section>`;
}

export function renderGym(session, ctx) {
  const { state } = ctx;
  const log = state.logs[session.key] ?? {};
  const doneNote = log.done && log.date
    ? `<p class="done-note">Completed ${esc(formatLongDate(parseISODate(log.date)))}</p>`
    : '';
  return `
    ${sessionHeader(session, state.settings.startDate)}
    ${skipBanner(log)}
    <section class="card note">
      <h2 class="section-title">Warm-up · 8 min</h2>
      <p>${esc(session.warmUp)}</p>
    </section>
    ${session.items.map((item, i) => exerciseCard(item, i, session, state, log)).join('')}
    <section class="card note">
      <h2 class="section-title">Finish · 5 min</h2>
      <p>${esc(session.coolDown)}</p>
    </section>
    <div class="finish">
      ${doneNote}
      <button type="button" class="btn primary block" data-action="finish">${log.done ? 'Save changes' : 'Finish session'}</button>
    </div>
    ${skipControl(log)}`;
}

function readNumber(input) {
  const raw = input?.value.trim() ?? '';
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateSet(log, exerciseId, index, patch) {
  const current = log.sets?.[exerciseId] ?? [];
  const sets = Array.from({ length: Math.max(current.length, index + 1) }, (_, i) => current[i] ?? {});
  const next = sets.map((set, i) => (i === index ? { ...set, ...patch } : set));
  return { ...log, sets: { ...log.sets, [exerciseId]: next } };
}

export function bindGym(root, session, ctx) {
  const currentLog = () => ctx.state.logs[session.key] ?? {};
  const save = (log, options) => ctx.commit(withLog(ctx.state, session.key, log), options);

  const locate = (el) => {
    const card = el.closest('[data-ex]');
    const row = el.closest('[data-set]');
    if (!card || !row) return null;
    return { card, row, exerciseId: card.dataset.ex, index: Number(row.dataset.set) };
  };

  root.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    const where = locate(event.target);
    if (!field || !where) return;
    event.target.classList.remove('needs-value');
    save(updateSet(currentLog(), where.exerciseId, where.index, { [field]: readNumber(event.target) }), { render: false });
  });

  function toggleSet(button) {
    const where = locate(button);
    const existing = currentLog().sets?.[where.exerciseId]?.[where.index] ?? {};
    if (existing.done) {
      save(updateSet(currentLog(), where.exerciseId, where.index, { done: false }));
      return;
    }
    const { minReps, rest } = where.card.dataset;
    const repsInput = where.row.querySelector('[data-field="reps"]');
    const reps = readNumber(repsInput) ?? (minReps ? Number(minReps) : null);
    if (reps === null) {
      repsInput.classList.add('needs-value');
      repsInput.focus();
      ctx.toast('Enter how many reps you managed first.');
      return;
    }
    const weightInput = where.row.querySelector('[data-field="weight"]');
    const weight = weightInput ? readNumber(weightInput) : null;
    save(updateSet(currentLog(), where.exerciseId, where.index, { weight, reps, done: true }));
    startRest(Number(rest));
  }

  // Finishing also moves any ladder whose every set hit the top of its range up a level
  // (not in deload weeks, which are deliberately easier).
  function finish() {
    const log = currentLog();
    const current = ctx.state.settings.levels ?? {};
    const { levels, promoted } = isDeloadWeek(session.week)
      ? { levels: current, promoted: [] }
      : ladderLevelUps(session.items, log, current);
    const finished = { ...clearSkip(log), done: true, date: log.date ?? toISODate(new Date()) };
    ctx.commit(withLog(withSettings(ctx.state, { levels }), session.key, finished), { render: false });
    const names = promoted.map((id) => EXERCISES[id].name);
    ctx.toast(names.length ? `${session.title} saved. Level up: ${names.join(', ')}!` : `${session.title} saved. Good work.`);
    ctx.navigate('#/today');
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button?.dataset.action === 'tick') toggleSet(button);
    if (button?.dataset.action === 'finish') finish();
  });

  // Swaps stick for every future session until undone (here or in Settings).
  root.addEventListener('change', (event) => {
    const ladderId = event.target.dataset.level;
    if (ladderId) {
      const index = Number(event.target.value);
      ctx.commit(withSettings(ctx.state, { levels: { ...(ctx.state.settings.levels ?? {}), [ladderId]: index } }));
      ctx.toast(`${LADDERS[ladderId].name}: level ${index + 1}.`);
      return;
    }
    const slot = event.target.dataset.swap;
    if (!slot) return;
    const current = ctx.state.settings.swaps ?? {};
    const swapTo = event.target.value;
    const swaps = swapTo
      ? { ...current, [slot]: swapTo }
      : Object.fromEntries(Object.entries(current).filter(([key]) => key !== slot));
    ctx.commit(withSettings(ctx.state, { swaps }));
    ctx.toast(swapTo ? `Swapped to ${EXERCISES[swapTo].name}.` : `Back to ${EXERCISES[slot].name}.`);
  });
}

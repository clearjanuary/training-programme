// Twelve-week hybrid block: three full-body strength sessions and three runs a week.
// Weeks 4 and 8 are deloads; week 12 retests 5 km, pull-ups and dips.

import { EXERCISES } from './exercises.js';

export { EXERCISES };

export const PROGRAMME_WEEKS = 12;
export const DELOAD_WEEKS = Object.freeze([4, 8]);
export const TEST_WEEK = 12;

export const SESSION_KINDS = Object.freeze(['gymA', 'gymB', 'gymC', 'runEasy', 'runQuality', 'runLong']);
export const LAYOUT_OPTIONS = Object.freeze([...SESSION_KINDS, 'rest']);
export const CLUB_KINDS = Object.freeze(['runEasy', 'runQuality', 'runLong']);
export const KIND_LABELS = Object.freeze({
  gymA: 'Strength A', gymB: 'Strength B', gymC: 'Strength C',
  runEasy: 'Easy run', runQuality: 'Quality run', runLong: 'Long run', rest: 'Rest',
});

// Unplanned activities that can be logged alongside the programme.
export const EXTRA_TYPES = Object.freeze({ run: 'Run', erg: 'Erg', walk: 'Walk', other: 'Other' });

// Which session sits on which day; index = Date#getDay() (0 = Sunday).
// Default: strength Mon/Tue/Fri, solo intervals Wed, run club easy run Thu evening
// and long run Sun morning.
export const DEFAULT_LAYOUT = Object.freeze(['runLong', 'gymA', 'gymB', 'runQuality', 'runEasy', 'gymC', 'rest']);
export const DEFAULT_CLUB_RUNS = Object.freeze(['runEasy', 'runLong']);

// Monday-first order, used for display and for ordering sessions in time.
export const DAY_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 0]);
export const DAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const DAY_NAMES_LONG = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

// Returns an error message, or null when every session appears exactly once.
export function validateLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== 7) return 'The week needs exactly seven days.';
  const unknown = layout.find((kind) => !LAYOUT_OPTIONS.includes(kind));
  if (unknown !== undefined) return `Unknown session: ${String(unknown)}`;
  const count = (kind) => layout.filter((k) => k === kind).length;
  const missing = SESSION_KINDS.find((kind) => count(kind) === 0);
  if (missing) return `${KIND_LABELS[missing]} isn't on any day.`;
  const doubled = SESSION_KINDS.find((kind) => count(kind) > 1);
  if (doubled) return `${KIND_LABELS[doubled]} is on more than one day.`;
  return null;
}

const LEG_HEAVY = Object.freeze(['gymA', 'gymC']);
const LEG_SENSITIVE = Object.freeze({ runLong: 'long run', runQuality: 'quality run' });

// Advice only: heavy leg days straight before the runs that need fresh legs.
export function layoutWarnings(layout) {
  return Object.entries(LEG_SENSITIVE).flatMap(([kind, label]) => {
    const day = layout.indexOf(kind);
    const before = layout[(day + 6) % 7];
    return LEG_HEAVY.includes(before)
      ? [`${KIND_LABELS[before]} is the day before your ${label}; its heavy leg work may leave you flat.`]
      : [];
  });
}

const planOf = ({ layout = DEFAULT_LAYOUT, clubRuns = DEFAULT_CLUB_RUNS, swaps = {} } = {}) => ({ layout, clubRuns, swaps });

export const isDeloadWeek = (week) => DELOAD_WEEKS.includes(week);

export function weekPhase(week) {
  if (week === TEST_WEEK) return 'Test week';
  if (isDeloadWeek(week)) return 'Deload';
  return 'Build';
}

export const GYM_WARM_UP = '5 min easy on the erg, then 2 rounds of 10 band pull-aparts, 10 bodyweight squats and 5 inchworms. Do 2–3 lighter ramp-up sets before your first lift.';
export const GYM_COOL_DOWN = '5 min mobility: couch stretch 45 s each side, 10 ankle rocks each side, 8 open books each side, then a 30 s dead hang from the bar.';

const item = (exercise, sets, reps, extra = {}) => ({ exercise, sets, reps, rir: 2, rest: 90, ...extra });

const GYM_SESSIONS = Object.freeze({
  gymA: {
    title: 'Strength A',
    subtitle: 'Jumps, squat, pull-ups, legs',
    items: [
      item('broadJump', 3, [5, 5], { rest: 60, rir: null }),
      item('backSquat', 3, [6, 8], { rest: 150 }),
      item('pullUp', null, null, { rest: 120, plan: 'pullUp' }),
      item('inclineDbPress', 3, [8, 12]),
      item('bulgarianSplitSquat', 2, [8, 10]),
      item('facePull', 2, [15, 20], { rest: 60 }),
      item('calfRaise', 3, [10, 15], { rest: 60 }),
    ],
  },
  gymB: {
    title: 'Strength B',
    subtitle: 'Bench, dips, upper body',
    items: [
      item('pogoHops', 3, [20, 20], { rest: 45, rir: null }),
      item('benchPress', 3, [6, 8], { rest: 150 }),
      item('dbRow', 3, [8, 12]),
      item('dip', null, null, { rest: 120, plan: 'dip', startWeight: 5 }),
      item('chinUpNegative', 3, [3, 3], { rest: 90 }),
      item('lateralRaise', 3, [12, 15], { rest: 60 }),
      item('curlTriceps', 2, [10, 15], { rest: 60 }),
      item('hangingKneeRaise', 3, [8, 12], { rest: 60 }),
    ],
  },
  gymC: {
    title: 'Strength C',
    subtitle: 'Deadlift, press, hamstrings, carries',
    items: [
      item('deadlift', 3, [4, 6], { rest: 180, rir: 3 }),
      item('overheadPress', 3, [6, 8], { rest: 150 }),
      item('chinUp', 3, [4, 8], { rest: 120 }),
      item('nordicCurl', 3, [4, 6], { rest: 90, rir: null }),
      item('reverseLunge', 2, [8, 10]),
      item('kbSwing', 3, [15, 15], { rest: 60 }),
      item('farmerCarry', 3, [40, 40], { rest: 90 }),
      item('sidePlank', 2, [30, 45], { rest: 45 }),
    ],
  },
});

// Weekly bodyweight progressions; index = week number, 'test' = one all-out set.
const PLANS = Object.freeze({
  pullUp: [null, [5, 3], [6, 3], [5, 4], [3, 3], [6, 4], [5, 5], [6, 5], [3, 4], [6, 5], [5, 6], [6, 6], 'test'],
  dip: [null,
    [3, 10], [3, 11], [3, 12], [2, 10], [3, 13], [3, 15],
    { sets: 3, reps: [8, 10], weighted: true }, [2, 10],
    { sets: 3, reps: [8, 10], weighted: true }, { sets: 3, reps: [8, 10], weighted: true },
    { sets: 3, reps: [8, 10], weighted: true }, 'test'],
});

const loadFlags = (exerciseId) => {
  const { load, barbell, maxLoad } = EXERCISES[exerciseId];
  return {
    weighted: load === 'weight' || load === 'optional',
    optionalLoad: load === 'optional',
    barbell: Boolean(barbell),
    maxLoad: maxLoad ?? null,
  };
};

// `slot` is the planned exercise; it stays the same when an alternative is swapped in.
function resolveItem(gymItem, week) {
  const base = { ...gymItem, slot: gymItem.exercise, ...loadFlags(gymItem.exercise) };
  if (gymItem.plan) {
    const step = PLANS[gymItem.plan][week];
    if (step === 'test') {
      return { ...base, sets: 1, reps: null, rir: 0, test: true, weighted: false, note: 'Test: one all-out set of strict reps after warming up.' };
    }
    if (Array.isArray(step)) return { ...base, sets: step[0], reps: [step[1], step[1]], weighted: false };
    return { ...base, sets: step.sets, reps: step.reps, weighted: true };
  }
  if (!isDeloadWeek(week)) return base;
  return { ...base, sets: Math.max(2, base.sets - 1), rir: base.rir === null ? null : 4 };
}

// Swaps keep the slot's sets, reps and rest. Ladder items keep the ladder's own
// weighted flag; other items take the load style of the new exercise.
function swapItem(gymItem, exerciseId) {
  const flags = loadFlags(exerciseId);
  return gymItem.plan
    ? { ...gymItem, exercise: exerciseId, barbell: flags.barbell }
    : { ...gymItem, exercise: exerciseId, ...flags };
}

export function applySwaps(session, swaps = {}) {
  if (session.type !== 'gym') return session;
  const items = session.items.map((gymItem) => {
    const swapTo = swaps[gymItem.slot];
    const allowed = EXERCISES[gymItem.slot].alternatives ?? [];
    return swapTo && allowed.includes(swapTo) ? swapItem(gymItem, swapTo) : gymItem;
  });
  return { ...session, items };
}

const WARM_UP = Object.freeze({ label: 'Warm-up', detail: '2 km easy', zone: 'easy' });
const COOL_DOWN = Object.freeze({ label: 'Cool-down', detail: '1.5 km easy', zone: 'easy' });
const STRIDES = Object.freeze({ label: 'Strides', detail: '6 × 20 s quick and relaxed, walk back to recover', zone: null });
const mainSet = (detail, zone) => [WARM_UP, { label: 'Main set', detail, zone }, COOL_DOWN];
const easyRun = (km) => ({ label: 'Run', detail: `${km} km easy, conversational`, zone: 'easy' });

const QUALITY = [null,
  { title: 'Intervals', km: 7, steps: mainSet('6 × 2 min, 2 min easy jog between', 'interval') },
  { title: 'Threshold', km: 7, steps: mainSet('3 × 6 min, 2 min easy jog between', 'threshold') },
  { title: 'Intervals', km: 8, steps: mainSet('8 × 400 m, 90 s easy jog between', 'interval') },
  { title: 'Easy + strides', km: 5, steps: [easyRun(5), STRIDES] },
  { title: 'Intervals', km: 8, steps: mainSet('5 × 3 min, 2 min easy jog between', 'interval') },
  { title: 'Threshold', km: 8, steps: mainSet('2 × 12 min, 3 min easy jog between', 'threshold') },
  { title: 'Intervals', km: 8, steps: mainSet('4 × 1 km, 2 min easy jog between', 'interval') },
  { title: 'Easy + strides', km: 6, steps: [easyRun(6), STRIDES] },
  { title: 'Threshold', km: 8, steps: [WARM_UP, { label: 'Main set', detail: '20 min continuous', zone: 'threshold' }, { ...COOL_DOWN, detail: '2 km easy' }] },
  { title: 'Intervals', km: 9, steps: mainSet('5 × 1 km, 90 s easy jog between', 'interval') },
  { title: 'Threshold', km: 10, steps: mainSet('3 × 10 min, 2 min easy jog between', 'threshold') },
  {
    title: '5 km time trial', km: 8, test: true,
    steps: [
      { label: 'Warm-up', detail: '2 km easy plus 4 strides', zone: 'easy' },
      { label: 'Time trial', detail: '5 km, hard but evenly paced. Update your 5 km time in Settings afterwards.', zone: 'interval' },
      { label: 'Cool-down', detail: '1 km easy', zone: 'easy' },
    ],
  },
];

const EASY_KM = [null, 5, 5, 6, 5, 6, 6, 7, 5, 7, 7, 7, 6];
const LONG_KM = [null, 8, 9, 10, 7, 11, 12, 13, 9, 14, 15, 16, 10];
const LONG_FINISH = Object.freeze({ 7: 2, 10: 2, 11: 3 });
const FUEL_FROM_KM = 14;

// Run club versions: the club's 5 km becomes the week's quality session, with an
// effort target that can be run inside the club run itself.
const CLUB_KM = 5;
const CLUB_QUALITY_KM = 8;
const CLUB_BEFORE = Object.freeze({ label: 'Before', detail: '1.5–2 km easy on the way, plus a few strides', zone: 'easy' });
const CLUB_AFTER = Object.freeze({ label: 'After', detail: '1 km easy jog', zone: 'easy' });
const GROUP_NOTE = Object.freeze({ label: 'Note', detail: 'If the club runs as one group, stay with them and keep it controlled. The targets are for when you can run your own pace.', zone: null });

const CLUB_QUALITY = [null,
  { name: 'fartlek', detail: '6 × 1 min surges at 5 km pace, 2 min steady between', zone: 'interval' },
  { name: 'tempo', detail: 'Km 1 easy, km 2–4 at threshold, km 5 easy', zone: 'threshold' },
  { name: 'fartlek', detail: '8 × 1 min surges at 5 km pace, 90 s steady between', zone: 'interval' },
  { name: 'easy', detail: 'Chatty pace the whole way. Deload week.', zone: 'easy', deload: true },
  { name: 'fartlek', detail: '5 × 2 min at 5 km pace, 2 min steady between', zone: 'interval' },
  { name: 'tempo', detail: 'Km 1 easy, km 2–5 at threshold', zone: 'threshold' },
  { name: 'fartlek', detail: '4 × 3 min at 5 km pace, 2 min steady between', zone: 'interval' },
  { name: 'easy', detail: 'Chatty pace the whole way. Deload week.', zone: 'easy', deload: true },
  { name: 'tempo', detail: 'All 5 km at threshold: comfortably hard', zone: 'threshold' },
  { name: 'fartlek', detail: '5 × 3 min at 5 km pace, 90 s steady between', zone: 'interval' },
  { name: 'tempo', detail: '4 km at threshold, last km at 5 km pace', zone: 'threshold' },
  { name: 'time trial', detail: 'Run it all out, evenly paced. Update your 5 km time in Settings afterwards.', zone: 'interval', test: true },
];

function qualitySession(week, club) {
  if (!club) {
    const q = QUALITY[week];
    return { title: q.title, subtitle: 'Quality run · treadmill works well', plannedKm: q.km, steps: q.steps, test: Boolean(q.test) };
  }
  const q = CLUB_QUALITY[week];
  const clubStep = { label: 'Run club', detail: `5 km. ${q.detail}`, zone: q.zone };
  if (q.deload) {
    return { title: 'Run club · easy', subtitle: 'Run club 5 km', plannedKm: CLUB_KM, steps: [clubStep] };
  }
  const steps = q.test ? [CLUB_BEFORE, clubStep, CLUB_AFTER] : [CLUB_BEFORE, clubStep, CLUB_AFTER, GROUP_NOTE];
  return { title: `Run club · ${q.name}`, subtitle: 'Run club 5 km · quality session', plannedKm: CLUB_QUALITY_KM, steps, test: Boolean(q.test) };
}

function longSession(week, club) {
  const km = LONG_KM[week];
  const finish = LONG_FINISH[week];
  const first = club
    ? { label: 'Run club', detail: `Pick the route closest to ${km} km. Up to ${km + 3} km is fine at easy pace; if it's shorter, add easy km before or after.`, zone: 'easy' }
    : easyRun(km);
  const steps = [first];
  if (finish) steps.push({ label: 'Finish', detail: `Run the last ${finish} km at threshold pace`, zone: 'threshold' });
  if (km >= FUEL_FROM_KM) steps.push({ label: 'Fuel', detail: 'Carry water; take a gel or sweets after about 60 min', zone: null });
  return club
    ? { title: 'Run club · long run', subtitle: `Aim for ${km} km at easy pace`, plannedKm: km, steps }
    : { title: 'Long run', subtitle: `${km} km, easy pace`, plannedKm: km, steps };
}

// Club easy runs come in 5 km and 10 km routes; the 10 km arrives once the
// block is well established, after the week 8 deload.
const CLUB_EASY_KM = [null, 5, 5, 5, 5, 5, 5, 5, 5, 10, 10, 10, 5];

function runSession(kind, week, club) {
  if (kind === 'runQuality') return qualitySession(week, club);
  if (kind === 'runLong') return longSession(week, club);
  if (club) {
    const km = CLUB_EASY_KM[week];
    const step = { label: 'Run club', detail: `${km} km route at easy, conversational pace. Drop into a slower group if you need to.`, zone: 'easy' };
    return { title: 'Run club · easy', subtitle: `${km} km route, conversational pace`, plannedKm: km, steps: [step] };
  }
  const km = EASY_KM[week];
  const steps = isDeloadWeek(week) ? [easyRun(km)] : [easyRun(km), STRIDES];
  return { title: 'Easy run', subtitle: `${km} km, conversational pace`, plannedKm: km, steps };
}

// Logs are keyed by session, not weekday, so a session can move days without losing its log.
export const sessionKey = (week, kind) => `w${week}-${kind}`;

export function parseSessionKey(key) {
  const match = /^w(\d{1,2})-([A-Za-z]+)$/.exec(key ?? '');
  if (!match || !SESSION_KINDS.includes(match[2])) return null;
  return { week: Number(match[1]), kind: match[2] };
}

function assertWeek(week) {
  if (!Number.isInteger(week) || week < 1 || week > PROGRAMME_WEEKS) {
    throw new RangeError(`Week must be between 1 and ${PROGRAMME_WEEKS}`);
  }
}

export function getSession(week, kind, { club = false } = {}) {
  assertWeek(week);
  if (!SESSION_KINDS.includes(kind)) throw new RangeError(`Unknown session: ${kind}`);
  const base = { key: sessionKey(week, kind), week, kind, phase: weekPhase(week) };
  if (kind.startsWith('gym')) {
    const gym = GYM_SESSIONS[kind];
    return {
      ...base, type: 'gym', title: gym.title, subtitle: gym.subtitle,
      warmUp: GYM_WARM_UP, coolDown: GYM_COOL_DOWN, items: gym.items.map((i) => resolveItem(i, week)),
    };
  }
  return { ...base, type: 'run', club, ...runSession(kind, week, club) };
}

export function sessionOnDay(week, weekday, settings) {
  assertWeek(week);
  const { layout, clubRuns, swaps } = planOf(settings);
  const kind = layout[weekday];
  if (kind === undefined) throw new RangeError('Weekday must be between 0 and 6');
  if (kind === 'rest') {
    return { key: null, week, weekday, kind, type: 'rest', phase: weekPhase(week), title: 'Rest day', subtitle: 'Walk, stretch, sleep well' };
  }
  return { ...applySwaps(getSession(week, kind, { club: clubRuns.includes(kind) }), swaps), weekday };
}

export function sessionFromKey(key, settings) {
  const parsed = parseSessionKey(key);
  if (!parsed || parsed.week < 1 || parsed.week > PROGRAMME_WEEKS) return null;
  const { layout, clubRuns, swaps } = planOf(settings);
  const session = getSession(parsed.week, parsed.kind, { club: clubRuns.includes(parsed.kind) });
  return { ...applySwaps(session, swaps), weekday: layout.indexOf(parsed.kind) };
}

export const weekSessions = (week, settings) => DAY_ORDER.map((weekday) => sessionOnDay(week, weekday, settings));

export const plannedKm = (week, settings) =>
  weekSessions(week, settings).reduce((sum, s) => sum + (s.plannedKm ?? 0), 0);

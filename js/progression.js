import { isDeloadWeek, parseSessionKey } from './programme.js';

// Double progression: stay at a weight until every set reaches the top of the
// rep range, then add the exercise's increment and start again at the bottom.
// Two stalled sessions in a row drop the weight ~10% to build back up.

const BAR_KG = 20;
const PLATE_STEP_KG = 2.5;
const STALL_DROP = 0.9;
const WARM_UP_FROM_KG = 30;
// [fraction of working weight, reps]; 0 = the empty bar.
const WARM_UP_RAMP = Object.freeze([[0, 8], [0.5, 5], [0.7, 3], [0.85, 1]]);

const roundTo = (kg, step) => Math.round(kg / step) * step;
export const roundToHalf = (kg) => roundTo(kg, 0.5);

// Epley estimate, used only for progress charts.
export const estimateOneRepMax = (weight, reps) =>
  weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;

export const completedSets = (sets = []) =>
  sets.filter((set) => set && set.done && Number(set.reps) > 0);

const describeWeight = (kg) => (kg > 0 ? `${kg} kg` : 'bodyweight');
const workingWeight = (performance) => Math.max(...performance.sets.map((set) => Number(set.weight) || 0));

// Latest non-deload weeks before `beforeWeek` with ticked sets for this exercise, newest first.
// Each exercise belongs to one session, so the week alone orders its history.
export function findRecentPerformances(logs, exerciseId, beforeWeek, count = 1) {
  return Object.entries(logs)
    .map(([key, log]) => ({ position: parseSessionKey(key), log }))
    .filter(({ position }) => position && position.week < beforeWeek && !isDeloadWeek(position.week))
    .sort((a, b) => b.position.week - a.position.week)
    .map(({ position, log }) => ({ ...position, sets: completedSets(log?.sets?.[exerciseId]) }))
    .filter((performance) => performance.sets.length)
    .slice(0, count);
}

export const findLastPerformance = (logs, exerciseId, beforeWeek) =>
  findRecentPerformances(logs, exerciseId, beforeWeek, 1)[0] ?? null;

function firstTimeAdvice(item) {
  if (item.startWeight) return { weight: item.startWeight, reason: `Start with ${item.startWeight} kg added.` };
  if (item.optionalLoad) return { weight: null, reason: 'Bodyweight to start. Add a dumbbell once every set reaches the top of the range.' };
  if (item.barbell) {
    return {
      weight: null,
      reason: 'Find your weight: 8 reps with the empty bar, then add 5–10 kg at a time for sets of 5 until 5 reps feels like you could do 5 more. Use that for your working sets.',
    };
  }
  return { weight: null, reason: 'First session: pick a weight that leaves about 2 reps in reserve at the top of the range. Adjust after the first set.' };
}

const missedBottom = (performance, min) => performance.sets.some((set) => Number(set.reps) < min);

export function suggestLoad({ item, increment, last, previous = null, deload = false }) {
  if (!item.weighted || !item.reps) return null;
  const [min, max] = item.reps;
  if (!last) return firstTimeAdvice(item);

  const working = workingWeight(last);
  if (working === 0 && item.startWeight) {
    return { weight: item.startWeight, reason: `Time to add load: start with ${item.startWeight} kg.` };
  }
  if (deload) {
    return { weight: working, reason: 'Deload: same weight, fewer sets, stop well short of failure.' };
  }

  const reachedTop = last.sets.length >= item.sets && last.sets.every((set) => Number(set.reps) >= max);
  if (reachedTop && increment > 0) {
    const next = roundToHalf(working + increment);
    if (item.maxLoad && next > item.maxLoad) {
      return {
        weight: working,
        reason: `You're on the heaviest dumbbells (${item.maxLoad} kg). Progress by adding a rep each set or taking 3 seconds on the way down, or swap to an alternative under "How to do it".`,
      };
    }
    return { weight: next, reason: `Every set hit ${max} last time, so add ${increment} kg.` };
  }
  if (missedBottom(last, min)) {
    const stalled = previous && working > 0 && workingWeight(previous) === working && missedBottom(previous, min);
    if (stalled) {
      const dropped = roundTo(working * STALL_DROP, increment > 0 ? increment : 0.5);
      return { weight: dropped, reason: `Stuck at ${working} kg for two sessions. Drop to ${dropped} kg and build back up.` };
    }
    return { weight: working, reason: `Some sets fell short of ${min}. Repeat ${describeWeight(working)}.` };
  }
  return { weight: working, reason: `Same weight. Aim for one more rep per set, up to ${max}.` };
}

// Barbell ramp-up before the working sets, skipping steps that round to the same load.
export function warmUpSets(workingKg) {
  if (!(workingKg >= WARM_UP_FROM_KG)) return [];
  return WARM_UP_RAMP
    .map(([fraction, reps]) => ({
      weight: fraction === 0 ? BAR_KG : Math.max(BAR_KG, roundTo(workingKg * fraction, PLATE_STEP_KG)),
      reps,
    }))
    .filter((set, i, all) => i === 0 || set.weight > all[i - 1].weight);
}

// Weekly ladders (pull-ups, dips): if last time fell short of that week's target,
// repeat that target instead of moving up.
export function adaptLadder(item, previousItem, last) {
  if (!item.plan || item.test || !previousItem || previousItem.test || !last) return { item, note: null };
  const target = previousItem.reps[0];
  const missed = last.sets.length < previousItem.sets || last.sets.some((set) => Number(set.reps) < target);
  if (!missed) return { item, note: null };
  return {
    item: { ...item, sets: previousItem.sets, reps: previousItem.reps, weighted: previousItem.weighted },
    note: `Last time fell short of ${previousItem.sets} × ${target}. Repeat it this week before moving up.`,
  };
}

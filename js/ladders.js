// Calisthenics progressions. Each ladder runs from an easier to a harder variation;
// hit the top of the target range on every set and the next session moves up a level.
// `reps` are seconds for holds (see each exercise's unit).

const level = (exercise, min, max) => Object.freeze({ exercise, reps: [min, max] });

export const LADDERS = Object.freeze({
  planche: {
    name: 'Planche', skill: true, start: 0,
    levels: [level('plancheLean', 15, 30), level('frogStand', 15, 30), level('tuckPlanche', 5, 15), level('advTuckPlanche', 5, 15), level('straddlePlanche', 3, 10)],
  },
  frontLever: {
    name: 'Front lever', skill: true, start: 0,
    levels: [level('tuckFrontLever', 8, 15), level('advTuckFrontLever', 8, 15), level('oneLegFrontLever', 6, 12), level('straddleFrontLever', 5, 10), level('frontLever', 3, 8)],
  },
  muscleUp: {
    name: 'Muscle-up', skill: true, start: 0,
    levels: [level('chestToBarPullUp', 3, 5), level('explosivePullUp', 3, 5), level('muscleUpNegative', 2, 4), level('bandMuscleUp', 2, 4), level('muscleUp', 1, 3)],
  },
  lSit: {
    name: 'L-sit', skill: true, start: 0,
    levels: [level('tuckLSit', 10, 20), level('oneLegLSit', 10, 20), level('lSit', 10, 20)],
  },
  push: {
    name: 'Push-up', start: 1,
    levels: [level('inclinePushUp', 10, 20), level('pushUp', 8, 15), level('diamondPushUp', 8, 15), level('pseudoPlanchePushUp', 6, 12), level('archerPushUp', 5, 10)],
  },
  pike: {
    name: 'Handstand push-up', start: 0,
    levels: [level('pikePushUp', 6, 12), level('elevatedPikePushUp', 6, 12), level('wallHspuNegative', 3, 6), level('wallHspu', 3, 8)],
  },
  row: {
    name: 'Row', start: 1,
    levels: [level('bentKneeRow', 8, 15), level('invertedRow', 8, 12), level('feetElevatedRow', 8, 12), level('archerRow', 5, 10), level('tuckFrontLeverRow', 4, 8)],
  },
  singleLegSquat: {
    name: 'Pistol squat', start: 1,
    levels: [level('splitSquatBw', 10, 15), level('bulgarianSplitSquatBw', 10, 15), level('boxPistol', 5, 10), level('assistedPistol', 5, 8), level('pistolSquat', 3, 8)],
  },
  shrimp: {
    name: 'Shrimp squat', start: 0,
    levels: [level('reverseLungeBw', 10, 15), level('beginnerShrimp', 5, 10), level('shrimpSquat', 5, 8), level('advancedShrimp', 3, 6)],
  },
  nordic: {
    name: 'Nordic curl', start: 0,
    levels: [level('bandNordic', 4, 6), level('nordicCurl', 3, 6), level('nordicFull', 2, 5)],
  },
  hipThrust: {
    name: 'Hip thrust', start: 1,
    levels: [level('gluteBridge', 12, 20), level('singleLegGluteBridge', 10, 15), level('singleLegHipThrust', 8, 15)],
  },
  legRaise: {
    name: 'Leg raise', start: 0,
    levels: [level('hangingKneeRaise', 8, 12), level('hangingLegRaise', 6, 12), level('toesToBar', 5, 10)],
  },
});

// The saved level for a ladder, or its starting level, kept within range.
export function levelIndex(id, levels = {}) {
  const ladder = LADDERS[id];
  const saved = levels[id];
  const index = Number.isInteger(saved) ? saved : ladder.start;
  return Math.min(Math.max(index, 0), ladder.levels.length - 1);
}

const completed = (sets = []) => sets.filter((set) => set?.done && Number(set.reps) > 0);

// Ladders whose every planned set reached the top of the range move up one level.
export function ladderLevelUps(items, log, levels = {}) {
  const updates = {};
  const promoted = [];
  for (const item of items) {
    if (!item.ladder || !item.nextExercise) continue;
    const sets = completed(log.sets?.[item.exercise]);
    if (sets.length < item.sets || !sets.every((set) => Number(set.reps) >= item.reps[1])) continue;
    updates[item.ladder] = item.level + 1;
    promoted.push(item.nextExercise);
  }
  return { levels: { ...levels, ...updates }, promoted };
}

// Exercise library for a home rack: barbell and plates, dumbbells 2–25 kg,
// kettlebells 2–16 kg, bench, bands, pull-up bar and dip station.
//
// load: 'weight' = always loaded, 'optional' = bodyweight until it gets easy,
//       'bodyweight' = bodyweight only, 'none' = no load to log (bands, jumps, holds).
// alternatives: exercises that can be swapped in from the exercise card.

// Fixed-pair dumbbells go up in 2.5 kg steps to 25 kg. Barbell steps use the 0.5 kg plates:
// 1 kg jumps on overhead press, 2 kg on bench, 2.5 kg on squat and deadlift.
const DUMBBELL_MAX_KG = 25;

export const EXERCISES = Object.freeze({
  // Main lifts
  backSquat: { name: 'Back squat', load: 'weight', barbell: true, increment: 2.5, alternatives: ['frontSquat', 'gobletSquat'], cue: 'Brace hard, sit down between your hips, knees track over toes. Set the rack safeties just below your bottom position.' },
  benchPress: { name: 'Bench press', load: 'weight', barbell: true, increment: 2, alternatives: ['dbBenchPress', 'pushUp'], cue: 'Shoulder blades pinned, feet planted. Touch low chest, press up and slightly back. Use the safeties.' },
  deadlift: { name: 'Deadlift', load: 'weight', barbell: true, increment: 2.5, alternatives: ['romanianDeadlift', 'singleLegRdl'], cue: 'Bar over mid-foot, push the floor away, hips and shoulders rise together. Reset every rep.' },
  overheadPress: { name: 'Standing overhead press', load: 'weight', barbell: true, increment: 1, alternatives: ['dbShoulderPress'], cue: 'Squeeze glutes, ribs down. Press in a straight line and push your head through at the top.' },

  // Bodyweight pulling and pushing
  pullUp: { name: 'Strict pull-up', load: 'bodyweight', alternatives: ['chinUp', 'bandedPullUp'], cue: 'Overhand grip, dead hang to chin over the bar, no kipping. Split sets are fine; never grind to failure.' },
  chinUp: { name: 'Chin-up', load: 'bodyweight', alternatives: ['pullUp', 'bandedPullUp'], cue: 'Underhand, shoulder-width. Stop each set about 2 reps before failure.' },
  chinUpNegative: { name: 'Chin-up negative', load: 'bodyweight', alternatives: ['bandedPullUp'], cue: 'Step up to chin-over-bar, then lower for a slow 5-second count to a dead hang.' },
  dip: { name: 'Dip', load: 'optional', increment: 2.5, alternatives: ['pushUp'], cue: 'Slight forward lean, lower until shoulders are just below elbows. When weighted, grip a dumbbell between your feet.' },

  // Accessories
  inclineDbPress: { name: 'Incline dumbbell press', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, alternatives: ['inclineBenchPress', 'pushUp'], cue: 'Bench at about 30°. Lower to upper chest with elbows around 45°.' },
  dbRow: { name: 'One-arm dumbbell row', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, alternatives: ['barbellRow', 'invertedRow'], cue: 'Hand and knee on the bench. Pull your elbow towards your hip and pause.' },
  bulgarianSplitSquat: { name: 'Bulgarian split squat', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, alternatives: ['splitSquat', 'stepUp'], cue: 'Rear foot on the bench, torso tall, dumbbells at your sides. Control the way down.' },
  reverseLunge: { name: 'Dumbbell reverse lunge', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, alternatives: ['stepUp', 'splitSquat'], cue: 'Step back, lightly touch the back knee down, drive up through the front heel.' },
  facePull: { name: 'Band face pull', load: 'none', alternatives: ['bandPullApart', 'rearDeltFly'], cue: 'Pull the band to your forehead, elbows high, squeeze the back of the shoulders.' },
  calfRaise: { name: 'Single-leg calf raise', load: 'optional', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, cue: 'Off a step or plate: full stretch, pause at the top. Hold a dumbbell once 15 reps is easy.' },
  lateralRaise: { name: 'Dumbbell lateral raise', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Lean slightly forward, raise to shoulder height leading with the elbows.' },
  curlTriceps: { name: 'DB curl + overhead triceps', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Superset: a set of curls straight into overhead extensions, then rest.' },
  hangingKneeRaise: { name: 'Hanging knee raise', load: 'none', alternatives: ['lyingLegRaise'], cue: 'Hang from the bar and curl knees to chest without swinging.' },
  kbSwing: { name: 'Kettlebell swing', load: 'weight', increment: 0, cue: 'Hinge, snap the hips, let the bell float to chest height. Arms are just ropes. Use the 16 kg.' },
  farmerCarry: { name: 'Farmer carry', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, unit: 'm', alternatives: ['suitcaseCarry'], cue: 'Heaviest dumbbells you can hold, stand tall, short quick steps.' },
  sidePlank: { name: 'Side plank', load: 'none', unit: 's', perSide: true, alternatives: ['pallofPress'], cue: 'Straight line from ankles to head; push the floor away.' },
  deadBug: { name: 'Dead bug', load: 'none', perSide: true, cue: 'Lower back pressed into the floor. Slowly extend opposite arm and leg.' },

  // Power and running resilience
  broadJump: { name: 'Broad jump', load: 'none', alternatives: ['squatJump'], cue: 'Swing the arms, jump forward as far as you can and land softly with knees over toes. Walk back and reset; every rep should be crisp.' },
  pogoHops: { name: 'Pogo hops', load: 'none', unit: 's', cue: 'Small, fast bounces on the balls of your feet with stiff ankles and soft knees. Builds springy legs for running.' },
  nordicCurl: { name: 'Nordic hamstring curl', load: 'none', alternatives: ['singleLegRdl', 'hamstringWalkout'], cue: 'Kneel on a pad with your heels hooked under a loaded barbell. Lower your body forward as slowly as you can, catch yourself with your hands, push back up. A band from the rack to your chest makes it easier.' },

  // Alternatives
  frontSquat: { name: 'Front squat', load: 'weight', barbell: true, increment: 2.5, cue: 'Bar on the front of the shoulders, elbows high, sit straight down.' },
  gobletSquat: { name: 'Goblet squat', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Hold a dumbbell or kettlebell at your chest, elbows inside the knees at the bottom.' },
  dbBenchPress: { name: 'Dumbbell bench press', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Shoulder blades pinned, lower the dumbbells to chest level, press up and slightly together.' },
  pushUp: { name: 'Push-up', load: 'optional', increment: 5, cue: 'Body in a straight line, chest to the floor. Once it gets easy, wear a backpack with a plate in it.' },
  romanianDeadlift: { name: 'Romanian deadlift', load: 'weight', barbell: true, increment: 2.5, cue: 'Soft knees, push the hips back and slide the bar down the thighs until you feel the hamstrings, then stand tall.' },
  singleLegRdl: { name: 'Single-leg Romanian deadlift', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, cue: 'Dumbbell in the opposite hand, hinge on one leg with hips square, reach the back leg long.' },
  dbShoulderPress: { name: 'Seated dumbbell shoulder press', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Bench upright, press the dumbbells overhead without arching your back.' },
  bandedPullUp: { name: 'Band-assisted pull-up', load: 'bodyweight', cue: 'Loop a band over the bar and under one knee or foot. Full range, controlled lowering.' },
  inclineBenchPress: { name: 'Incline bench press', load: 'weight', barbell: true, increment: 2, cue: 'Bench at about 30°, lower the bar to the upper chest, press up over the shoulders.' },
  barbellRow: { name: 'Barbell row', load: 'weight', barbell: true, increment: 2.5, cue: 'Hinge to about 45°, pull the bar to your lower ribs, keep the back flat.' },
  invertedRow: { name: 'Inverted row', load: 'bodyweight', cue: 'Bar in the rack at hip height, body straight underneath, pull your chest to the bar.' },
  splitSquat: { name: 'Dumbbell split squat', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, cue: 'Staggered stance, drop the back knee straight down, drive up through the front foot.' },
  stepUp: { name: 'Dumbbell step-up', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, perSide: true, cue: 'Step onto the bench and stand tall using the top leg only; lower slowly.' },
  bandPullApart: { name: 'Band pull-apart', load: 'none', cue: 'Arms straight at shoulder height, pull the band apart to your chest, squeeze the shoulder blades.' },
  rearDeltFly: { name: 'Bent-over rear delt fly', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, cue: 'Hinge forward, light dumbbells, raise out to the sides leading with the elbows.' },
  lyingLegRaise: { name: 'Lying leg raise', load: 'none', cue: 'Lower back pressed down, lower straight legs slowly, stop before your back arches.' },
  suitcaseCarry: { name: 'Suitcase carry', load: 'weight', increment: 2.5, maxLoad: DUMBBELL_MAX_KG, unit: 'm', perSide: true, cue: 'One heavy dumbbell, walk tall without leaning towards it. Swap hands each length.' },
  pallofPress: { name: 'Band Pallof press', load: 'none', perSide: true, cue: 'Band anchored to the side at chest height, press it straight out and hold 2 seconds without twisting.' },
  squatJump: { name: 'Squat jump', load: 'none', cue: 'Quarter squat, jump straight up as high as you can, land softly and reset between reps.' },
  hamstringWalkout: { name: 'Hamstring bridge walk-out', load: 'none', cue: 'From a glute bridge, walk the heels out in small steps keeping hips high, then walk back in.' },
});

// Bodyweight progressions for the calisthenics plan (see ladders.js). Holds are logged in seconds.
// Planche and front lever work loads wrists, elbows and shoulders: warm them up and move up slowly.

const bw = (name, cue, extra = {}) => ({ name, load: 'bodyweight', cue, ...extra });
const hold = (name, cue, extra = {}) => bw(name, cue, { unit: 's', ...extra });

export const CALISTHENICS_EXERCISES = Object.freeze({
  // Planche
  plancheLean: hold('Planche lean', 'Push-up position, arms straight, fingers turned out. Lean your shoulders forward past your hands and push the floor away. Warm up your wrists first.'),
  frogStand: hold('Frog stand', 'Squat down, hands flat, knees resting on the backs of your upper arms. Lean forward until your feet lift, and balance.'),
  tuckPlanche: hold('Tuck planche', 'Straight arms, knees tucked to your chest, hips level with shoulders, feet off the floor. Push the floor away and round your upper back.'),
  advTuckPlanche: hold('Advanced tuck planche', 'As the tuck planche but with a flat back and hips opened, knees below the hips.'),
  straddlePlanche: hold('Straddle planche', 'Straight arms, body horizontal, legs straight and wide. Lean far forward over your hands.'),

  // Front lever
  tuckFrontLever: hold('Tuck front lever', 'Hang from the bar, pull your shoulders down and back, then lift into a tuck: knees to chest, back flat and parallel to the floor.'),
  advTuckFrontLever: hold('Advanced tuck front lever', 'As the tuck, but open the hips so your back is flat and the knees are bent at 90°.'),
  oneLegFrontLever: hold('One-leg front lever', 'One leg straight and one tucked, body horizontal under the bar. Swap legs each set.'),
  straddleFrontLever: hold('Straddle front lever', 'Body horizontal, legs straight and wide, arms locked, shoulders pulled down.'),
  frontLever: hold('Front lever', 'Body straight and horizontal under the bar, legs together, arms locked.'),

  // Muscle-up
  chestToBarPullUp: bw('Chest-to-bar pull-up', 'Pull until your chest touches the bar, driving the elbows down and back.'),
  explosivePullUp: bw('Explosive pull-up', 'Pull as fast and high as you can, aiming to bring your waist towards the bar. Lower under control.'),
  muscleUpNegative: bw('Muscle-up negative', 'Jump to the top of a straight-bar dip, then lower slowly through the transition into a dead hang.'),
  bandMuscleUp: bw('Band-assisted muscle-up', 'Loop a band over the bar under your knees or feet. Pull explosively, lean your chest over the bar and press out.'),
  muscleUp: bw('Muscle-up', 'False grip, explosive pull to the waist, lean your chest over the bar and press to straight arms.'),

  // L-sit
  tuckLSit: hold('Tuck L-sit', 'On the dip bars (or parallettes or the floor), arms locked and shoulders pushed down, knees tucked up to your chest.'),
  oneLegLSit: hold('One-leg L-sit', 'As the tuck L-sit with one leg straight out in front. Swap legs each set.'),
  lSit: hold('L-sit', 'Arms locked, shoulders down, both legs straight out level with the hips, toes pointed.'),

  // Push
  inclinePushUp: bw('Incline push-up', 'Hands on the bench, body straight from head to heels, chest to the bench edge.'),
  diamondPushUp: bw('Diamond push-up', 'Hands together under your chest, thumbs and index fingers touching, elbows close to your sides.'),
  pseudoPlanchePushUp: bw('Pseudo planche push-up', 'Hands by your hips, fingers turned out, shoulders leaning forward past the hands throughout.'),
  archerPushUp: bw('Archer push-up', 'Wide hands; lower towards one hand while the other arm stays straight. Alternate sides.', { perSide: true }),

  // Pike and handstand
  pikePushUp: bw('Pike push-up', 'Hips high in an inverted V, lower the top of your head towards a point in front of your hands.'),
  elevatedPikePushUp: bw('Elevated pike push-up', 'Feet on the bench, hips stacked over the shoulders, head to the floor in front of your hands.'),
  wallHspuNegative: bw('Wall handstand push-up negative', 'Kick up to a handstand facing away from the wall, lower your head to a folded towel over 3–5 seconds, come down.'),
  wallHspu: bw('Wall handstand push-up', 'Handstand against the wall, lower your head to a folded towel and press back up.'),

  // Rows
  bentKneeRow: bw('Bent-knee inverted row', 'Bar in the rack at hip height, knees bent and feet flat. Pull your chest to the bar.'),
  feetElevatedRow: bw('Feet-elevated inverted row', 'Feet on the bench, body straight, pull your chest to the bar.'),
  archerRow: bw('Archer row', 'Pull towards one hand while the other arm straightens along the bar. Alternate sides.', { perSide: true }),
  tuckFrontLeverRow: bw('Tuck front lever row', 'From a tuck front lever, pull the bar towards your hips, keeping the body horizontal.'),

  // Single-leg squats
  splitSquatBw: bw('Split squat', 'Staggered stance, drop the back knee straight down, drive up through the front foot.', { perSide: true }),
  bulgarianSplitSquatBw: bw('Bulgarian split squat (bodyweight)', 'Rear foot on the bench, torso tall, control the way down.', { perSide: true }),
  boxPistol: bw('Box pistol', 'On one leg, sit back to the bench with the other leg out in front, then stand without rocking.', { perSide: true }),
  assistedPistol: bw('Assisted pistol squat', 'Hold the rack upright lightly and squat all the way down on one leg; use the hands as little as possible.', { perSide: true }),
  pistolSquat: bw('Pistol squat', 'On one leg, the other straight in front, squat all the way down and stand. Arms forward for balance.', { perSide: true }),

  // Shrimp squats
  reverseLungeBw: bw('Reverse lunge', 'Step back, lightly touch the back knee down, drive up through the front heel.', { perSide: true }),
  beginnerShrimp: bw('Beginner shrimp squat', 'On one leg, hold the other foot behind you and lower until the back knee touches a pad or folded mat.', { perSide: true }),
  shrimpSquat: bw('Shrimp squat', 'As the beginner shrimp squat without the pad: back knee touches the floor.', { perSide: true }),
  advancedShrimp: bw('Advanced shrimp squat', 'Hold the back foot with both hands behind you; knee to the floor and back up.', { perSide: true }),

  // Hamstrings and glutes
  bandNordic: bw('Band-assisted Nordic curl', 'Heels hooked under a loaded barbell, band from the rack to your chest. Lower as slowly as you can and push back up with your hands.'),
  nordicFull: bw('Nordic curl', 'Lower all the way under control and pull yourself back up with your hamstrings, barely using the hands.'),
  gluteBridge: bw('Glute bridge', 'On your back, feet flat, drive your hips up and squeeze your glutes at the top.'),
  singleLegGluteBridge: bw('Single-leg glute bridge', 'As the glute bridge with one leg held straight. Keep the hips level.', { perSide: true }),
  singleLegHipThrust: bw('Single-leg hip thrust', 'Shoulders on the bench, one foot planted, drive the hips up to level and pause.', { perSide: true }),

  // Core and grip
  hangingLegRaise: bw('Hanging leg raise', 'Hang from the bar, raise straight legs to hip height without swinging.'),
  toesToBar: bw('Toes to bar', 'Hang from the bar and lift your feet all the way to touch it, controlling the swing.'),
  deadHang: hold('Dead hang', 'Hang from the bar with shoulders active, not shrugged up to your ears. Builds grip and healthy shoulders.'),
});

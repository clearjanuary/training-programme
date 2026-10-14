# Train · 12-week running + strength programme

An iPhone web app for a hybrid block: three full-body strength sessions in the
garage gym and three runs a week. Free to run: plain HTML/CSS/JS, no build step,
no accounts. Data stays on the phone (localStorage) with JSON backup/restore.

## The programme

Goals: lasting strength, more muscle and faster running, for an intermediate
runner with a home rack, barbell, dumbbells, kettlebells and a pull-up bar.

Default week (change it in Settings → Weekly layout):

| Day | Session | What |
|-----|---------|------|
| Mon | Strength A | Back squat, pull-ups, incline DB press, Bulgarian split squat, face pulls, calf raises, dead bugs |
| Tue | Strength B | Bench, one-arm DB row, dips, chin-up negatives, lateral raises, curls/triceps, hanging knee raises |
| Wed | Quality run | Intervals or threshold, alternating weekly (treadmill friendly) |
| Thu | Run club easy | 5 km route; 10 km route in weeks 9–11. Conversational pace |
| Fri | Strength C | Deadlift, overhead press, chin-ups, reverse lunges, KB swings, farmer carries, side planks |
| Sat | Rest | Or Strength C, if Friday didn't happen |
| Sun | Run club long run | Pick the route closest to the week's target (8 → 16 km) |

- **Custom layout:** put each session on any day. Logs belong to the session,
  not the weekday, so moving days never loses a log. A missed session waits under
  "Still to log this week" on Today.
- **Run club:** tick whether the quality run and/or long run happen at run club.
  Untick to get the solo treadmill/road versions instead.

- **Weeks 4 and 8** are deloads (one fewer set, same weights, easier runs).
- **Week 12** retests the 5 km (Thursday), max pull-ups and max dips.
- **Running** builds from 20 to 33 km/week. Paces come from your 5 km time
  (Settings); threshold sits near current 10 km pace because endurance is the
  bigger gap at the moment.
- **Lifting** uses double progression: hit the top of the rep range on every
  set and the app suggests the next weight. Pull-ups and dips follow a fixed
  weekly ladder; dips become weighted (dumbbell between the feet) from week 7.

The programme lives in [`js/programme.js`](js/programme.js), so sessions, sets,
reps and run distances can all be edited there.

## Wearables

Without paid Apple tools a web app can't read Apple Health, so runs are logged by:

1. **GPX/TCX import:** export the activity from Garmin Connect, Polar Flow or
   Strava, save it to Files, then pick it on the run screen. Distance, time
   and average heart rate are filled in.
2. **Manual entry:** distance, time, heart rate and effort.

## Import runs with an Apple Shortcut

Garmin Connect, Polar Flow and Whoop can all write workouts to Apple Health
(turn on Health syncing in each app). A Shortcut can then send the latest run
to Train in one tap. **Untested on a real phone yet:** the Health actions in
Shortcuts vary between iOS versions, so build it once and try it.

1. Open **Shortcuts** → **+** → name it "Log run".
2. Add **Find Health Samples** → type **Workouts** (if your iOS doesn't list
   Workouts, use **Walking + Running Distance** for today instead), sort by
   **Start Date**, **Latest First**, **Limit 1**.
3. From that result, get the **Distance** (in km), **Duration** (in minutes)
   and, if offered, **Average Heart Rate**. **Get Details of Health Sample** does this.
4. Add **Open URLs** with the app's address plus:
   `#/import-run?km=[Distance]&min=[Duration]&hr=[Heart Rate]&src=Garmin`
   (Settings in the app shows the exact address to use).
5. Run the shortcut after a run (or add it to your Home Screen). Train opens,
   shows the run, and asks which session it belongs to.

The link also accepts `m=` (metres) and `sec=` (seconds); `hr` and `src` are
optional. Settings → "Try a test import" shows what a working link does.

## Run it locally

```bash
node "/Users/Mark/Documents/Phoenix Code/Clear January/Clear January/.claude/static-server.js" "/Users/Mark/Documents/Phoenix Code/training-programme" 4323
```

Then open http://localhost:4323. On an iPhone on the same Wi-Fi, use
`http://<your-mac's-IP>:4323` to try it (offline mode needs HTTPS, see below).

## Put it on your iPhone (free)

1. Push this folder to a GitHub repository and turn on **GitHub Pages**
   (Settings → Pages → deploy from the main branch). That gives a free HTTPS URL.
2. Open the URL in Safari → Share → **Add to Home Screen**.
3. It opens full screen and works offline in the garage.

Export a backup from Settings every few weeks: the log lives only on the phone.

## Tests

```bash
npm test
npm run coverage
```

The programme, paces, schedule, progression, storage, stats and import maths are
unit tested with Node's built-in test runner (no dependencies).

## Notes

`icons/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `touch-icon.png`,
`app-192.png` and `app-512.png` are unused earlier renders that the sandbox
couldn't overwrite. The live icons are the `-v2` files and `icon.svg`. The
old ones are safe to delete.

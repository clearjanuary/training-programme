import { weekSessions } from './programme.js';
import { programmePosition, parseISODate, dateForSession, dayNumber } from './schedule.js';
import { withLog, withExtra, newExtraId } from './store.js';

// Turns Strava activities into session logs or extra runs.
// A run matches the run session planned that day, or one planned the day before that
// is still unlogged (a late session). It never claims a future session, so an extra
// run on Wednesday can't take Thursday's run club slot.

const RUN_SPORTS = Object.freeze(['Run', 'TrailRun', 'VirtualRun']);
const LATE_BY_DAYS = 1;
const MAX_NAME = 120;
const HR_RANGE = Object.freeze([30, 230]);

export function toRun(activity) {
  const hr = activity.average_heartrate;
  return {
    stravaId: String(activity.id),
    name: String(activity.name ?? '').slice(0, MAX_NAME),
    // start_date_local is local wall-clock time despite its trailing "Z".
    date: String(activity.start_date_local).slice(0, 10),
    distanceKm: Math.round(activity.distance / 10) / 100,
    durationSec: Math.round(activity.moving_time),
    avgHr: Number.isFinite(hr) && hr >= HR_RANGE[0] && hr <= HR_RANGE[1] ? Math.round(hr) : null,
  };
}

function importedIds(state) {
  const ids = new Set();
  for (const log of Object.values(state.logs)) if (log?.run?.stravaId) ids.add(String(log.run.stravaId));
  for (const extra of state.extras ?? []) if (extra.stravaId) ids.add(String(extra.stravaId));
  return ids;
}

export function planStravaImports(activities, state) {
  const { settings } = state;
  const known = importedIds(state);
  const claimed = new Set();
  return [...activities]
    .filter((a) => RUN_SPORTS.includes(a.sport_type) && !known.has(String(a.id)))
    .sort((a, b) => String(a.start_date_local).localeCompare(String(b.start_date_local)))
    .map(toRun)
    .filter((run) => run.distanceKm > 0 && run.durationSec > 0)
    .flatMap((run) => {
      const date = parseISODate(run.date);
      const position = date && programmePosition(date, settings.startDate);
      if (position?.status !== 'active') return [];
      const daysLate = (s) => dayNumber(date) - dayNumber(dateForSession(settings.startDate, s.week, s.weekday));
      const open = weekSessions(position.week, settings)
        .filter((s) => s.type === 'run' && !state.logs[s.key]?.done && !claimed.has(s.key));
      const target = open.find((s) => daysLate(s) === 0) ?? open.find((s) => daysLate(s) === LATE_BY_DAYS);
      if (target) claimed.add(target.key);
      return [{ run, key: target?.key ?? null }];
    });
}

export function applyStravaImports(state, plans) {
  return plans.reduce((next, { run, key }) => {
    const numbers = { distanceKm: run.distanceKm, durationSec: run.durationSec, avgHr: run.avgHr };
    if (!key) {
      return withExtra(next, {
        id: newExtraId(), date: run.date, type: 'run', ...numbers, notes: run.name, stravaId: run.stravaId,
      });
    }
    const { skipped, skipReason, ...existing } = next.logs[key] ?? {};
    return withLog(next, key, {
      ...existing,
      done: true,
      date: run.date,
      run: { ...numbers, rpe: null, notes: run.name, source: 'Strava', stravaId: run.stravaId },
    });
  }, state);
}

export function summariseImports(plans) {
  const matched = plans.filter((p) => p.key).length;
  const extras = plans.length - matched;
  const parts = [matched && `${matched} matched to sessions`, extras && `${extras} as extra runs`].filter(Boolean);
  return `Synced ${plans.length} run${plans.length === 1 ? '' : 's'} from Strava: ${parts.join(', ')}.`;
}

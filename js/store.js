import { parseDuration } from './paces.js';
import {
  DEFAULT_LAYOUT, DEFAULT_CLUB_RUNS, CLUB_KINDS, EXTRA_TYPES, validateLayout, sessionKey, parseSessionKey,
} from './programme.js';

// All data lives on the phone in localStorage. State is never mutated:
// every helper returns a new object, and the repository persists it.

export const STORAGE_KEY = 'training-programme/v1';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Early saves keyed logs by weekday ("w3-d1") on this fixed week; they are
// moved onto session keys ("w3-gymA") when loaded.
const LEGACY_KEY = /^w(\d{1,2})-d([0-6])$/;
const LEGACY_LAYOUT = Object.freeze(['runLong', 'gymA', 'runEasy', 'gymB', 'runQuality', 'gymC', 'rest']);

export const DEFAULT_SETTINGS = Object.freeze({
  startDate: null, fiveK: '24:00', layout: DEFAULT_LAYOUT, clubRuns: DEFAULT_CLUB_RUNS, lastBackup: null,
});

export const createState = (settings = {}) => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS, layout: [...DEFAULT_LAYOUT], clubRuns: [...DEFAULT_CLUB_RUNS], ...settings },
  logs: {},
  extras: [],
});

export const withSettings = (state, patch) => ({ ...state, settings: { ...state.settings, ...patch } });
export const withLog = (state, key, log) => ({ ...state, logs: { ...state.logs, [key]: log } });
export const withoutLogs = (state) => ({ ...state, logs: {}, extras: [] });
export const withExtra = (state, extra) => ({ ...state, extras: [...(state.extras ?? []), extra] });
export const withoutExtra = (state, id) => ({ ...state, extras: (state.extras ?? []).filter((e) => e.id !== id) });

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const newExtraId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const MAX_EXTRA_KM = 100;
const MAX_EXTRA_SECONDS = 24 * 3600;
const HR_RANGE = Object.freeze([30, 230]);
const MAX_NOTES = 500;

// Returns an error message, or null for a valid extra activity.
export function validateExtra(extra) {
  if (!isPlainObject(extra)) return 'Not an activity.';
  if (typeof extra.id !== 'string' || !extra.id) return 'The activity is missing its id.';
  if (!ISO_DATE.test(extra.date ?? '')) return 'Pick a valid date.';
  if (!Object.hasOwn(EXTRA_TYPES, extra.type)) return 'Pick an activity type.';
  if (!(Number.isInteger(extra.durationSec) && extra.durationSec > 0 && extra.durationSec <= MAX_EXTRA_SECONDS)) {
    return 'Enter the time it took.';
  }
  const km = extra.distanceKm;
  if (km === null || km === undefined) {
    if (extra.type === 'run') return 'Enter the distance you ran.';
  } else if (!(km > 0 && km <= MAX_EXTRA_KM)) {
    return 'Enter a distance between 0 and 100 km.';
  }
  const hr = extra.avgHr;
  if (hr !== null && hr !== undefined && !(hr >= HR_RANGE[0] && hr <= HR_RANGE[1])) {
    return `Heart rate should be between ${HR_RANGE[0]} and ${HR_RANGE[1]}.`;
  }
  if (extra.notes !== undefined && (typeof extra.notes !== 'string' || extra.notes.length > MAX_NOTES)) {
    return 'Notes are too long.';
  }
  return null;
}

function validateExtras(extras = []) {
  if (!Array.isArray(extras)) throw new Error('The backup has unreadable extra activities.');
  const bad = extras.map(validateExtra).find(Boolean);
  if (bad) throw new Error(`The backup has an invalid extra activity: ${bad}`);
  return extras.map((e) => ({ ...e }));
}

function migrateKey(key) {
  const match = LEGACY_KEY.exec(key);
  if (!match) return key;
  const kind = LEGACY_LAYOUT[Number(match[2])];
  return kind === 'rest' ? null : sessionKey(Number(match[1]), kind);
}

function validateSettings(settings) {
  if (!isPlainObject(settings)) throw new Error('The backup is missing its settings.');
  if (settings.startDate !== null && !ISO_DATE.test(settings.startDate ?? '')) {
    throw new Error('The backup has an invalid start date.');
  }
  if (parseDuration(settings.fiveK) === null) throw new Error('The backup has an invalid 5 km time.');
  const layout = settings.layout ?? DEFAULT_LAYOUT;
  const layoutError = validateLayout(layout);
  if (layoutError) throw new Error(`The backup has an invalid weekly layout. ${layoutError}`);
  const clubRuns = settings.clubRuns ?? DEFAULT_CLUB_RUNS;
  if (!Array.isArray(clubRuns) || clubRuns.some((kind) => !CLUB_KINDS.includes(kind))) {
    throw new Error('The backup has invalid run club settings.');
  }
  const lastBackup = settings.lastBackup ?? null;
  if (lastBackup !== null && !ISO_DATE.test(lastBackup)) throw new Error('The backup has an invalid backup date.');
  return {
    startDate: settings.startDate, fiveK: settings.fiveK, layout: [...layout], clubRuns: [...clubRuns], lastBackup,
  };
}

// Checks anything read from storage or an imported backup before it is trusted.
export function validateState(raw) {
  if (!isPlainObject(raw)) throw new Error('This is not a training backup file.');
  const settings = validateSettings(raw.settings);
  if (!isPlainObject(raw.logs)) throw new Error('The backup is missing its session logs.');
  const entries = Object.entries(raw.logs)
    .map(([key, log]) => [migrateKey(key), log, key])
    .filter(([key]) => key !== null);
  const bad = entries.find(([key, log]) => !parseSessionKey(key) || !isPlainObject(log));
  if (bad) throw new Error(`The backup has an unreadable session: ${bad[2]}`);
  return {
    version: 1,
    settings,
    logs: Object.fromEntries(entries.map(([key, log]) => [key, log])),
    extras: validateExtras(raw.extras),
  };
}

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function browserStorage() {
  try {
    const storage = globalThis.localStorage;
    storage.getItem(STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

export function createRepository(storage = browserStorage() ?? memoryStorage(), logger = console) {
  return {
    load() {
      const text = storage.getItem(STORAGE_KEY);
      if (!text) return { state: null, error: null };
      try {
        return { state: validateState(JSON.parse(text)), error: null };
      } catch (error) {
        logger.error('Saved training data could not be read; a copy was kept.', error);
        storage.setItem(`${STORAGE_KEY}/corrupt`, text);
        return { state: null, error };
      }
    },
    save(state) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (error) {
        logger.error('Training data could not be saved.', error);
        return false;
      }
    },
  };
}

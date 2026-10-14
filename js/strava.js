import { parseISODate } from './schedule.js';

// Address of the Cloudflare Worker (worker/strava-worker.js). Empty until it's
// deployed; the Strava features stay hidden until then.
export const STRAVA_WORKER_URL = '';

// Kept apart from the training log so the Strava token never ends up in backups.
const STORAGE_KEY = 'training-programme/strava';
const SYNC_OVERLAP_SECONDS = 3 * 86_400;
const AUTO_SYNC_MS = 30 * 60 * 1000;
const CLAIM_WINDOW_MS = 10 * 60 * 1000;
const STATE_BYTES = 24;

export const stravaAvailable = () => Boolean(STRAVA_WORKER_URL);

export function loadStrava() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function saveStrava(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Could not save the Strava connection.', error);
  }
}

export const isStravaConnected = () => stravaAvailable() && Boolean(loadStrava().refreshToken);

export function disconnectStrava() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Could not remove the Strava connection.', error);
  }
}

const randomState = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(STATE_BYTES))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Opens Strava's approval page. The Worker parks the result under a one-time code
// that the app collects when it's next in front (see finishStravaConnect).
export function startStravaConnect() {
  const state = randomState();
  saveStrava({ ...loadStrava(), pending: { state, at: Date.now() } });
  window.location.href = `${STRAVA_WORKER_URL}/auth?state=${state}`;
}

async function post(path, body) {
  const response = await fetch(`${STRAVA_WORKER_URL}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `Strava request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Resolves to the athlete's name once connected, or null if there's nothing to collect yet.
export async function finishStravaConnect() {
  const stored = loadStrava();
  if (!stravaAvailable() || !stored.pending) return null;
  if (Date.now() - stored.pending.at > CLAIM_WINDOW_MS) {
    saveStrava({ refreshToken: stored.refreshToken, name: stored.name, lastSync: stored.lastSync });
    return null;
  }
  try {
    const { refresh_token: refreshToken, name } = await post('/claim', { state: stored.pending.state });
    saveStrava({ refreshToken, name, lastSync: null });
    return name || 'Strava';
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// Recent Strava activities since the last sync (with a few days' overlap), or null if not connected.
export async function fetchStravaActivities(startDate) {
  const stored = loadStrava();
  if (!stravaAvailable() || !stored.refreshToken) return null;
  const blockStart = Math.floor(parseISODate(startDate).getTime() / 1000);
  const after = stored.lastSync
    ? Math.max(blockStart, Math.floor(stored.lastSync / 1000) - SYNC_OVERLAP_SECONDS)
    : blockStart;
  try {
    const data = await post('/activities', { refresh_token: stored.refreshToken, after });
    saveStrava({ ...stored, refreshToken: data.refresh_token ?? stored.refreshToken, lastSync: Date.now() });
    return data.activities ?? [];
  } catch (error) {
    if (error.status === 401) disconnectStrava();
    throw error;
  }
}

export const stravaAutoSyncDue = () => {
  const { refreshToken, lastSync } = loadStrava();
  return stravaAvailable() && Boolean(refreshToken) && (!lastSync || Date.now() - lastSync > AUTO_SYNC_MS);
};

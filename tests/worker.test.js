import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/strava-worker.js';

const APP_URL = 'https://clearjanuary.github.io/training-programme/';
const STATE = 'abcdefghijklmnopqrstuvwxyz012345';

function memoryKv() {
  const map = new Map();
  return {
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
    map,
  };
}

let env;
let realFetch;
let calls;

beforeEach(() => {
  env = { APP_URL, STRAVA_CLIENT_ID: '12345', STRAVA_CLIENT_SECRET: 'secret', STRAVA_PENDING: memoryKv() };
  calls = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/oauth/token')) {
      return Response.json({ access_token: 'access', refresh_token: 'new-refresh', athlete: { firstname: 'Mark' } });
    }
    return Response.json([
      { id: 1, name: 'Run', sport_type: 'Run', start_date_local: '2026-10-15T18:30:00Z', distance: 5000, moving_time: 1500, average_heartrate: 140, private_note: 'x' },
    ]);
  };
});

afterEach(() => { globalThis.fetch = realFetch; });

const request = (path, init) => new Request(`https://train-strava.example.workers.dev${path}`, init);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

test('/auth redirects to Strava with the state and read scope', async () => {
  const response = await worker.fetch(request(`/auth?state=${STATE}`), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://www.strava.com');
  assert.equal(location.searchParams.get('state'), STATE);
  assert.equal(location.searchParams.get('scope'), 'activity:read_all');
  assert.equal(location.searchParams.get('client_id'), '12345');
});

test('/auth rejects a missing or malformed state', async () => {
  assert.equal((await worker.fetch(request('/auth?state=short'), env)).status, 400);
});

test('/callback swaps the code for a token and parks it for the app to claim once', async () => {
  const page = await worker.fetch(request(`/callback?code=abc&state=${STATE}&scope=read,activity:read_all`), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /connected/i);
  const tokenCall = calls.find((c) => c.url.endsWith('/oauth/token'));
  assert.match(String(tokenCall.init.body), /client_secret=secret/);

  const claimed = await worker.fetch(post('/claim', { state: STATE }), env);
  assert.deepEqual(await claimed.json(), { refresh_token: 'new-refresh', name: 'Mark' });
  assert.equal((await worker.fetch(post('/claim', { state: STATE }), env)).status, 404);
});

test('/callback without activity access explains what went wrong', async () => {
  const page = await worker.fetch(request(`/callback?code=abc&state=${STATE}&scope=read`), env);
  assert.equal(page.status, 400);
  assert.match(await page.text(), /activities/i);
});

test('/activities refreshes the token and returns only the fields the app needs', async () => {
  const response = await worker.fetch(post('/activities', { refresh_token: 'old', after: 1760000000 }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://clearjanuary.github.io');
  const body = await response.json();
  assert.equal(body.refresh_token, 'new-refresh');
  assert.deepEqual(Object.keys(body.activities[0]).sort(),
    ['average_heartrate', 'distance', 'id', 'moving_time', 'name', 'sport_type', 'start_date_local']);
  const listCall = calls.find((c) => c.url.includes('/athlete/activities'));
  assert.match(listCall.url, /after=1760000000/);
  assert.equal(listCall.init.headers.Authorization, 'Bearer access');
});

test('/activities rejects a request without a token', async () => {
  assert.equal((await worker.fetch(post('/activities', {}), env)).status, 400);
});

test('unknown paths are not found and preflight requests are allowed from the app only', async () => {
  assert.equal((await worker.fetch(request('/nope'), env)).status, 404);
  const preflight = await worker.fetch(request('/activities', { method: 'OPTIONS' }), env);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://clearjanuary.github.io');
});

// Cloudflare Worker for Train's Strava sync.
//
// It keeps the Strava client secret out of the app and stores nothing about your
// runs. The only thing it stores is a refresh token parked for up to 10 minutes
// after you approve Strava, until the app collects it with its one-time code.
// (On iPhone, a home-screen app and Safari keep separate storage, so the sign-in
// can't simply hand the token back through a redirect.)
//
// Environment: APP_URL and STRAVA_CLIENT_ID (vars), STRAVA_CLIENT_SECRET (secret),
// STRAVA_PENDING (KV namespace).

const STRAVA = 'https://www.strava.com';
const SCOPE = 'activity:read_all';
const STATE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const PENDING_TTL_SECONDS = 600;
const MAX_BODY_CHARS = 2048;
const PER_PAGE = 100;
const KEEP_FIELDS = Object.freeze([
  'id', 'name', 'sport_type', 'start_date_local', 'distance', 'moving_time', 'average_heartrate',
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const corsHeaders = (env) => ({
  'Access-Control-Allow-Origin': new URL(env.APP_URL).origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
});

const json = (body, status, env) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
});

// Titles and messages are fixed strings; APP_URL comes from the Worker's own config.
const page = (title, message, status, env) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<body style="font:17px/1.5 -apple-system,system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem">
<h1>${title}</h1><p>${message}</p><p><a href="${env.APP_URL}#/settings">Back to Train</a></p></body>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new HttpError(413, 'Request too large.');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

async function stravaToken(env, params) {
  const response = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params }),
  });
  if (response.status === 400 || response.status === 401) {
    throw new HttpError(401, 'Strava refused the connection. Reconnect Strava in Settings.');
  }
  if (!response.ok) throw new HttpError(502, 'Strava is not responding. Try again later.');
  return response.json();
}

function authorize(url, env) {
  const state = url.searchParams.get('state') ?? '';
  if (!STATE_PATTERN.test(state)) return new Response('Invalid state', { status: 400 });
  const target = new URL('/oauth/authorize', STRAVA);
  target.search = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: new URL('/callback', url.origin).href,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  }).toString();
  return Response.redirect(target.href, 302);
}

async function callback(url, env) {
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  if (url.searchParams.get('error') || !code || !STATE_PATTERN.test(state)) {
    return page('Not connected', 'Strava sign-in was cancelled. You can try again from Settings in Train.', 400, env);
  }
  const scopes = (url.searchParams.get('scope') ?? '').split(',');
  if (!scopes.includes(SCOPE)) {
    return page('Not connected', 'Train needs permission to read your activities. Try again and leave that box ticked.', 400, env);
  }
  const token = await stravaToken(env, { code, grant_type: 'authorization_code' });
  await env.STRAVA_PENDING.put(
    `pending:${state}`,
    JSON.stringify({ refresh_token: token.refresh_token, name: token.athlete?.firstname ?? '' }),
    { expirationTtl: PENDING_TTL_SECONDS },
  );
  return page('Strava connected', 'Go back to Train to finish; it picks up the connection automatically.', 200, env);
}

async function claim(request, env) {
  const { state } = await readJson(request);
  if (!STATE_PATTERN.test(state ?? '')) throw new HttpError(400, 'Invalid state.');
  const key = `pending:${state}`;
  const value = await env.STRAVA_PENDING.get(key);
  if (!value) throw new HttpError(404, 'Not ready yet.');
  await env.STRAVA_PENDING.delete(key);
  return JSON.parse(value);
}

async function activities(request, env) {
  const { refresh_token: refreshToken, after } = await readJson(request);
  if (typeof refreshToken !== 'string' || !refreshToken) throw new HttpError(400, 'Missing Strava token.');
  const token = await stravaToken(env, { grant_type: 'refresh_token', refresh_token: refreshToken });
  const list = new URL('/api/v3/athlete/activities', STRAVA);
  const query = { per_page: String(PER_PAGE) };
  if (Number.isInteger(after) && after > 0) query.after = String(after);
  list.search = new URLSearchParams(query).toString();
  const response = await fetch(list, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (response.status === 429) throw new HttpError(429, 'Strava is busy. Try again in a few minutes.');
  if (!response.ok) throw new HttpError(502, 'Could not read activities from Strava.');
  const raw = await response.json();
  return {
    refresh_token: token.refresh_token,
    activities: raw.map((a) => Object.fromEntries(KEEP_FIELDS.map((field) => [field, a[field] ?? null]))),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
      if (request.method === 'GET' && url.pathname === '/auth') return authorize(url, env);
      if (request.method === 'GET' && url.pathname === '/callback') return await callback(url, env);
      if (request.method === 'POST' && url.pathname === '/claim') return json(await claim(request, env), 200, env);
      if (request.method === 'POST' && url.pathname === '/activities') return json(await activities(request, env), 200, env);
      return new Response('Not found', { status: 404 });
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, env);
      console.error('Unexpected Worker error', error);
      return json({ error: 'Something went wrong.' }, 500, env);
    }
  },
};

import { createRepository, createState } from './store.js';
import { toISODate } from './schedule.js';
import { initRestTimer } from './timer.js';
import { keepScreenOn } from './wakelock.js';
import { esc } from './ui.js';
import { renderToday, bindToday } from './views/today.js';
import { renderPlan } from './views/plan.js';
import { renderSession, bindSession } from './views/session.js';
import { renderProgress, bindProgress } from './views/progress.js';
import {
  stravaAvailable, stravaAutoSyncDue, fetchStravaActivities, finishStravaConnect,
} from './strava.js';
import { planStravaImports, applyStravaImports, summariseImports } from './strava-sync.js';
import { renderSettings, bindSettings } from './views/settings.js';
import { renderWelcome, bindWelcome } from './views/welcome.js';
import { renderImportRun, bindImportRun } from './views/import-run.js';
import { renderExtra, bindExtra } from './views/extra.js';

const ROUTES = Object.freeze({
  welcome: { tab: null, render: renderWelcome, bind: bindWelcome },
  'import-run': { tab: 'today', render: renderImportRun, bind: bindImportRun },
  extra: { tab: 'today', render: renderExtra, bind: bindExtra },
  today: { tab: 'today', render: renderToday, bind: bindToday },
  plan: { tab: 'plan', render: renderPlan },
  session: { tab: 'today', render: renderSession, bind: bindSession },
  progress: { tab: 'progress', render: renderProgress, bind: bindProgress },
  settings: { tab: 'settings', render: renderSettings, bind: bindSettings },
});
const TOAST_MS = 3500;
const TOAST_MS_PER_CHAR = 60;

const repo = createRepository();
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let toastTimer = null;
let lastRenderedDay = '';
let state = loadInitialState();

function loadInitialState() {
  const { state: saved, error } = repo.load();
  if (error) queueMicrotask(() => toast('Saved data could not be read. A copy was kept — import a backup in Settings.'));
  // A state without a start date shows the welcome screen until one is chosen.
  return saved ?? createState();
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  // Longer messages (like layout advice) stay up long enough to read.
  const duration = Math.max(TOAST_MS, message.length * TOAST_MS_PER_CHAR);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, duration);
}

// "#/session/w3-gymA" → session view; "#/import-run?km=5&sec=1500" → import view with its query.
function parseRoute() {
  if (!state.settings.startDate) return { name: 'welcome', params: {} };
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, param] = path.split('/');
  return ROUTES[name] ? { name, params: { key: param, query } } : { name: 'today', params: { query } };
}

// Shared context handed to every view. `state` is a getter so handlers that
// run after a commit always see the latest state, never a stale copy.
const ctx = {
  get state() { return state; },
  get today() { return new Date(); },
  commit(next, { render: shouldRender = true } = {}) {
    state = next;
    if (!repo.save(state)) toast('Could not save. Storage may be full or disabled.');
    if (shouldRender) render();
  },
  navigate(hash) { location.hash = hash; },
  toast,
  syncStrava: () => runStravaSync(),
  finishStrava: () => collectStravaConnection({ announceWaiting: true }),
};

// Pulls new Strava runs and logs them against the matching sessions (or as extras).
// Planning happens after the fetch so it always uses the latest state.
async function runStravaSync({ quiet = false } = {}) {
  if (!stravaAvailable() || !state.settings.startDate) return;
  try {
    const activities = await fetchStravaActivities(state.settings.startDate);
    if (!activities) return;
    const plans = planStravaImports(activities, state);
    if (plans.length) {
      ctx.commit(applyStravaImports(state, plans));
      toast(summariseImports(plans));
    } else if (!quiet) {
      render();
      toast('No new runs on Strava.');
    }
  } catch (error) {
    console.error('Strava sync failed', error);
    if (error.status === 401) toast('Strava disconnected. Reconnect it in Settings.');
    else if (!quiet) toast(`Strava sync failed: ${error.message}`);
  }
}

async function collectStravaConnection({ announceWaiting = false } = {}) {
  try {
    const name = await finishStravaConnect();
    if (!name) {
      if (announceWaiting) toast('Not ready yet. Approve Train on the Strava page first.');
      return;
    }
    toast(`Connected to Strava as ${name}.`);
    render();
    await runStravaSync({ quiet: true });
  } catch (error) {
    console.error('Could not finish connecting Strava', error);
    toast('Could not finish connecting Strava. Try again from Settings.');
  }
}

function onForeground() {
  collectStravaConnection();
  if (stravaAutoSyncDue()) runStravaSync({ quiet: true });
}

function render() {
  const route = parseRoute();
  const view = ROUTES[route.name];
  const routeCtx = Object.create(ctx, { params: { value: route.params } });
  lastRenderedDay = toISODate(new Date());
  keepScreenOn(route.name === 'session');
  // The tabs can't go anywhere until a start date is chosen, so hide them on the welcome screen.
  document.body.classList.toggle('onboarding', route.name === 'welcome');
  try {
    app.innerHTML = `<div class="view view-${route.name}">${view.render(routeCtx)}</div>`;
    view.bind?.(app.firstElementChild, routeCtx);
  } catch (error) {
    console.error('View failed to render', error);
    app.innerHTML = `<div class="view"><section class="card"><h1>Something went wrong</h1>
      <p class="muted">${esc(error.message)}</p><a class="btn" href="#/today">Back to today</a></section></div>`;
  }
  document.querySelectorAll('.tabbar a').forEach((link) => {
    link.setAttribute('aria-current', link.dataset.tab === view.tab ? 'page' : 'false');
  });
}

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

// The app may stay open overnight on the home screen; refresh when the day changes.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (toISODate(new Date()) !== lastRenderedDay) render();
  onForeground();
});

initRestTimer();
render();
onForeground();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.error('Offline support unavailable', error));
}
navigator.storage?.persist?.().catch(() => {});

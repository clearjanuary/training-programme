import { sessionFromKey } from '../programme.js';
import { renderGym, bindGym } from './gym.js';
import { renderRun, bindRun } from './run.js';

const NOT_FOUND = `
  <section class="card">
    <h1>Session not found</h1>
    <p class="muted">That link doesn't match a session in this block.</p>
    <p class="actions"><a class="btn" href="#/today">Back to today</a></p>
  </section>`;

export function renderSession(ctx) {
  const session = sessionFromKey(ctx.params.key, ctx.state.settings);
  if (!session) return NOT_FOUND;
  return session.type === 'gym' ? renderGym(session, ctx) : renderRun(session, ctx);
}

export function bindSession(root, ctx) {
  root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else ctx.navigate('#/today');
  });
  const session = sessionFromKey(ctx.params.key, ctx.state.settings);
  if (session?.type === 'gym') bindGym(root, session, ctx);
  if (session?.type === 'run') bindRun(root, session, ctx);
}

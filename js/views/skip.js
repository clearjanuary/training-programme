import { withLog } from '../store.js';
import { toISODate } from '../schedule.js';
import { esc } from '../ui.js';

// Skipping marks a session as intentionally missed (ill, away), so it drops out of
// the catch-up list and doesn't count against adherence. It can be undone.

export const SKIP_REASONS = Object.freeze({
  ill: 'Ill or injured',
  away: 'Away or no time',
  rest: 'Needed the rest',
  other: 'Other',
});

export const clearSkip = ({ skipped, skipReason, ...log }) => log;

export function skipBanner(log) {
  if (!log?.skipped) return '';
  return `
    <section class="card notice">
      <h2 class="section-title">Skipped · ${esc(SKIP_REASONS[log.skipReason] ?? SKIP_REASONS.other)}</h2>
      <p class="muted small">It won't count against you. If you end up doing it, undo the skip or just log it below.</p>
      <p class="actions"><button type="button" class="btn" data-action="unskip">Undo skip</button></p>
    </section>`;
}

export function skipControl(log) {
  if (log?.done || log?.skipped) return '';
  const options = Object.entries(SKIP_REASONS).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
  return `
    <details class="card skip">
      <summary>Can't do this session?</summary>
      <label class="stack">Reason<select name="skipReason">${options}</select></label>
      <button type="button" class="btn block" data-action="skip">Skip this session</button>
    </details>`;
}

export function bindSkip(root, session, ctx) {
  root.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
    const reason = root.querySelector('[name="skipReason"]').value;
    const existing = ctx.state.logs[session.key] ?? {};
    ctx.commit(withLog(ctx.state, session.key, {
      ...existing, done: false, skipped: true, skipReason: reason, date: toISODate(new Date()),
    }));
    ctx.toast(`${session.title} skipped.`);
  });
  root.querySelector('[data-action="unskip"]')?.addEventListener('click', () => {
    ctx.commit(withLog(ctx.state, session.key, clearSkip(ctx.state.logs[session.key] ?? {})));
  });
}

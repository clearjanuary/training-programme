// Keeps the screen on during a session so the rest timer keeps running:
// iOS pauses web apps once the phone locks.

let wanted = false;
let sentinel = null;

async function acquire() {
  if (!wanted || sentinel || document.hidden || !('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch (error) {
    console.warn('Could not keep the screen on.', error);
  }
}

export function keepScreenOn(on) {
  wanted = on;
  if (on) {
    acquire();
    return;
  }
  sentinel?.release().catch(() => {});
  sentinel = null;
}

// The browser drops the lock whenever the page is hidden; take it back on return.
document.addEventListener('visibilitychange', acquire);

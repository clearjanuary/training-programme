import { formatDuration } from './paces.js';

// Rest timer that counts down to a fixed end time, so it stays accurate when
// the phone sleeps or Safari throttles timers in the background.

const TICK_MS = 250;
const DONE_BANNER_MS = 4000;
const EXTRA_SECONDS = 30;

let endAt = 0;
let intervalId = null;
let audioContext = null;

const bar = () => document.getElementById('rest-timer');
const remainingSeconds = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

function unlockAudio() {
  try {
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    audioContext ??= AudioCtor ? new AudioCtor() : null;
    audioContext?.resume?.();
  } catch {
    audioContext = null;
  }
}

function beep() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.5);
}

function hide() {
  if (intervalId) return;
  bar().hidden = true;
}

function stop() {
  clearInterval(intervalId);
  intervalId = null;
  hide();
}

function finish() {
  clearInterval(intervalId);
  intervalId = null;
  beep();
  navigator.vibrate?.(300);
  const el = bar();
  el.classList.add('is-done');
  el.querySelector('.rest-label').textContent = 'Rest over · next set';
  setTimeout(hide, DONE_BANNER_MS);
}

function tick() {
  const remaining = remainingSeconds();
  bar().querySelector('.rest-time').textContent = formatDuration(remaining);
  if (remaining === 0) finish();
}

export function startRest(seconds) {
  unlockAudio();
  endAt = Date.now() + seconds * 1000;
  const el = bar();
  el.hidden = false;
  el.classList.remove('is-done');
  el.querySelector('.rest-label').textContent = 'Rest';
  clearInterval(intervalId);
  intervalId = setInterval(tick, TICK_MS);
  tick();
}

export function initRestTimer() {
  bar().addEventListener('click', (event) => {
    const action = event.target.closest('[data-rest]')?.dataset.rest;
    if (action === 'add') startRest(remainingSeconds() + EXTRA_SECONDS);
    if (action === 'skip') stop();
  });
}

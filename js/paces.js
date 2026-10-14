// Training paces derived from a current 5 km time, in seconds per km.
// Offsets are added to 5 km race pace. Threshold sits near current 10 km pace,
// because endurance (10 km / half) lags behind 5 km speed at low weekly mileage.
export const ZONE_OFFSETS = Object.freeze({
  easy: [100, 135],
  threshold: [33, 43],
  interval: [0, 5],
});

export const ZONE_LABELS = Object.freeze({
  easy: 'Easy',
  threshold: 'Threshold',
  interval: '5 km pace',
});

const FIVE_K_KM = 5;
const pad = (n) => String(n).padStart(2, '0');

// Accepts "mm:ss" or "h:mm:ss". Returns whole seconds, or null if invalid.
export function parseDuration(text) {
  if (typeof text !== 'string') return null;
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, ...nums];
  if (s >= 60 || (nums.length === 3 && m >= 60)) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

export function formatDuration(totalSeconds) {
  const sec = Math.round(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const formatPace = (secPerKm) => formatDuration(secPerKm);

export function zonePaces(fiveKSeconds) {
  const racePace = fiveKSeconds / FIVE_K_KM;
  return Object.fromEntries(
    Object.entries(ZONE_OFFSETS).map(([zone, [fast, slow]]) => [
      zone,
      { fast: racePace + fast, slow: racePace + slow },
    ]),
  );
}

export function describeZone(zone, fiveKSeconds) {
  const pace = zonePaces(fiveKSeconds)[zone];
  if (!pace) return null;
  return `${formatPace(pace.fast)}–${formatPace(pace.slow)} /km`;
}

const FIVE_K_MINUTES = Object.freeze([12, 60]);

// Builds a "m:ss" 5 km time from form fields, or null if it's out of range.
export function fiveKFromParts(minutes, seconds) {
  const m = Number(minutes);
  const s = Number(seconds || 0);
  const valid = Number.isInteger(m) && Number.isInteger(s)
    && m >= FIVE_K_MINUTES[0] && m <= FIVE_K_MINUTES[1] && s >= 0 && s <= 59;
  return valid ? `${m}:${String(s).padStart(2, '0')}` : null;
}

export const paceOf = (distanceKm, durationSec) =>
  distanceKm > 0 ? durationSec / distanceKm : null;

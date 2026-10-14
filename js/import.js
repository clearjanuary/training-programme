// Reads GPX or TCX files exported from Garmin Connect, Polar Flow, Strava, etc.
// and summarises them into distance, duration and average heart rate.

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg) => (deg * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const average = (values) =>
  values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;

export function summarisePoints(points) {
  const timed = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.time));
  if (timed.length < 2) throw new Error('Not enough GPS points in this file.');
  let distanceKm = 0;
  for (let i = 1; i < timed.length; i += 1) distanceKm += haversineKm(timed[i - 1], timed[i]);
  return {
    distanceKm,
    durationSec: Math.round((timed[timed.length - 1].time - timed[0].time) / 1000),
    avgHr: average(timed.map((p) => p.hr).filter((hr) => Number.isFinite(hr) && hr > 0)),
  };
}

const byName = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
const childText = (el, name) => Array.from(el.children).find((c) => c.localName === name)?.textContent ?? null;
const firstText = (el, name) => byName(el, name)[0]?.textContent ?? null;

function parseTcx(doc) {
  const laps = byName(doc, 'Lap');
  const heartRates = byName(doc, 'HeartRateBpm').map((el) => Number(childText(el, 'Value')));
  const hr = average(heartRates.filter((v) => v > 0));
  if (laps.length) {
    const durationSec = laps.reduce((sum, lap) => sum + Number(childText(lap, 'TotalTimeSeconds') ?? 0), 0);
    const meters = laps.reduce((sum, lap) => sum + Number(childText(lap, 'DistanceMeters') ?? 0), 0);
    if (durationSec > 0 && meters > 0) return { distanceKm: meters / 1000, durationSec: Math.round(durationSec), avgHr: hr };
  }
  const points = byName(doc, 'Trackpoint').map((tp) => ({
    lat: Number(firstText(tp, 'LatitudeDegrees')),
    lon: Number(firstText(tp, 'LongitudeDegrees')),
    time: Date.parse(firstText(tp, 'Time')),
    hr: Number(firstText(tp, 'Value')),
  }));
  return summarisePoints(points);
}

function parseGpx(doc) {
  const points = byName(doc, 'trkpt').map((pt) => ({
    lat: Number(pt.getAttribute('lat')),
    lon: Number(pt.getAttribute('lon')),
    time: Date.parse(firstText(pt, 'time')),
    hr: Number(firstText(pt, 'hr')),
  }));
  return summarisePoints(points);
}

const MAX_KM = 100;
const MAX_SECONDS = 12 * 3600;
const HR_RANGE = Object.freeze([30, 230]);
const MAX_SOURCE_LENGTH = 40;

// Reads the query sent by an Apple Shortcut, e.g. "km=5.02&sec=1500&hr=148&src=Garmin".
// Distance as km or m (metres); time as sec or min (decimal minutes).
export function parseRunLink(query) {
  const params = new URLSearchParams(query);
  const number = (name) => (params.has(name) ? Number(params.get(name).replace(',', '.')) : NaN);
  const distanceKm = params.has('km') ? number('km') : number('m') / 1000;
  const seconds = params.has('sec') ? number('sec') : number('min') * 60;
  if (!(distanceKm > 0 && distanceKm <= MAX_KM)) throw new Error('The link has no usable distance.');
  if (!(seconds > 0 && seconds <= MAX_SECONDS)) throw new Error('The link has no usable time.');
  const hr = number('hr');
  const source = (params.get('src') ?? '').trim().slice(0, MAX_SOURCE_LENGTH) || 'Apple Health';
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationSec: Math.round(seconds),
    avgHr: hr >= HR_RANGE[0] && hr <= HR_RANGE[1] ? Math.round(hr) : null,
    source,
  };
}

export function parseActivity(text, DOMParserImpl = globalThis.DOMParser) {
  const doc = new DOMParserImpl().parseFromString(text, 'application/xml');
  if (byName(doc, 'parsererror').length) throw new Error('This file could not be read as GPX or TCX.');
  const root = doc.documentElement.localName;
  if (root === 'TrainingCenterDatabase') return { ...parseTcx(doc), source: 'TCX file' };
  if (root === 'gpx') return { ...parseGpx(doc), source: 'GPX file' };
  throw new Error('Unsupported file. Export the activity as GPX or TCX.');
}

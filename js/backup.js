import { toISODate } from './schedule.js';
import { withSettings } from './store.js';

function download(json, name) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Opens the iPhone share sheet (Save to Files / iCloud Drive) where supported,
// otherwise downloads the file. Resolves false if the person cancels.
export async function exportBackup(state) {
  const name = `training-backup-${toISODate(new Date())}.json`;
  const json = JSON.stringify(state, null, 2);
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Training backup' });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      console.error('Sharing the backup failed; downloading instead.', error);
    }
  }
  download(json, name);
  return true;
}

export const markBackedUp = (state) => withSettings(state, { lastBackup: toISODate(new Date()) });

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// Safari tabs and the home-screen app keep separate storage on iOS.
export const isIOSBrowserTab = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !isInstalled();

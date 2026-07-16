// Persistence for run progression. Primary path is localStorage; because some
// browsers block localStorage on file:// URLs, every save can also be exported
// as a copy-paste code and re-imported. Saves are versioned so the schema can
// evolve without loading garbage from an older build.

export const SAVE_VERSION = 1;
const KEY = 'grimhold_save';

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

export function hasSave() {
  return safe(() => !!localStorage.getItem(KEY), false);
}

export function writeSave(data) {
  return safe(() => {
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, ...data }));
    return true;
  }, false);
}

export function readSave() {
  return safe(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.v === SAVE_VERSION ? d : null;
  }, null);
}

export function clearSave() { safe(() => localStorage.removeItem(KEY), null); }

// Portable text code (works even where localStorage is blocked).
export function exportCode(data) {
  return safe(() => btoa(unescape(encodeURIComponent(JSON.stringify({ v: SAVE_VERSION, ...data })))), '');
}

export function importCode(code) {
  return safe(() => {
    const d = JSON.parse(decodeURIComponent(escape(atob((code || '').trim()))));
    return d && d.v === SAVE_VERSION ? d : null;
  }, null);
}

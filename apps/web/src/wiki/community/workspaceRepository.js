// @ts-check
import {STORAGE_KEY} from "./constants";

export const WORKSPACE_EVENT = "roco:community-updated";
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

/** This adapter owns browser JSON access; it never supplies a server UID or a formal publication. */
/** @param {Pick<Storage,'getItem'>|null} storage */
export function readDemoWorkspace(storage = typeof window === "undefined" ? null : window.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const value = /** @type {unknown} */(JSON.parse(raw));
  if (!isRecord(value)) throw new Error("Invalid local workspace");
  // Reading historic published records does not require current editor-only fields.
  // The writing adapter applies normalizeWorkspace; per-domain readers validate their own payloads.
  return {...value, submissions: Array.isArray(value.submissions) ? value.submissions.filter(isRecord) : []};
}

/** @param {unknown} value @param {Pick<Storage,'setItem'>} storage */
export function writeDemoWorkspace(value, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}

/** @param {(event: Event)=>void} listener @param {Window} view */
export function subscribeDemoWorkspace(listener, view = window) {
  const storage = /** @param {StorageEvent} event */ event => { if (event.key === null || event.key === STORAGE_KEY) listener(event); };
  view.addEventListener("storage", storage);
  view.addEventListener(WORKSPACE_EVENT, listener);
  return () => {
    view.removeEventListener("storage", storage);
    view.removeEventListener(WORKSPACE_EVENT, listener);
  };
}

/** Verify only the saved form fields, without mutating damaged browser data. */
export function draftPersisted(key, value, storageKey) {
  try {
    const workspace = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    const draft = Array.isArray(workspace?.drafts) ? workspace.drafts.find(row => row?.key === key) : null;
    if (!draft) return false;
    const fields = value.editorVersion === 7 ? ["typedData", "summary", "evidenceUrl", "evidenceNote"] : ["markdown", "fields", "summary", "evidenceUrl", "evidenceNote"];
    return fields.every(field => JSON.stringify(draft[field]) === JSON.stringify(value[field]));
  } catch { return false; }
}

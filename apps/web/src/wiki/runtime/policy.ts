// Production editing targets stable catalog IDs; unsupported UI modes never masquerade as server submissions.
import {editorKinds} from "../../../../../packages/wiki-schema/src/protocol";
export const WORKSPACE_MODES = ["server", "demo"];
export const SERVER_EDITOR_KINDS = editorKinds;
type Mode = 'server'|'demo';
type Page = {id:string;kind:string;slug:string;title:string};
type EditRequest = {page_id?:string;entity?:string;returnTo?:string;from?:string};

export function workspaceMode(value:unknown, fallback:Mode = "demo"):Mode {
  return value === 'server' || value === 'demo' ? value : fallback;
}

export function registeredEditTarget(pages:readonly Page[], request:EditRequest = {}) {
  const path = String(request.returnTo || request.from || "").split(/[?#]/)[0].replace(/\/$/, "");
  return pages.find(page => (SERVER_EDITOR_KINDS as readonly string[]).includes(page.kind) && (
    (request.page_id && page.id === request.page_id) ||
    path === `/wiki/${page.slug}` ||
    (!path && request.entity === page.title)
  )) || null;
}

export function formalWorkspaceHref(pages:readonly Page[], request:EditRequest = {}, tab = "edit") {
  const page = registeredEditTarget(pages, request);
  const query = new URLSearchParams({tab});
  if (page) query.set("page", page.id);
  return `/workbench/?${query}`;
}

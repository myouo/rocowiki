import { useCallback, useEffect, useState } from "react";
import {
  COMMUNITY_STORAGE_KEY, SOCIAL_STORAGE_KEY, SOCIAL_EVENT, UUID_RE,
  createUuid, drawCheckinReward, emptySocialState, normalizeSocialState, ensureProfileUuid, applySocialAction,
} from "./communitySocialModel";

function getStorage(provided) {
  return provided || (typeof window !== "undefined" ? window.localStorage : null);
}
function emitSocial() {
  if (typeof window !== "undefined") window.dispatchEvent(new window.CustomEvent(SOCIAL_EVENT));
}

/** One durable UUID per local profile. A real server will own identity assignment. */
export function readLocalIdentity({ storage: provided, uuidFactory = createUuid } = {}) {
  const fallback = { uuid: "", uid: "", nickname: "", avatar: "dimo", persisted: false, error: "" };
  let display = {};
  try {
    const storage = getStorage(provided);
    if (!storage) return fallback;
    const raw = storage.getItem(COMMUNITY_STORAGE_KEY);
    const workspace = raw ? JSON.parse(raw) : { version: 1, profile: {} };
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) throw new Error("invalid workspace");
    const profile = ensureProfileUuid(workspace.profile || {}, uuidFactory);
    display = { uid: profile.uid, nickname: typeof profile.nickname === "string" ? profile.nickname.slice(0, 24) : "", avatar: ["dimo", "haifu", "bishui", "sailemu"].includes(profile.avatar) ? profile.avatar : "dimo" };
    const changed = !UUID_RE.test(workspace.profile?.uuid || "");
    if (changed) storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify({ ...workspace, version: 1, profile }));
    return { uuid: profile.uuid, ...display, persisted: true, error: "" };
  } catch {
    return { ...fallback, ...display, error: "无法保存身份标识，请检查浏览器的本地存储权限后重试。" };
  }
}

export function readSocialState({ storage: provided } = {}) {
  try {
    const storage = getStorage(provided);
    if (!storage) return { state: emptySocialState(), error: "" };
    const raw = storage.getItem(SOCIAL_STORAGE_KEY);
    return { state: raw ? normalizeSocialState(JSON.parse(raw)) : emptySocialState(), error: "" };
  } catch {
    return { state: emptySocialState(), error: "无法读取社区记录，签到和兑换已暂停；请检查本地存储后重试。" };
  }
}

/** Re-read the latest durable state for every action; failed writes never update the visible wallet. */
export function socialAction(action, { storage: provided, now = new Date(), uuidFactory = createUuid, rewardFactory = drawCheckinReward } = {}) {
  let storage;
  try { storage = getStorage(provided); } catch { return { ok: false, code: "storage-failed", message: "无法访问本地存储，本次操作未保存。" }; }
  const identity = readLocalIdentity({ storage, uuidFactory });
  if (!identity.persisted) return { ok: false, code: "identity-unavailable", message: identity.error || "身份标识尚未就绪。" };
  const loaded = readSocialState({ storage });
  if (loaded.error) return { ok: false, code: "read-failed", message: loaded.error };
  let workspace;
  try { workspace = JSON.parse(storage.getItem(COMMUNITY_STORAGE_KEY) || "{}"); }
  catch { return { ok: false, code: "read-failed", message: "无法读取投稿身份，本次操作未保存。" }; }
  const result = applySocialAction(loaded.state, action, { identity, now, uuidFactory, rewardFactory, submissions: workspace.submissions || [] });
  if (!result.ok) return result;
  try { storage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(result.state)); }
  catch { return { ok: false, code: "storage-failed", message: "浏览器未能保存记录，本次操作未生效；余额与签到保持原值。" }; }
  emitSocial();
  return result;
}

export function useCommunitySocial() {
  const [state, setState] = useState(emptySocialState);
  const [identity, setIdentity] = useState({ uuid: "", uid: "", nickname: "", avatar: "dimo", persisted: false, error: "" });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    const localIdentity = readLocalIdentity();
    const loaded = readSocialState();
    setIdentity(localIdentity);
    setState(loaded.state);
    setError(localIdentity.error || loaded.error);
    setReady(true);
  }, []);
  useEffect(() => {
    refresh();
    const onStorage = event => { if (!event.key || [SOCIAL_STORAGE_KEY, COMMUNITY_STORAGE_KEY].includes(event.key)) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SOCIAL_EVENT, refresh);
    window.addEventListener("roco:community-updated", refresh);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(SOCIAL_EVENT, refresh); window.removeEventListener("roco:community-updated", refresh); };
  }, [refresh]);
  const act = useCallback(action => {
    const result = socialAction(action);
    if (!result.ok && ["storage-failed", "read-failed", "identity-unavailable"].includes(result.code)) setError(result.message);
    return result;
  }, []);
  return { state, identity, ready, error, act, refresh };
}

export { getSubmissionAuthorIdentity } from "./communitySocialModel";

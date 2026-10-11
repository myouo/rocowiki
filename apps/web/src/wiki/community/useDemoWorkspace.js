import {readDemoWorkspace,writeDemoWorkspace} from "./workspaceRepository";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureProfileUuid, UUID_RE } from "../communitySocialModel";
import { STORAGE_KEY } from "./constants.js";
import { makeSeed } from "./demo/fixtures.js";
import { normalizeWorkspace } from "./workspaceModel.js";

function useWorkspace() {
  const [workspace, setWorkspace] = useState(makeSeed);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const current = useRef(workspace);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const loaded = readDemoWorkspace();
      const next = loaded ? normalizeWorkspace(loaded) : makeSeed();
      const needsIdentity = !UUID_RE.test(next.profile?.uuid || "");
      next.profile = ensureProfileUuid(next.profile);
      current.current = next;
      setWorkspace(next);
      if (needsIdentity) {
        try { writeDemoWorkspace(next); }
        catch { setStorageError("旧资料已加载，但身份标识尚未保存。请检查浏览器存储后重新保存个人资料。"); }
      }
      window.dispatchEvent(new CustomEvent("roco:community-updated", { detail: { profile: next.profile } }));
    } catch {
      setStorageError(
        "无法读取本地记录，已开启临时会话。当前修改仍可操作，但可能无法在刷新后恢复。",
      );
    }
    setReady(true);
    const onStorage = (event) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      try {
        const next = event.newValue
          ? normalizeWorkspace(JSON.parse(event.newValue))
          : makeSeed();
        const needsIdentity = !UUID_RE.test(next.profile?.uuid || "");
        next.profile = ensureProfileUuid(next.profile);
        current.current = next;
        setWorkspace(next);
        if (needsIdentity) {
          try { writeDemoWorkspace(next); }
          catch { setStorageError("旧资料已加载，但身份标识尚未保存。请检查浏览器存储后重新保存个人资料。"); }
        }
      } catch {
        /* Keep the currently usable state if another tab stores invalid JSON. */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { mounted.current = false; window.removeEventListener("storage", onStorage); };
  }, []);
  const update = useCallback((recipe) => {
    const next =
      typeof recipe === "function" ? recipe(current.current) : recipe;
    current.current = next;
    if (mounted.current) setWorkspace(next);
    try {
      writeDemoWorkspace(next);
      if (mounted.current) setStorageError("");
    } catch {
      if (mounted.current) setStorageError(
        "当前浏览器无法保存本地记录。修改暂存在本次会话中，刷新后可能丢失。",
      );
    }
    window.dispatchEvent(new CustomEvent("roco:community-updated", { detail: { profile: next.profile } }));
    return next;
  }, []);
  return { workspace, update, ready, storageError };
}

export { useWorkspace };

import { useEffect, useState } from "react";
import { BOOKMARKS_KEY } from "./constants.js";
import { articleHref } from "./navigation.js";
import {canonicalCatalogHref} from '../../../../../packages/wiki-schema/src/catalog-routes';

function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(BOOKMARKS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
            ? parsed.items
            : [];
        setBookmarks(
          list.filter(Boolean).map((item, index) =>
            typeof item === "string"
              ? {
                  id: item,
                  title: item,
                  href:
                    item.startsWith("/") && !item.startsWith("//")
                      ? canonicalCatalogHref(item)
                      : articleHref(item),
                  kind: "词条",
                }
              : {
                  id: String(item.id || index),
                  title: String(item.title || item.name || "未命名收藏"),
                  href:
                    typeof item.href === "string" &&
                    item.href.startsWith("/") &&
                    !item.href.startsWith("//")
                      ? canonicalCatalogHref(item.href)
                      : articleHref(item.title || item.name || ""),
                  kind: String(item.kind || "词条"),
                },
          ),
        );
      } catch {
        setError("收藏记录暂时无法读取。");
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("roco-wiki-bookmarks", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("roco-wiki-bookmarks", read);
    };
  }, []);
  const remove = (id) => {
    const next = bookmarks.filter((item) => item.id !== id);
    setBookmarks(next);
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      window.dispatchEvent(new window.Event("roco-wiki-bookmarks"));
    } catch {
      setError("收藏修改未能保存，刷新后可能恢复。");
    }
  };
  return { bookmarks, remove, error };
}

export { useBookmarks };

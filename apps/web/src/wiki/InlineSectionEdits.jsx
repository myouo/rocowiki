import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import EditEntry from "./editing/EditEntry";
import { editingContext, isReaderPath, canAutoEditSection } from "./editingContext";
import { sectionAnchor } from "./sectionAnchor";

function hasDedicatedEditor(heading) {
  if (
    heading.hasAttribute("data-has-editor") ||
    heading.querySelector(".rw-edit-entry")
  )
    return true;
  const row = heading.parentElement;
  if (
    row?.querySelector(
      ":scope > .rw-edit-entry, :scope > .rw-section-actions .rw-edit-entry",
    )
  )
    return true;
  // A record has one typed editor, including all of its explanatory subheadings.
  const record = heading.closest(
    ".rw-acquisition-entry-v6,.rw-matchup-card-v7,.rw-skill-branch-v6,[data-section-editor]",
  );
  return Boolean(record?.querySelector(".rw-edit-entry"));
}

export default function InlineSectionEdits() {
  const location = useLocation();
  const [mounts, setMounts] = useState([]);
  const retired = useRef(new Set());
  // React unmounts obsolete portal children before their unmanaged hosts disappear.
  useLayoutEffect(() => {
    retired.current.forEach((mount) => mount.remove());
    retired.current.clear();
  }, [mounts]);
  useEffect(() => {
    setMounts([]);
    if (!isReaderPath(location.pathname)) return;
    const root = document.getElementById("rw-main");
    if (!root) return;
    const created = new Map();
    let disposed = false;
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      if (disposed) return;
      const entity =
        root
          .querySelector("[data-wiki-entity]")
          ?.getAttribute("data-wiki-entity") ||
        root.querySelector("h1")?.textContent?.trim();
      let changed = false;
      for (const [heading, item] of created) {
        if (!root.contains(heading) || !heading.contains(item.mount)) {
          retired.current.add(item.mount);
          created.delete(heading);
          changed = true;
        }
      }
      const titles = new Map();
      for (const heading of root.querySelectorAll("h2,h3,h4,h5,h6")) {
        const clone = heading.cloneNode(true);
        clone
          .querySelectorAll(".rw-edit-entry,.rw-inline-section-edit")
          .forEach((el) => el.remove());
        const title = clone.textContent.trim();
        const count = (titles.get(title) || 0) + 1;
        titles.set(title, count);
        if (!title || created.has(heading)) continue;
        if (!canAutoEditSection(location.pathname, {
          title,
          explicit: Boolean(heading.closest("[data-editable-section]")),
          article: Boolean(heading.closest("[data-wiki-article]")),
        })) continue;
        if (
          hasDedicatedEditor(heading) ||
          heading.closest(
            "a,button,form,dialog,fieldset,nav,.rw-petcard,.rw-filterbox,.rw-filterchips,.rw-results-meta,.rw-callout-grid,.rw-table-scroll,.rw-notice,.cm-root,.rw-v7-inputs,[data-no-editor]",
          )
        )
          continue;
        if (!heading.id) heading.id = sectionAnchor(title, count);
        const mount = document.createElement("span");
        mount.className = "rw-inline-section-edit";
        mount.setAttribute("data-v7-editor-host", "");
        heading.appendChild(mount);
        created.set(heading, {
          mount,
          info: editingContext(location.pathname, title, entity, {
            returnTo: location.pathname + location.search + "#" + heading.id,
          }),
          id: heading.id,
        });
        changed = true;
      }
      if (changed) setMounts([...created.values()]);
    };
    scan();
    // Expanded records and filtered lists may mount without a route change.
    const Observer = root.ownerDocument.defaultView?.MutationObserver;
    const observer = Observer ? new Observer(() => {
      if (!disposed && !scheduled) {
        scheduled = true;
        queueMicrotask(scan);
      }
    }) : null;
    observer?.observe(root, { childList: true, subtree: true });
    return () => {
      disposed = true;
      observer?.disconnect();
      created.forEach(({ mount }) => mount.remove());
      retired.current.forEach((mount) => mount.remove());
      retired.current.clear();
    };
  }, [location.pathname, location.search]);
  return mounts.map(({ mount, info, id }) =>
    createPortal(<EditEntry {...info} compact label="编辑本节" />, mount, id),
  );
}

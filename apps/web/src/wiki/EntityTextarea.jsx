import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link2, Search, CornerDownLeft } from "lucide-react";
import { entitySearchRecords, entityMarkdown } from "./entityReferences";
import BoundedTextarea from "./BoundedTextarea";
import {useDemoSubmissions} from "./community/useDemoSubmissions";
import FloatingPanel from "./FloatingPanel";

export function findEntityTrigger(value, cursor) {
  const before = value.slice(0, cursor);
  const match = before.match(/(^|[^A-Za-z0-9/:\\])\/([^/\s\[\]()]{0,32})$/u);
  if (
    !match ||
    before.slice(0, before.length - match[2].length - 1).endsWith("](")
  )
    return null;
  return { start: cursor - match[2].length - 1, end: cursor, query: match[2] };
}

/** Plain Markdown remains portable. Entity autocomplete inserts only known internal links. */
export default function EntityTextarea({
  value = "",
  onChange,
  ariaLabel = "编辑正文",
  ...props
}) {
  value = typeof value === "string" ? value : "";
  const id = "rw-entity-" + useId().replaceAll(":", "");
  const textarea = useRef(null),
    root = useRef(null),
    options = useRef(null), menu = useRef(null);
  const selection = useRef({ start: value.length, end: value.length });
  const pendingCursor = useRef(null),
    composing = useRef(false);
  const [trigger, setTrigger] = useState(null),
    [active, setActive] = useState(0),
    [notice, setNotice] = useState("");
  const submissions = useDemoSubmissions();
  const records = useMemo(() => entitySearchRecords({submissions}), [submissions]);
  const matches = useMemo(() => {
    const query = (trigger?.query || "").toLowerCase();
    return records
      .map((record) => {
        const title = record.title.toLowerCase();
        const haystack = (
          record.title +
          " " +
          (record.keywords || "") +
          " " +
          (record.meta || "")
        ).toLowerCase();
        const score =
          title === query
            ? 0
            : title.startsWith(query)
              ? 1
              : title.includes(query)
                ? 2
                : 3;
        return {
          ...record,
          score,
          matches: !query || haystack.includes(query),
        };
      })
      .filter((record) => record.matches)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);
  }, [records, trigger?.query]);
  useEffect(() => {
    if (pendingCursor.current === null) return;
    textarea.current?.focus();
    textarea.current?.setSelectionRange(
      pendingCursor.current,
      pendingCursor.current,
    );
    pendingCursor.current = null;
  }, [value]);
  useEffect(() => {
    if (!trigger) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target) && !menu.current?.contains(event.target)) setTrigger(null);
    };
    const doc = root.current?.ownerDocument;
    doc?.addEventListener("pointerdown", dismiss);
    return () => doc?.removeEventListener("pointerdown", dismiss);
  }, [!!trigger]);
  useEffect(() => {
    options.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  function inspect(target) {
    selection.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    if (composing.current) return;
    const next =
      target.selectionStart === target.selectionEnd
        ? findEntityTrigger(target.value, target.selectionEnd)
        : null;
    setTrigger(next);
    setActive(0);
  }
  function insert(record) {
    if (!trigger || !record) return;
    const link = entityMarkdown(record);
    if (!link) return;
    const next =
      value.slice(0, trigger.start) + link + value.slice(trigger.end);
    if (props.maxLength && next.length > props.maxLength) {
      setNotice("插入后会超过字数限制，请先缩短正文。");
      return;
    }
    pendingCursor.current = trigger.start + link.length;
    selection.current = {
      start: pendingCursor.current,
      end: pendingCursor.current,
    };
    onChange(next);
    setTrigger(null);
    setNotice("已关联「" + record.title + "」。");
  }
  function launch() {
    const { start, end } = textarea.current
      ? {
          start: textarea.current.selectionStart,
          end: textarea.current.selectionEnd,
        }
      : selection.current;
    const before = value.slice(0, start),
      after = value.slice(end);
    const separator = before && /[A-Za-z0-9/:\\]$/.test(before) ? " " : "";
    const next = before + separator + "/" + after;
    if (props.maxLength && next.length > props.maxLength) return;
    const cursor = before.length + separator.length + 1;
    pendingCursor.current = cursor;
    onChange(next);
    setTrigger({ start: cursor - 1, end: cursor, query: "" });
    setActive(0);
  }
  function keyDown(event) {
    if (
      !trigger ||
      event.nativeEvent?.isComposing ||
      event.isComposing ||
      composing.current
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setTrigger(null);
      return;
    }
    if (event.key === "Tab") {
      setTrigger(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length)
        setActive(
          (index) =>
            (index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) %
            matches.length,
        );
    } else if (event.key === "Enter" && matches[active]) {
      event.preventDefault();
      insert(matches[active]);
    }
  }
  return (
    <div className="rw-entity-editor" ref={root}>
      <div className="rw-entity-toolbar">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={launch}
          aria-label={ariaLabel + "：插入词条"}
        >
          <Link2 size={14} />
          插入词条
        </button>
        <small id={id + "-hint"}>
          输入 <kbd>/</kbd> 关联词条；预览时显示类型图标与跳转箭头。
        </small>
      </div>
      <BoundedTextarea
        {...props}
        ref={textarea}
        value={value}
        aria-label={ariaLabel}
        aria-describedby={id + "-hint"}
        aria-autocomplete="list"
        aria-controls={trigger ? id + "-list" : undefined}
        aria-activedescendant={
          trigger && matches[active] ? id + "-option-" + active : undefined
        }
        onChange={(event) => {
          onChange(event.target.value);
          inspect(event.target);
          setNotice("");
        }}
        onClick={(event) => inspect(event.currentTarget)}
        onSelect={(event) => {
          selection.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
        }}
        onKeyDown={keyDown}
        onCompositionStart={() => {
          composing.current = true;
          setTrigger(null);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          inspect(event.currentTarget);
        }}
      />
      {trigger && (
        <FloatingPanel anchor={textarea} panelRef={menu} className="rw-entity-menu">
          <div className="rw-entity-query">
            <Search size={14} />
            <span>
              {trigger.query ? "关联「" + trigger.query + "」" : "选择已有词条"}
            </span>
            <small>↑ ↓ 选择 · Enter 插入 · Esc 关闭</small>
          </div>
          <div
            ref={options}
            id={id + "-list"}
            role="listbox"
            aria-label="匹配的 Wiki 词条"
          >
            {matches.map((record, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                key={record.to}
                id={id + "-option-" + index}
                aria-selected={index === active}
                data-active={index === active}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(record)}
              >
                <span className="rw-entity-kind">{record.kind}</span>
                <span>
                  <strong>{record.title}</strong>
                  <small>{record.meta}</small>
                </span>
                <CornerDownLeft size={14} />
              </button>
            ))}
            {!matches.length && (
              <p className="rw-entity-empty">
                未找到已收录词条。请换一个正式名称或别名，也可以按 Esc
                继续写正文。
              </p>
            )}
          </div>
        </FloatingPanel>
      )}
      <span className="rw-sr-only" role="status" aria-live="polite">
        {notice}
      </span>
    </div>
  );
}

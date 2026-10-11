import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

/** A shared, fully styled select-only combobox; no native select popup. */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  ariaLabel,
  placeholder = "请选择",
  className = "",
  disabled = false,
  searchable = false,
  id: providedId,
  name,
  required = false,
}) {
  const generatedId = useId().replaceAll(":", "");
  const id = providedId || "rw-select-" + generatedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const [height, setHeight] = useState(280);
  const [offset, setOffset] = useState(0);
  const root = useRef(null),
    button = useRef(null),
    input = useRef(null),
    list = useRef(null);
  const panel = useRef(null);
  const typing = useRef({ text: "", at: 0 });
  const normalized = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { ...option, value: String(option.value ?? "") },
      ),
    [options],
  );
  const selected = normalized.find(
    (option) => option.value === String(value ?? ""),
  );
  const visible = normalized.filter(
    (option) =>
      !query ||
      (
        String(option.label) +
        " " +
        (option.keywords || "") +
        " " +
        (option.group || "")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const enabled = visible
    .map((option, index) => (!option.disabled ? index : -1))
    .filter((index) => index >= 0);
  function close(restoreFocus = false) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) button.current?.focus();
  }
  function launch(last = false) {
    if (disabled) return;
    setQuery("");
    const selectedIndex = normalized.findIndex(
      (option) => option.value === String(value ?? "") && !option.disabled,
    );
    const firstIndex = normalized.findIndex((option) => !option.disabled);
    setActive(
      last
        ? Math.max(
            0,
            normalized.findLastIndex((option) => !option.disabled),
          )
        : Math.max(0, selectedIndex >= 0 ? selectedIndex : firstIndex),
    );
    setOpen(true);
  }
  function choose(index) {
    const option = visible[index];
    if (!option || option.disabled) return;
    onChange?.(option.value);
    close(true);
  }
  useEffect(() => {
    if (!open) return;
    const doc = root.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return;
    const position = () => {
      const rect = root.current?.getBoundingClientRect();
      const popup = panel.current?.getBoundingClientRect();
      if (!rect || !popup) return;
      const viewportHeight = win.visualViewport?.height || win.innerHeight;
      const viewportWidth = win.visualViewport?.width || win.innerWidth;
      const viewportTop = win.visualViewport?.offsetTop || 0;
      const viewportLeft = win.visualViewport?.offsetLeft || 0;
      const below = viewportTop + viewportHeight - rect.bottom - 16;
      const above = rect.top - viewportTop - 16;
      const flip = below < 220 && above > below;
      setUp(flip);
      setHeight(
        Math.max(
          48,
          Math.min(280, (flip ? above : below) - (searchable ? 49 : 8)),
        ),
      );
      const left = Math.max(
        viewportLeft + 16,
        Math.min(rect.left, viewportLeft + viewportWidth - popup.width - 16),
      );
      setOffset(left - rect.left);
    };
    position();
    if (searchable) input.current?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) close();
    };
    const onScroll = (event) => {
      if (
        !(event.target instanceof win.Node) ||
        !root.current?.contains(event.target)
      )
        position();
    };
    doc.addEventListener("pointerdown", outside);
    win.addEventListener("resize", position);
    win.addEventListener("scroll", onScroll, true);
    win.visualViewport?.addEventListener("resize", position);
    win.visualViewport?.addEventListener("scroll", position);
    return () => {
      doc.removeEventListener("pointerdown", outside);
      win.removeEventListener("resize", position);
      win.removeEventListener("scroll", onScroll, true);
      win.visualViewport?.removeEventListener("resize", position);
      win.visualViewport?.removeEventListener("scroll", position);
    };
  }, [open, searchable]);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, query]);
  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  function move(direction) {
    if (!enabled.length) return;
    const cursor = enabled.indexOf(active);
    setActive(enabled[(cursor + direction + enabled.length) % enabled.length]);
  }
  function keyDown(event) {
    if (event.isComposing || event.nativeEvent?.isComposing) return;
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) launch(event.key === "ArrowUp");
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (
      open &&
      (event.key === "Home" || event.key === "End") &&
      event.target !== input.current
    ) {
      event.preventDefault();
      setActive(event.key === "Home" ? enabled[0] || 0 : enabled.at(-1) || 0);
      return;
    }
    if (
      event.key === "Enter" ||
      (event.key === " " && event.target !== input.current)
    ) {
      event.preventDefault();
      if (open) choose(active);
      else launch();
      return;
    }
    if (
      event.target !== input.current &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now();
      typing.current = {
        text:
          (now - typing.current.at < 700 ? typing.current.text : "") +
          event.key,
        at: now,
      };
      if (!open) setOpen(true);
      if (searchable) {
        setQuery(typing.current.text);
        setActive(0);
      } else {
        const found = normalized.findIndex(
          (option) =>
            !option.disabled &&
            String(option.label)
              .toLowerCase()
              .startsWith(typing.current.text.toLowerCase()),
        );
        if (found >= 0) setActive(found);
      }
    }
  }
  return (
    <div
      className={"rw-select " + (open ? "is-open " : "") + className}
      ref={root}
    >
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        ref={button}
        id={id}
        className="rw-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={id + "-list"}
        aria-expanded={open}
        aria-required={required || undefined}
        aria-activedescendant={
          open && visible[active] ? id + "-option-" + active : undefined
        }
        disabled={disabled}
        onClick={() => (open ? close() : launch())}
        onKeyDown={keyDown}
      >
        <span className={!selected ? "rw-select-placeholder" : ""}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          ref={panel}
          className={"rw-select-panel " + (up ? "opens-up" : "")}
          style={{ left: offset }}
        >
          {searchable && (
            <div className="rw-select-search">
              <Search size={14} />
              <input
                ref={input}
                aria-label={(ariaLabel || "选项") + "搜索"}
                aria-controls={id + "-list"}
                aria-autocomplete="list"
                aria-activedescendant={
                  visible[active] ? id + "-option-" + active : undefined
                }
                value={query}
                placeholder="输入关键词筛选"
                autoComplete="off"
                onKeyDown={keyDown}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
              />
            </div>
          )}
          <div
            ref={list}
            id={id + "-list"}
            role="listbox"
            aria-label={ariaLabel || "可选项"}
            className="rw-select-options"
            style={{ maxHeight: height }}
          >
            {visible.map((option, index) => (
              <React.Fragment key={option.value}>
                {option.group &&
                  (index === 0 ||
                    visible[index - 1].group !== option.group) && (
                    <div className="rw-select-group" role="presentation">
                      {option.group}
                    </div>
                  )}
                <button
                  type="button"
                  role="option"
                  id={id + "-option-" + index}
                  tabIndex={-1}
                  className="rw-select-option"
                  aria-selected={option.value === String(value ?? "")}
                  aria-disabled={option.disabled || undefined}
                  disabled={option.disabled}
                  data-active={index === active}
                  onPointerMove={() => !option.disabled && setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === String(value ?? "") && <Check size={14} />}
                </button>
              </React.Fragment>
            ))}
            {!visible.length && (
              <div className="rw-select-empty">没有匹配选项</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

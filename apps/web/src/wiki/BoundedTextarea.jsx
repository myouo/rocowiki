// @ts-check
import React, { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronsUpDown, Minus, Plus, RotateCcw } from "lucide-react";

/** @param {number} value @param {number} min @param {number} max */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/** @typedef {import('react').TextareaHTMLAttributes<HTMLTextAreaElement> & {minHeight?: number, maxHeight?: number, wrapperClassName?: string}} TextareaProps */

/** A real text input with a bounded, keyboard-accessible height control.
 * Width always follows its containing card. The forwarded ref is the textarea,
 * so IME, selection ranges, entity completion and native form APIs keep working.
 */
const BoundedTextarea = forwardRef(/** @param {TextareaProps} props @param {import('react').ForwardedRef<HTMLTextAreaElement>} forwardedRef */ function BoundedTextarea({
  rows = 4, minHeight = 88, maxHeight = 600, className = "", style,
  wrapperClassName = "", onChange, onInput, value, defaultValue,
  id: providedId, ...props
}, forwardedRef) {
  const generatedId = useId().replaceAll(":", "");
  const id = providedId || "rw-textarea-" + generatedId;
  const input = useRef(/** @type {HTMLTextAreaElement|null} */(null)), root = useRef(/** @type {HTMLDivElement|null} */(null)), frame = useRef(/** @type {number|null} */(null));
  const manual = useRef(/** @type {number|null} */(null)), dragCleanup = useRef(/** @type {(()=>void)|null} */(null)), alive = useRef(false);
  const [height, setHeight] = useState(Math.max(88, Math.min(600, Number(rows) * 24 + 22)));
  const [limits, setLimits] = useState({ min: 88, max: 600 });
  const [automatic, setAutomatic] = useState(true);
  const attach = useCallback(/** @param {HTMLTextAreaElement|null} node */ node => {
    input.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const measure = useCallback(() => {
    const node = input.current, win = node?.ownerDocument?.defaultView;
    if (!node || !alive.current) return;
    const computed = win?.getComputedStyle(node);
    const line = parseFloat(computed?.lineHeight || '') || 24;
    const requestedMax = Math.max(96, Number(maxHeight) || 600);
    const max = Math.max(96, Math.min(requestedMax, (win?.visualViewport?.height || win?.innerHeight || 900) * 0.72));
    const min = Math.min(max, Math.max(72, Number(minHeight) || 88, Math.min(12, Math.max(1, Number(rows) || 4)) * line + 22));
    setLimits(previous => previous.min === min && previous.max === max ? previous : { min, max });
    let next;
    if (manual.current !== null) {
      next = clamp(manual.current, min, max);
      manual.current = next;
    } else {
      node.style.height = "1px";
      const border = (parseFloat(computed?.borderTopWidth || '') || 0) + (parseFloat(computed?.borderBottomWidth || '') || 0);
      next = clamp((node.scrollHeight || min) + border, min, max);
    }
    node.style.height = next + "px";
    setHeight(previous => Math.abs(previous - next) < 0.5 ? previous : next);
  }, [rows, minHeight, maxHeight]);

  const schedule = useCallback(() => {
    const win = input.current?.ownerDocument?.defaultView;
    if (!alive.current || frame.current !== null) return;
    if (win?.requestAnimationFrame) frame.current = win.requestAnimationFrame(() => { frame.current = null; measure(); });
    else measure();
  }, [measure]);

  useEffect(() => {
    alive.current = true;
    const node = input.current, win = node?.ownerDocument?.defaultView;
    let previousWidth = -1, current = true;
    const observer = win?.ResizeObserver ? new win.ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width;
      if (width !== previousWidth) { previousWidth = width; schedule(); }
    }) : null;
    if (root.current) observer?.observe(root.current);
    win?.addEventListener("resize", schedule);
    win?.visualViewport?.addEventListener("resize", schedule);
    node?.ownerDocument?.fonts?.ready?.then(() => { if (current) schedule(); }, () => { /* Keep the usable fallback metrics. */ });
    schedule();
    return () => {
      current = false; alive.current = false;
      observer?.disconnect();
      win?.removeEventListener("resize", schedule);
      win?.visualViewport?.removeEventListener("resize", schedule);
      if (frame.current !== null) win?.cancelAnimationFrame?.(frame.current);
      frame.current = null;
      dragCleanup.current?.();
    };
  }, [schedule]);

  useEffect(schedule, [value, defaultValue, schedule]);

  /** @param {number} next */
  function resizeTo(next) {
    manual.current = clamp(next, limits.min, limits.max);
    setAutomatic(false);
    schedule();
  }
  function reset() { manual.current = null; setAutomatic(true); schedule(); }
  /** @param {import('react').PointerEvent<HTMLElement>} event */
  function beginDrag(event) {
    if (event.button > 0) return;
    event.preventDefault();
    dragCleanup.current?.();
    const doc = input.current?.ownerDocument;
    if (!doc) return;
    const startY = event.clientY, startHeight = height, pointerId = event.pointerId;
    const move = /** @param {PointerEvent} next */ next => {
      if (next.pointerId !== pointerId) return;
      next.preventDefault();
      resizeTo(startHeight + next.clientY - startY);
    };
    const finish = /** @param {PointerEvent} next */ next => { if (next && next.pointerId !== pointerId) return; cleanup(); };
    const cleanup = () => {
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", finish);
      doc.removeEventListener("pointercancel", finish);
      dragCleanup.current = null;
    };
    dragCleanup.current = cleanup;
    doc.addEventListener("pointermove", move, { passive: false });
    doc.addEventListener("pointerup", finish);
    doc.addEventListener("pointercancel", finish);
  }

  return <div ref={root} className={"rw-bounded-textarea " + wrapperClassName} data-height-mode={automatic ? "auto" : "manual"}>
    <textarea {...props} id={id} ref={attach} rows={rows} value={value} defaultValue={defaultValue}
      className={className} style={{ ...style, boxSizing: "border-box", width: "100%", minWidth: 0, maxWidth: "100%", height, minHeight: 0, maxHeight: limits.max, resize: "none" }}
      onChange={event => { onChange?.(event); schedule(); }}
      onInput={event => { onInput?.(event); schedule(); }} />
    <div className="rw-textarea-height-tools" data-no-editor>
      <span>{automatic ? "高度随内容调整" : "已调整输入区高度"}</span>
      <div>
        <button type="button" aria-label="缩小输入区" aria-controls={id} disabled={height <= limits.min + 1} onClick={() => resizeTo(height - 48)}><Minus size={13} /></button>
        <span className="rw-textarea-grip" role="separator" tabIndex={0} aria-label="调整输入区高度" aria-controls={id} aria-orientation="horizontal" aria-valuemin={Math.round(limits.min)} aria-valuemax={Math.round(limits.max)} aria-valuenow={Math.round(height)}
          onPointerDown={beginDrag} onKeyDown={event => {
            if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              resizeTo(event.key === "Home" ? limits.min : event.key === "End" ? limits.max : height + (event.key === "ArrowUp" ? -24 : 24));
            }
          }}><ChevronsUpDown size={14} /></span>
        <button type="button" aria-label="放大输入区" aria-controls={id} disabled={height >= limits.max - 1} onClick={() => resizeTo(height + 48)}><Plus size={13} /></button>
        <button type="button" aria-label="恢复输入区自动高度" aria-controls={id} onClick={reset}><RotateCcw size={13} /></button>
      </div>
    </div>
  </div>;
});

export default BoundedTextarea;

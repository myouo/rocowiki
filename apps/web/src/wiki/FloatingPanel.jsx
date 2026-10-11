import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Escape card clipping, remain in the anchor's document, and use the top layer when available. */
export default function FloatingPanel({anchor, panelRef, children, className = "", ...props}) {
  const own = useRef(null), [host, setHost] = useState(null), [position, setPosition] = useState(null);
  useLayout(() => {
    const node = anchor.current;
    setHost(node?.closest('dialog[open]') || node?.ownerDocument.body || null);
  }, [anchor]);
  useLayout(() => {
    const node = anchor.current, panel = own.current, view = node?.ownerDocument.defaultView;
    if (!host || !node || !panel || !view) return;
    const useFrames = typeof view.requestAnimationFrame === 'function';
    let active = true, frame = null;
    const measure = () => {
      frame = null;
      if (!active || !node.isConnected || !panel.isConnected) return;
      const rect = node.getBoundingClientRect(), viewport = view.visualViewport;
      const topEdge = (viewport?.offsetTop || 0) + 12, leftEdge = (viewport?.offsetLeft || 0) + 12;
      const bottomEdge = topEdge + (viewport?.height || view.innerHeight) - 24;
      const width = Math.max(1, Math.min(Math.max(rect.width, 260), (viewport?.width || view.innerWidth) - 24));
      const below = bottomEdge - rect.bottom - 8, above = rect.top - topEdge - 8;
      const up = below < 220 && above > below;
      const maxHeight = Math.max(24, Math.min(340, Math.max(72, up ? above : below), bottomEdge - topEdge));
      const height = Math.min(panel.getBoundingClientRect().height || maxHeight, maxHeight);
      const top = Math.max(topEdge, Math.min(up ? rect.top - height - 8 : rect.bottom + 8, bottomEdge - height));
      const left = Math.max(leftEdge, Math.min(rect.left, leftEdge + (viewport?.width || view.innerWidth) - width - 24));
      setPosition(old => old && old.top===top && old.left===left && old.width===width && old.maxHeight===maxHeight ? old : {top,left,width,maxHeight});
    };
    const schedule = event => {
      if (event?.target instanceof view.Node && panel.contains(event.target)) return;
      if (active && frame === null) frame = useFrames ? view.requestAnimationFrame(measure) : view.setTimeout(measure,0);
    };
    const observer = view.ResizeObserver ? new view.ResizeObserver(()=>schedule()) : null;
    observer?.observe(node);observer?.observe(panel);
    view.addEventListener('resize',schedule);view.addEventListener('scroll',schedule,true);
    view.visualViewport?.addEventListener('resize',schedule);view.visualViewport?.addEventListener('scroll',schedule);
    try { panel.showPopover?.(); } catch { /* Fixed portal also works without the popover API. */ }
    measure();
    return () => {
      active=false;observer?.disconnect();if(frame!==null){if(useFrames)view.cancelAnimationFrame?.(frame);else view.clearTimeout(frame);}
      view.removeEventListener('resize',schedule);view.removeEventListener('scroll',schedule,true);
      view.visualViewport?.removeEventListener('resize',schedule);view.visualViewport?.removeEventListener('scroll',schedule);
      try {panel.hidePopover?.();}catch{}
    };
  }, [anchor,host]);
  if (!host) return null;
  return createPortal(<div {...props} popover="manual" className={`rw-floating-panel ${className}`} ref={node=>{own.current=node;if(panelRef)panelRef.current=node;}}
    style={{position:'fixed',inset:'auto',margin:0,zIndex:2000,...position,visibility:position?'visible':'hidden'}}>{children}</div>,host);
}

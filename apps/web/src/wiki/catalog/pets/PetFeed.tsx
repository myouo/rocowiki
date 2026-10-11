// SPDX-License-Identifier: GPL-3.0-only
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WikiPet } from './officialTypes';
import { PET_BATCH_SIZE, readPetFeedPosition, savePetFeedPosition } from './feedModel';
import type { PetFeedPosition } from './feedModel';
import { VirtualPetGrid } from './VirtualPetGrid';
import type { PetGridHandle } from './VirtualPetGrid';

export interface PetFeedHandle { remember: (slug: string) => void; }
interface Props {
  items: readonly WikiPet[];
  scope: string;
  version: string;
  ready: boolean;
  requested: number;
  onCountChange: (count: number) => void;
  renderPet: (pet: WikiPet) => ReactNode;
}

export const PetFeed = forwardRef<PetFeedHandle, Props>(function PetFeed({ items, scope, version, ready, requested, onCountChange, renderPet }, ref) {
  const [state, setState] = useState({ scope, loaded: Math.min(PET_BATCH_SIZE, items.length) });
  const loaded = state.scope === scope ? Math.min(state.loaded, items.length) : Math.min(PET_BATCH_SIZE, items.length);
  const grid = useRef<PetGridHandle>(null), sentinel = useRef<HTMLDivElement>(null);
  const previousScope = useRef<string | null>(null), pending = useRef<PetFeedPosition | null>(null);
  const lastPosition = useRef<PetFeedPosition | null>(null), leaving = useRef(false);
  const restoreFrame = useRef(0);
  const advancing = useRef(false);
  const latest = useRef({ loaded, requested, items, scope, version, ready, onCountChange });
  latest.current = { loaded, requested, items, scope, version, ready, onCountChange };

  function capture(anchor?: string) {
    const current = latest.current;
    if (!current.ready || leaving.current) return;
    const position = grid.current?.position(anchor) || { scroll: window.scrollY };
    lastPosition.current = { scope: current.scope, version: current.version, loaded: current.loaded, ...position };
  }
  function save() {
    if (!lastPosition.current) return;
    try { savePetFeedPosition(window.sessionStorage, lastPosition.current); } catch { /* Storage may be unavailable. */ }
  }
  useImperativeHandle(ref, () => ({ remember(slug) { capture(slug); save(); leaving.current = true; } }));

  useEffect(() => {
    if (!ready) return;
    const firstMount = previousScope.current === null;
    previousScope.current = scope;
    leaving.current = false; lastPosition.current = null;
    let saved: PetFeedPosition | null = null;
    if (firstMount) { try { saved = readPetFeedPosition(window.sessionStorage, scope, version, items.length); } catch {} }
    const next = Math.min(items.length, Math.max(requested, saved?.loaded || 0));
    pending.current = saved;
    setState({ scope, loaded: next });
    if (next !== requested) latest.current.onCountChange(next);
    if (!firstMount) {
      const top = document.getElementById('pet-catalog-results')?.getBoundingClientRect().top;
      if (top !== undefined && top < 100) window.scrollTo({ top: Math.max(0, window.scrollY + top - 120), behavior: 'instant' });
    }
  }, [scope, version, ready]);

  useEffect(() => {
    advancing.current = false;
    if (!ready || state.scope !== scope) return;
    window.cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = window.requestAnimationFrame(() => {
      restoreFrame.current = 0;
      if (pending.current) { grid.current?.restore(pending.current); pending.current = null; }
      capture();
    });
    return () => window.cancelAnimationFrame(restoreFrame.current);
  }, [loaded, ready, state.scope, scope]);

  useEffect(() => {
    const onScroll = () => capture();
    const onPageHide = () => { capture(); save(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => {
      save();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      window.cancelAnimationFrame(restoreFrame.current);
    };
  }, []);

  function loadMore() {
    const current = latest.current;
    if (!current.ready || pending.current || leaving.current || advancing.current || current.loaded >= current.items.length) return;
    const next = Math.min(current.items.length, current.loaded + PET_BATCH_SIZE);
    // Guard repeated observer callbacks before React commits the new state.
    latest.current = { ...current, loaded: next };
    advancing.current = true;
    setState({ scope: current.scope, loaded: next });
    current.onCountChange(next);
  }
  useEffect(() => {
    if (!ready || state.scope !== scope || loaded >= items.length || typeof window.IntersectionObserver === 'undefined' || !sentinel.current) return;
    let active = true;
    const observer = new window.IntersectionObserver(entries => {
      const current = latest.current;
      // Queued intersections belong to the observed batch, not a newly restored or filtered list.
      if (active && current.loaded === loaded && current.scope === scope && current.version === version && entries.some(entry => entry.isIntersecting)) loadMore();
    }, { rootMargin: '600px 0px' });
    observer.observe(sentinel.current);
    return () => { active = false; observer.disconnect(); };
  }, [ready, loaded, items.length, scope, state.scope, version]);

  return <div className="rw-pet-feed">
    <VirtualPetGrid key={scope} ref={grid} items={items} loaded={loaded} renderPet={renderPet} />
    <div className="rw-pet-feed-more" ref={sentinel}>
      <p role="status" aria-live="polite">已加载 {loaded} / {items.length} 只</p>
      {loaded < items.length ? <button className="rw-button" type="button" onClick={loadMore}>加载更多</button> : <span className="rw-muted">已经浏览到列表末尾</span>}
    </div>
  </div>;
});

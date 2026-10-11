// SPDX-License-Identifier: GPL-3.0-only
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WikiPet } from './officialTypes';
import { petWindow } from './feedModel';
import type { PetFeedPosition } from './feedModel';

export interface PetGridHandle {
  position: (anchor?: string) => Pick<PetFeedPosition, 'scroll' | 'anchor' | 'offset'>;
  restore: (position: PetFeedPosition) => void;
}

interface Props {
  items: readonly WikiPet[];
  loaded: number;
  renderPet: (pet: WikiPet) => ReactNode;
}

export const VirtualPetGrid = forwardRef<PetGridHandle, Props>(function VirtualPetGrid({ items, loaded, renderPet }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0), correction = useRef(0);
  const pendingFocus = useRef<{ slug: string; forward: boolean } | null>(null);
  const metrics = useRef({ columns: 6, pitch: 282, gap: 17, top: 0 });
  // The server and first browser render show the same first batch.
  const [view, setView] = useState({ columns: 6, pitch: 282, gap: 17, start: 0, end: 10, virtual: false });
  const current = useRef({ items, loaded }); current.current = { items, loaded };

  function measure() {
    if (!root.current) return;
    const row = root.current.querySelector<HTMLElement>('.rw-pet-feed-row');
    const card = root.current.querySelector<HTMLElement>('[data-pet-slug]');
    const style = row ? window.getComputedStyle(row) : null;
    const columns = style?.gridTemplateColumns.split(' ').filter(value => value && value !== 'none').length || metrics.current.columns;
    const gap = Number.parseFloat(style?.rowGap || '') || 17;
    const pitch = (card?.getBoundingClientRect().height || metrics.current.pitch - gap) + gap;
    const top = root.current.getBoundingClientRect().top + window.scrollY;
    metrics.current = { columns, pitch, gap, top };
    const range = petWindow(current.current.loaded, columns, pitch, top, window.scrollY, window.innerHeight);
    setView(previous => previous.columns === columns && previous.pitch === pitch && previous.start === range.start && previous.end === range.end && previous.virtual
      ? previous : { columns, pitch, gap, ...range, virtual: true });
  }

  function scheduleMeasure() {
    if (!frame.current) frame.current = window.requestAnimationFrame(() => { frame.current = 0; measure(); });
  }

  function elementFor(slug: string) {
    return Array.from(root.current?.querySelectorAll<HTMLElement>('[data-pet-slug]') || []).find(node => node.dataset.petSlug === slug);
  }

  useImperativeHandle(ref, () => ({
    position(anchor) {
      const node = anchor ? elementFor(anchor) : Array.from(root.current?.querySelectorAll<HTMLElement>('[data-pet-slug]') || []).find(item => item.getBoundingClientRect().bottom > 100);
      return { scroll: window.scrollY, anchor: node?.dataset.petSlug, offset: node?.getBoundingClientRect().top };
    },
    restore(position) {
      const index = current.current.items.findIndex(pet => pet.slug === position.anchor);
      const { columns, pitch, top } = metrics.current;
      const offset = position.offset === undefined ? undefined : Math.min(position.offset, Math.max(100, window.innerHeight - (pitch - metrics.current.gap) - 80));
      const target = index >= 0 && offset !== undefined ? top + Math.floor(index / columns) * pitch - offset : position.scroll;
      window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
      measure();
      window.cancelAnimationFrame(correction.current);
      correction.current = window.requestAnimationFrame(() => {
        correction.current = 0;
        const node = position.anchor ? elementFor(position.anchor) : undefined;
        if (node && offset !== undefined) window.scrollTo({ top: Math.max(0, window.scrollY + node.getBoundingClientRect().top - offset), behavior: 'instant' });
        scheduleMeasure();
      });
    },
  }));

  useEffect(() => {
    measure();
    const observer = typeof window.ResizeObserver === 'undefined' ? null : new window.ResizeObserver(scheduleMeasure);
    if (root.current) observer?.observe(root.current);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.cancelAnimationFrame(frame.current); window.cancelAnimationFrame(correction.current);
      frame.current = 0; correction.current = 0;
    };
  }, []);
  useEffect(scheduleMeasure, [loaded, items.length]);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const nodes = elementFor(pending.slug)?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
    const target = pending.forward ? nodes?.[0] : nodes?.[nodes.length - 1];
    if (target) { target.focus({ preventScroll: true }); pendingFocus.current = null; }
  }, [view.start, view.end, view.columns]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !view.virtual) return;
    const focusable = Array.from(root.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []);
    const forward = !event.shiftKey && event.target === focusable.at(-1) && view.end * view.columns < loaded;
    const backward = event.shiftKey && event.target === focusable[0] && view.start > 0;
    if (!forward && !backward) return;
    event.preventDefault();
    const index = forward ? view.end * view.columns : view.start * view.columns - 1;
    const slug = items[index]?.slug;
    if (!slug) return;
    const { pitch, columns, top } = metrics.current;
    pendingFocus.current = { slug, forward };
    window.scrollTo({ top: Math.max(0, top + Math.floor(index / columns) * pitch - 120), behavior: 'instant' });
    measure();
  }

  const rows = Math.ceil(loaded / view.columns);
  const start = view.virtual ? Math.min(view.start, Math.max(0, rows - 1)) : 0;
  const end = view.virtual ? Math.min(rows, Math.max(start + 1, view.end)) : rows;
  return <div className="rw-pet-feed-grid" ref={root} role="list" aria-label="宠物列表" onKeyDown={onKeyDown}>
    {start > 0 && <div aria-hidden="true" style={{ height: start * view.pitch }} />}
    {Array.from({ length: end - start }, (_, offset) => {
      const row = start + offset, first = row * view.columns;
      return <div className="rw-petgrid rw-pet-feed-row" role="presentation" key={row} style={{ marginBottom: row < rows - 1 ? view.gap : 0 }}>
        {items.slice(first, Math.min(loaded, first + view.columns)).map((pet, index) => <div className="rw-pet-feed-card" role="listitem" aria-posinset={first + index + 1} aria-setsize={items.length} key={pet.slug} data-pet-slug={pet.slug}>
          {renderPet(pet)}
        </div>)}
      </div>;
    })}
    {end < rows && <div aria-hidden="true" style={{ height: (rows - end) * view.pitch - view.gap }} />}
  </div>;
});

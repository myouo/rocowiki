// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PetFeed } from '../apps/web/src/wiki/catalog/pets/PetFeed';
import type { PetFeedHandle } from '../apps/web/src/wiki/catalog/pets/PetFeed';
import { VirtualPetGrid } from '../apps/web/src/wiki/catalog/pets/VirtualPetGrid';
import { PET_FEED_STORAGE_KEY, collectionRank, petCollection, petFeedScope, petHrefWithReturnTo, petWindow, readPetFeedPosition, requestedPetCount, safePetListReturnTo, savePetFeedPosition } from '../apps/web/src/wiki/catalog/pets/feedModel';
import type { WikiPet, OfficialPetSnapshot } from '../apps/web/src/wiki/catalog/pets/officialTypes';

const pets: WikiPet[] = Array.from({ length: 3382 }, (_, index) => ({ slug: `pet-${index}`, name: `Pet ${index}`, number: 3444 - index, types: ['草'], aliases: [], image: '', stats: null, skills: [], sourceUrl: 'https://example.test/source' }));
const renderPet = (pet: WikiPet) => createElement('article', { className: 'rw-petcard' }, createElement('button', null, `比较 ${pet.name}`), createElement('a', { href: `/pets/?entry=${pet.slug}` }, pet.name));
const data = JSON.parse(readFileSync('apps/web/content/official-pets.json', 'utf8')) as OfficialPetSnapshot;
afterEach(() => vi.unstubAllGlobals());

describe('pet feed data and navigation boundaries', () => {
  it('separates placeholders and source IDs without mistaking LULU or preloaded named pets for placeholders', () => {
    const records = data.pets.map(official => ({ official }));
    expect(records.filter(pet => petCollection(pet) === 'placeholder').map(pet => pet.official.name)).toEqual(['WX', 'AA']);
    expect(records.filter(pet => petCollection(pet) === 'internal').map(pet => pet.official.id)).toEqual([11790, 11791, 11792]);
    expect(petCollection({ official: data.pets.find(pet => pet.name === 'LULU') })).toBe('regular');
    expect(petCollection({ official: data.pets.find(pet => pet.id === 3444) })).toBe('regular');
    const sorted = [...records].sort((a, b) => collectionRank(a) - collectionRank(b) || b.official.id - a.official.id);
    expect(sorted[0].official.name).toBe('桃汁咩咩');
  });
  it('shares loading depth while preserving a stable filter scope, including old paginated links', () => {
    expect(requestedPetCount(new URLSearchParams('loaded=120'), 3382)).toBe(120);
    expect(requestedPetCount(new URLSearchParams('page=2'), 3382)).toBe(120);
    expect(requestedPetCount(new URLSearchParams('loaded=99999999999999999999999'), 3382)).toBe(60);
    expect(requestedPetCount(new URLSearchParams('loaded=9999'), 3)).toBe(3);
    expect(petFeedScope(new URLSearchParams('type=草&loaded=120&order=desc'))).toBe(petFeedScope(new URLSearchParams('order=desc&type=草&page=2')));
    expect(petFeedScope(new URLSearchParams('type=草&token=unrelated-value'))).toBe('type=%E8%8D%89');
  });
  it('retains each pet identity and only accepts a local directory as the return target', () => {
    const link = petHrefWithReturnTo('/pets/?entry=official-3441', '/pets/?type=土&loaded=120');
    const url = new URL(link, 'https://example.test');
    expect(url.searchParams.get('entry')).toBe('official-3441');
    expect(url.searchParams.get('returnTo')).toBe('/pets/?type=土&loaded=120');
    for (const bad of ['https://evil.test', '//evil.test', '/pets/other/', '/pets/?entry=official-1', '/workbench/']) expect(safePetListReturnTo(bad)).toBe('/pets/');
  });
  it('bounds a large list to nearby rows and keeps the final incomplete row reachable', () => {
    const range = petWindow(3382, 6, 280, 600, 120000, 900);
    expect((range.end - range.start) * 6).toBeLessThan(90);
    const last = petWindow(3382, 6, 280, 600, 1_000_000, 900);
    expect(last.end).toBe(Math.ceil(3382 / 6));
    expect(last.start).toBeLessThan(last.end);
  });
});

async function harness() {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://wiki.test/pets/', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  vi.stubGlobal('window', w); vi.stubGlobal('document', d); vi.stubGlobal('sessionStorage', w.sessionStorage);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('getComputedStyle', w.getComputedStyle.bind(w));
  vi.stubGlobal('requestAnimationFrame', w.requestAnimationFrame.bind(w)); vi.stubGlobal('cancelAnimationFrame', w.cancelAnimationFrame.bind(w));
  Object.defineProperty(w, 'scrollY', { value: 0, writable: true });
  w.scrollTo = (options: { top: number }) => { w.scrollY = options.top; w.dispatchEvent(new w.Event('scroll')); };
  // JSDOM has no layout. Supply scroll-relative row geometry; Chrome checks real CSS later.
  w.HTMLElement.prototype.getBoundingClientRect = function() {
    const index = Number(this.getAttribute('aria-posinset') || 1) - 1;
    const top = 500 + (this.dataset.petSlug ? Math.floor(index / 6) * 282 : 0) - w.scrollY;
    return { x: 0, y: top, top, left: 0, right: 120, bottom: top + 265, width: 120, height: 265, toJSON() { return {}; } };
  };
  const intersections: Array<{ callback: IntersectionObserverCallback; disconnected: boolean; node?: Element }> = [];
  class Intersection {
    row: typeof intersections[number];
    constructor(callback: IntersectionObserverCallback) { this.row = { callback, disconnected: false }; intersections.push(this.row); }
    observe(node: Element) { this.row.node = node; }
    disconnect() { this.row.disconnected = true; }
  }
  const resizes: Array<{ disconnected: boolean }> = [];
  class Resize {
    row = { disconnected: false };
    constructor() { resizes.push(this.row); }
    observe() {}
    disconnect() { this.row.disconnected = true; }
  }
  vi.stubGlobal('IntersectionObserver', Intersection); vi.stubGlobal('ResizeObserver', Resize);
  w.IntersectionObserver = Intersection; w.ResizeObserver = Resize;
  const root = createRoot(d.getElementById('root'));
  const tick = () => new Promise(resolve => setTimeout(resolve, 45));
  const render = async (element: React.ReactNode) => { await act(async () => { root.render(element); await tick(); }); };
  const close = async () => { await act(async () => { root.unmount(); await tick(); }); dom.window.close(); };
  return { w, d, render, close, intersections, resizes, tick };
}

describe('pet feed lifecycle and browser state', () => {
  it('renders a stable first batch on the server', () => {
    const html = renderToString(createElement(PetFeed, { items: pets, scope: '', version: 'v1', ready: false, requested: 180, onCountChange() {}, renderPet }));
    expect((html.match(/role="listitem"/g) || []).length).toBe(60);
    expect(html).toContain('Pet 0'); expect(html).not.toContain('Pet 60');
  });
  it('loads sixty more items on intersection, falls back to a button, and clears depth on a new filter', async () => {
    const h = await harness(), counts: number[] = [];
    const props = { items: pets, scope: '', version: 'v1', ready: true, requested: 60, onCountChange: (count: number) => counts.push(count), renderPet };
    try {
      await h.render(createElement(PetFeed, props));
      expect(h.d.querySelector('.rw-pet-feed-more').textContent).toContain('60 / 3382');
      const staleObserver = h.intersections.at(-1)!;
      await act(async () => {
        const observer = h.intersections.at(-1)!;
        observer.callback([{ isIntersecting: true, target: observer.node } as IntersectionObserverEntry], {} as IntersectionObserver);
        await h.tick();
      });
      expect(counts.at(-1)).toBe(120);
      await act(async () => {
        staleObserver.callback([{ isIntersecting: true, target: staleObserver.node } as IntersectionObserverEntry], {} as IntersectionObserver);
        await h.tick();
      });
      expect(counts.at(-1)).toBe(120);
      await act(async () => { h.d.querySelector('.rw-pet-feed-more button').click(); await h.tick(); });
      expect(counts.at(-1)).toBe(180);
      await h.render(createElement(PetFeed, { ...props, scope: 'type=草' }));
      expect(h.d.querySelector('.rw-pet-feed-more').textContent).toContain('60 / 3382');
    } finally { await h.close(); }
    expect(h.intersections.every(row => row.disconnected)).toBe(true);
    expect(h.resizes.every(row => row.disconnected)).toBe(true);
  });
  it('restores depth and position after leaving for a pet detail, even after the framework scrolls to zero', async () => {
    const h = await harness(), ref = React.createRef<PetFeedHandle>();
    const props = { items: pets, scope: 'type=草', version: 'v1', ready: true, requested: 180, onCountChange() {}, renderPet };
    try {
      await h.render(createElement(PetFeed, { ...props, ref }));
      await act(async () => { h.w.scrollTo({ top: 1800 }); await h.tick(); });
      ref.current!.remember('pet-40');
      await act(async () => { h.w.scrollTo({ top: 0 }); await h.tick(); });
      await h.render(null);
      expect(readPetFeedPosition(h.w.sessionStorage, 'type=草', 'v1', pets.length)?.scroll).toBe(1800);
      await h.render(createElement(PetFeed, { ...props, requested: 60, ref }));
      await act(async () => { await h.tick(); });
      expect(h.d.querySelector('.rw-pet-feed-more').textContent).toContain('180 / 3382');
      expect(h.w.scrollY).toBe(1800);
    } finally { await h.close(); }
  });
  it('keeps a full catalogue bounded in the DOM while scrolling near its end', async () => {
    const h = await harness();
    try {
      await h.render(createElement(VirtualPetGrid, { items: pets, loaded: pets.length, renderPet }));
      await act(async () => { h.w.scrollTo({ top: 157000 }); await h.tick(); });
      expect(h.d.querySelectorAll('[role="listitem"]').length).toBeLessThan(90);
      expect(Number(h.d.querySelector('[role="listitem"]').getAttribute('aria-posinset'))).toBeGreaterThan(3000);
    } finally { await h.close(); }
  });
  it('keeps keyboard navigation continuous across the rendered row boundary', async () => {
    const h = await harness();
    try {
      await h.render(createElement(VirtualPetGrid, { items: pets, loaded: 180, renderPet }));
      const last = Array.from(h.d.querySelectorAll('.rw-pet-feed-grid a')).at(-1) as HTMLElement;
      const nextIndex = Number(last.closest('[role="listitem"]')!.getAttribute('aria-posinset'));
      await act(async () => { last.focus(); last.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); await h.tick(); });
      expect(h.d.activeElement.closest('[data-pet-slug]').getAttribute('data-pet-slug')).toBe(`pet-${nextIndex}`);
    } finally { await h.close(); }
  });
  it('ignores corrupted or stale stored state and bounds the number of remembered filters', async () => {
    const h = await harness();
    try {
      h.w.sessionStorage.setItem(PET_FEED_STORAGE_KEY, '[{"scope":"x","version":"v1","loaded":999999999,"scroll":-1}]');
      expect(readPetFeedPosition(h.w.sessionStorage, 'x', 'v1', 3382)).toBeNull();
      for (let i = 0; i < 20; i++) savePetFeedPosition(h.w.sessionStorage, { scope: String(i), version: 'v1', loaded: 120, scroll: 100 });
      expect(JSON.parse(h.w.sessionStorage.getItem(PET_FEED_STORAGE_KEY))).toHaveLength(8);
      expect(readPetFeedPosition(h.w.sessionStorage, '19', 'v2', 3382)).toBeNull();
    } finally { await h.close(); }
  });
});

// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, expect, it, vi } from 'vitest';
import React, { act, createElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'node:module';
import PetImage, { petImageSources } from '../apps/web/src/wiki/catalog/pets/PetImage';

vi.mock('@docusaurus/useBaseUrl', () => ({ default: (url: string) => url }));
afterEach(() => vi.unstubAllGlobals());

it('does not substitute a species image for a selected appearance or invent an unknown ID', () => {
  expect(petImageSources({ number: 3092, image: '/custom-skin.png' }, false)).toEqual(['/custom-skin.png']);
  expect(petImageSources({ image: '/custom-pet.png' })).toEqual(['/custom-pet.png']);
  expect(petImageSources({ number: NaN })).toEqual([]);
  const indexed = { number: 3092, image: '/custom-pet.png', previewSources: ['https://res.17roco.qq.com/example.png'] };
  expect(petImageSources(indexed)).toEqual([...indexed.previewSources, indexed.image]);
  expect(petImageSources(indexed, false)).toEqual([indexed.image]);
  expect(petImageSources({ ...indexed, previewSources: [] })).toEqual([indexed.image]);
});

it('falls back once per source, resets for another pet and ignores detached image errors', async () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<div id="root"></div>');
  const { document } = dom.window;
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', document); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.getElementById('root'));
  const pet = { number: 3444, image: '/legacy.png', official: { id: 3444, iconUrl: 'https://res.17roco.qq.com/res/combat/icons/3444-.png' } };
  const render = async (record = pet) => act(async () => { root.render(createElement(PetImage, { pet: record, alt: '宠物', fallback: '图片暂不可用' })); });
  const fail = async () => { const image = document.querySelector('img')!; await act(async () => { image.dispatchEvent(new dom.window.Event('error')); image.dispatchEvent(new dom.window.Event('error')); }); return image; };
  try {
    await render();
    expect(document.querySelector('img')?.src).toContain('/3444/3444-big.png');
    const oldImage = await fail();
    expect(document.querySelector('img')?.src).toContain('/3444/3444-720.png');
    await fail();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/legacy.png');
    await fail();
    expect(document.querySelector('img')?.src).toBe(pet.official.iconUrl);
    await fail();
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('图片暂不可用');
    await render({ ...pet, number: 1, official: { id: 1, iconUrl: 'https://res.17roco.qq.com/res/combat/icons/001-.png' } });
    await act(async () => { oldImage.dispatchEvent(new dom.window.Event('error')); });
    expect(document.querySelector('img')?.src).toContain('/1/1-big.png');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

it('recovers an image that failed before hydration attached its error handler', async () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const element = createElement(PetImage, { pet: { number: 3444 }, alt: '宠物', fallback: '图片暂不可用' });
  const dom = new JSDOM(`<div id="root">${renderToString(element)}</div>`);
  const { document } = dom.window;
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', document); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(document.querySelector('img'), 'complete', { value: true });
  const container = document.getElementById('root')!;
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, element); });
    expect(container.querySelector('img')?.src).toContain('/3444/3444-720.png');
  } finally { await act(async () => root?.unmount()); dom.window.close(); }
});

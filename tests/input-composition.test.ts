// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act, createElement, useState } from 'react';
import { createRequire } from 'node:module';
import QueryInput from '../apps/web/src/wiki/QueryInput';
import { isCompositionKey, useInputComposition } from '../apps/web/src/wiki/inputComposition';

afterEach(() => vi.unstubAllGlobals());
async function harness() {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://wiki.test/pets/?loaded=120', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  vi.stubGlobal('window', w); vi.stubGlobal('document', d); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(d.getElementById('root'));
  const input = () => d.querySelector('input') as HTMLInputElement;
  const event = async (type: string, data = '') => { await act(async () => { input().dispatchEvent(new w.CompositionEvent(type, { bubbles: true, data })); }); };
  const change = async (value: string, composing = false) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
      input().dispatchEvent(new w.InputEvent('input', { bubbles: true, data: value, inputType: composing ? 'insertCompositionText' : 'insertText', isComposing: composing }));
    });
  };
  return { w, d, input, event, change,
    async render(node: React.ReactNode) { await act(async () => { root.render(node); }); },
    async close() { await act(async () => root.unmount()); dom.window.close(); },
  };
}

describe('Chinese query composition', () => {
  it('keeps pinyin local and retains filters/loading until committed Chinese arrives exactly once', async () => {
    const h = await harness(), commits: string[] = [];
    function Directory() {
      const [query, setQuery] = useState('');
      return createElement(React.Fragment, null,
        createElement(QueryInput, { value: query, onValueChange(next) {
          commits.push(next); setQuery(next);
          const params = new URLSearchParams(h.w.location.search);
          params.set('q', next); params.delete('loaded');
          h.w.history.replaceState(null, '', '/pets/?' + params);
        } }), createElement('output', null, query));
    }
    try {
      await h.render(createElement(Directory));
      h.input().focus();
      await h.event('compositionstart');
      await h.change('sai', true);
      expect(h.input().value).toBe('sai'); expect(commits).toEqual([]);
      expect(h.w.location.search).toBe('?loaded=120');
      await h.render(createElement(Directory));
      expect(h.input().value).toBe('sai');
      await h.change('塞勒姆', true);
      await h.event('compositionend', '塞勒姆');
      await h.change('塞勒姆');
      expect(commits).toEqual(['塞勒姆']);
      expect(new URLSearchParams(h.w.location.search).get('q')).toBe('塞勒姆');
      expect(new URLSearchParams(h.w.location.search).has('loaded')).toBe(false);
      expect(h.d.activeElement).toBe(h.input());
    } finally { await h.close(); }
  });
  it('supports input-before-compositionend order, cancellation, and native composing signals', async () => {
    const h = await harness(), changes: string[] = [];
    const render = () => h.render(createElement(QueryInput, { value: '迪莫', onValueChange(value) { changes.push(value); } }));
    try {
      await render();
      await h.event('compositionstart'); await h.change('dimo', true);
      await h.change('迪莫'); await h.event('compositionend', '迪莫');
      expect(changes).toEqual([]); expect(h.input().value).toBe('迪莫');
      await h.change('haifu', true);
      expect(changes).toEqual([]);
      await h.change('海芙约忒', true); await h.event('compositionend', '海芙约忒');
      expect(changes).toEqual(['海芙约忒']);
    } finally { await h.close(); }
  });
  it('handles ordinary typing, pasted Chinese, deletion and external query resets', async () => {
    const h = await harness(), changes: string[] = [];
    const props = { onValueChange(value: string) { changes.push(value); } };
    try {
      await h.render(createElement(QueryInput, { ...props, value: '' }));
      await h.change('LULU'); await h.change('桃汁咩咩'); await h.change('');
      expect(changes).toEqual(['LULU', '桃汁咩咩', '']);
      await h.render(createElement(QueryInput, { ...props, value: '迪莫' }));
      expect(h.input().value).toBe('迪莫');
      await h.render(createElement(QueryInput, { ...props, value: '' }));
      expect(h.input().value).toBe('');
      expect(changes).toHaveLength(3);
    } finally { await h.close(); }
  });
});

describe('IME confirmation and form submission', () => {
  it('recognizes current composition and the legacy keyCode 229 signal', () => {
    expect(isCompositionKey({}, true)).toBe(true);
    expect(isCompositionKey({ nativeEvent: { isComposing: true } })).toBe(true);
    expect(isCompositionKey({ nativeEvent: { isComposing: false, keyCode: 229 } })).toBe(true);
    expect(isCompositionKey({ isComposing: false, keyCode: 13 })).toBe(false);
  });
  it('blocks candidate Enter and accidental submit, then permits a separate Enter to search', async () => {
    const h = await harness(), submitted: string[] = [];
    function Search() {
      const [value, setValue] = useState('');
      const ime = useInputComposition();
      return createElement('form', { onSubmit(event) { event.preventDefault(); if (!ime.composing.current) submitted.push(value); } },
        createElement('input', { ...ime.handlers, value, onChange(event: React.ChangeEvent<HTMLInputElement>) { setValue(event.currentTarget.value); } }),
        createElement('button', { type: 'submit' }, 'Search'));
    }
    const key = async (isComposing: boolean, keyCode: number) => {
      const event = new h.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing, keyCode });
      await act(async () => { h.input().dispatchEvent(event); }); return event;
    };
    const submit = async () => { await act(async () => { h.d.querySelector('form').dispatchEvent(new h.w.Event('submit', { bubbles: true, cancelable: true })); }); };
    try {
      await h.render(createElement(Search)); await h.event('compositionstart'); await h.change('dimo', true);
      expect((await key(true, 229)).defaultPrevented).toBe(true);
      await submit(); expect(submitted).toEqual([]);
      await h.change('迪莫'); await h.event('compositionend', '迪莫');
      expect((await key(false, 229)).defaultPrevented).toBe(true);
      expect((await key(false, 13)).defaultPrevented).toBe(false);
      await submit(); expect(submitted).toEqual(['迪莫']);
    } finally { await h.close(); }
  });
});

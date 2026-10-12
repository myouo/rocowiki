// SPDX-License-Identifier: GPL-3.0-only
import React, { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useInputComposition } from './inputComposition';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onCompositionStart' | 'onCompositionEnd' | 'onKeyDown'> & {
  value: string;
  onValueChange(value: string): void;
};

/** Keep the IME's draft local; route/filter changes only receive committed text. */
export default function QueryInput({ value, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const ime = useInputComposition();
  useEffect(() => {
    if (!ime.composing.current) {
      setDraft(value);
      committed.current = value;
    }
  }, [value]);
  function commit(next: string) {
    setDraft(next);
    if (committed.current !== next) {
      committed.current = next;
      onValueChange(next);
    }
  }
  return <input {...props} {...ime.handlers} value={draft}
    onChange={event => {
      const next = event.currentTarget.value;
      setDraft(next);
      if (!ime.composing.current && !(event.nativeEvent as InputEvent).isComposing) commit(next);
    }}
    onCompositionEnd={event => {
      ime.handlers.onCompositionEnd();
      commit(event.currentTarget.value);
    }}
  />;
}

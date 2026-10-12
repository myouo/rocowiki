// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

interface CompositionKey {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
}

export function isCompositionKey(event: CompositionKey, composing = false) {
  // Some IMEs report keyCode 229 after compositionend, with isComposing already false.
  return composing || event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229;
}

export function useInputComposition() {
  const composing = useRef(false);
  useEffect(() => () => { composing.current = false; }, []);
  return {
    composing,
    handlers: {
      onCompositionStart() { composing.current = true; },
      onCompositionEnd() { composing.current = false; },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key === 'Enter' && isCompositionKey(event, composing.current)) {
          // Keep candidate confirmation from becoming the form's implicit submit.
          event.preventDefault();
          event.stopPropagation();
        }
      },
    },
  };
}

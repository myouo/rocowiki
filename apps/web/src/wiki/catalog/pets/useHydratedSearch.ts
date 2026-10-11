// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useState } from 'react';

/** Static HTML has no query string. Keep the first browser render identical. */
export function useHydratedSearch(search: string) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? search : '';
}

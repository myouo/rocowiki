// SPDX-License-Identifier: GPL-3.0-only
export async function downloadSource(source: { url: string; maxBytes: number }): Promise<Buffer> {
  const url = new URL(source.url);
  // Refresh public CDN data without depending on an obsolete version query.
  url.searchParams.set('rocowiki', String(Date.now()));
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Source download failed: HTTP ${response.status}`);
  const chunks: Uint8Array[] = [], reader = response.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > source.maxBytes) throw new Error('Source download exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

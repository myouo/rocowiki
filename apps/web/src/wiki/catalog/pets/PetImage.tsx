// SPDX-License-Identifier: GPL-3.0-only
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

interface PetImageRecord {
  number?: number;
  image?: string;
  previewSources?: readonly string[];
  official?: { id: number; iconUrl: string };
}

export function officialPetImageUrl(id: number | undefined, size: 'big' | '720' = 'big'): string {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    ? `https://res.17roco.qq.com/h5/cdn/sprite-full-avatar/${id}/${id}-${size}.png` : '';
}

export function petImageSources(pet: PetImageRecord, preferOfficial = true): string[] {
  const id = pet.official?.id ?? pet.number;
  // Optional future index: undefined keeps automatic URLs; an empty list skips them.
  const previews = pet.previewSources ?? [officialPetImageUrl(id), officialPetImageUrl(id, '720')];
  return [...new Set([
    ...(preferOfficial ? previews : []),
    pet.image,
    ...(preferOfficial ? [pet.official?.iconUrl] : []),
  ].filter((source): source is string => typeof source === 'string' && Boolean(source)))];
}

interface PetImageProps {
  pet: PetImageRecord;
  alt: string;
  loading?: 'eager' | 'lazy';
  preferOfficial?: boolean;
  fallback: ReactNode;
}

function ImageWithFallback({ sources, alt, loading, fallback }: Omit<PetImageProps, 'pet' | 'preferOfficial'> & { sources: string[] }) {
  const [index, setIndex] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const source = sources[index];
  const url = useBaseUrl(source || '');
  useEffect(() => {
    // A server-rendered image may have failed before React attached the error handler.
    if (image.current?.complete && image.current.naturalWidth === 0) setIndex(current => current === index ? current + 1 : current);
  }, [source, index]);
  if (!source) return <>{fallback}</>;
  return <img key={source} ref={image} src={url} alt={alt} loading={loading} decoding="async"
    onError={() => setIndex(current => current === index ? current + 1 : current)} />;
}

export default function PetImage({ pet, preferOfficial = true, loading = 'lazy', ...props }: PetImageProps) {
  const sources = petImageSources(pet, preferOfficial);
  // Remount on identity or appearance changes so a failed old image cannot skip a new source.
  return <ImageWithFallback key={JSON.stringify(sources)} sources={sources} loading={loading} {...props} />;
}

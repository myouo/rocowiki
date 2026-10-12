// SPDX-License-Identifier: GPL-3.0-only
import type { OfficialPetSnapshot, WikiPet, PetStats } from './officialTypes';
import type { OfficialLadderSnapshot } from './ladderTypes';
import { officialLadderCost } from './ladderModel';

interface ExistingPet {
  slug: string;
  name: string;
  number: number;
  type?: string[];
  types?: string[];
  aliases?: string[];
  image: string;
  stats: number[] | null;
  skills?: unknown[];
  sourceUrl: string;
}

const aliases: Record<string, string[]> = {
  海芙约忒: ['海芙', '神水', '海弗耶特', '海芙约特', '海弗约忒'],
  碧水灵兽: ['碧水'], 魔神武王: ['武王'], 皇家圣光迪莫: ['圣光迪莫'],
};

export function buildOfficialPetCatalog(snapshot: OfficialPetSnapshot, existing: ExistingPet[], metadata: Record<string, Record<string, unknown>>, ladder?: OfficialLadderSnapshot): WikiPet[] {
  const byNumber = new Map(existing.map(pet => [pet.number, pet]));
  const result: WikiPet[] = snapshot.pets.map(official => {
    const previous = byNumber.get(official.id);
    const slug = previous?.slug || `official-${official.id}`;
    const priorMetadata = metadata[slug] || {};
    return {
      ...previous,
      slug, name: official.name, number: official.id, types: official.types,
      aliases: [...new Set([
        ...(previous?.aliases || aliases[official.name] || []),
        ...(previous && previous.name !== official.name ? [previous.name] : []),
      ])],
      image: previous?.image || official.iconUrl,
      stats: official.stats,
      skills: previous?.skills || [],
      sourceUrl: previous?.sourceUrl || snapshot.source.url,
      catalogEntry: !previous,
      metadata: { ...priorMetadata, ...official.metadata, group: official.metadata.group ?? priorMetadata.group ?? null },
      official,
    };
  });
  // A future official omission must not erase an independently sourced existing article.
  for (const previous of existing) {
    if (result.some(pet => pet.number === previous.number)) continue;
    result.push({ ...previous, types: previous.type || previous.types || [], aliases: previous.aliases || [], skills: previous.skills || [], stats: previous.stats as PetStats | null, metadata: metadata[previous.slug] || {} });
  }
  if (ladder) for (const pet of result) {
    pet.officialLadder = officialLadderCost(ladder, pet.number);
    pet.metadata = { ...pet.metadata, ladderMagic: pet.officialLadder };
  }
  return result;
}

export function petCatalogHref(pet: { slug?: string; localEntry?: boolean; catalogEntry?: boolean }) {
  const slug = encodeURIComponent(pet.slug || '');
  return pet.localEntry || pet.catalogEntry ? `/pets/?entry=${slug}` : `/pets/${slug}/`;
}

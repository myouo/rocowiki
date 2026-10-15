import { resolvePublishedCatalogPets, resolvePublishedCatalogSkills } from "../catalogPublished";
import { resolvePublishedRecords } from "../editing/publishedRecords";
import { useDemoSubmissions } from "../community/useDemoSubmissions";
import { petMetadata } from "../content/bundled.js";
import { pets, skills } from "../data";
import {useMemo} from 'react';

// Cache only the immutable bundled projection. Local account/draft overlays remain per hook.
let bundledPets, bundledSkills;

function useCatalogSubmissions() { return useDemoSubmissions(); }

function usePublishedPets() {
  const submissions = useCatalogSubmissions();
  return useMemo(() => submissions.length ? resolvePublishedCatalogPets({ pets, metadata: petMetadata, submissions }) : bundledPets ||= resolvePublishedCatalogPets({ pets, metadata: petMetadata }), [submissions]);
}

function usePublishedSkills() {
  const submissions = useCatalogSubmissions();
  return useMemo(() => submissions.length ? resolvePublishedCatalogSkills({ skills, submissions }) : bundledSkills ||= resolvePublishedCatalogSkills({ skills }), [submissions]);
}

function useCatalogPublishedRecords(pet, mode, records) {
  const submissions = useCatalogSubmissions();
  return resolvePublishedRecords({
    entity: pet.name,
    entityAliases: pet.catalogNames || [],
    mode,
    records,
    submissions,
  });
}

export { useCatalogSubmissions, usePublishedPets, usePublishedSkills, useCatalogPublishedRecords };

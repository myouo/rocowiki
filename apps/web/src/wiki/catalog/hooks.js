import { resolvePublishedCatalogPets, resolvePublishedCatalogSkills } from "../catalogPublished";
import { resolvePublishedRecords } from "../editing/publishedRecords";
import { useDemoSubmissions } from "../community/useDemoSubmissions";
import { petMetadata } from "../content/bundled.js";
import { pets, skills } from "../data";

function useCatalogSubmissions() { return useDemoSubmissions(); }

function usePublishedPets() {
  const submissions = useCatalogSubmissions();
  return resolvePublishedCatalogPets({ pets, metadata: petMetadata, submissions });
}

function usePublishedSkills() {
  const submissions = useCatalogSubmissions();
  return resolvePublishedCatalogSkills({ skills, submissions });
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

import { normalizeGuardianInput } from "./rocoCalculations";
import { petCatalogHref } from "./catalog/pets/officialModel";

export function statsDefaultsForPet(pet) {
  return {
    pet: pet.stats?.length === 6 && pet.stats.every((value) => Number.isFinite(value) && value > 0) ? pet.slug : "custom",
    petName: pet.name || pet.slug,
    petHref: petCatalogHref(pet),
    level: "100", nature: "坦率", guardianLevel: "0", guardianLegacyRange: "", relationship: "none",
    base: Array.from({ length: 6 }, (_, i) => Number.isFinite(pet.stats?.[i]) ? String(pet.stats[i]) : ""),
    talent: Array(6).fill("31"), effort: Array(6).fill("0"), intimacy: Array(6).fill("0"),
    accessory: "none", weapon: "none", armor: "none",
    accessoryBonus: "0", weaponBonus: "0", armorBonus: "0",
    weaponStat: "attack", armorStat: "defense",
  };
}

export function normalizeStatsLinkData(data) {
  return normalizeGuardianInput(data);
}

export function fullStatsToolHref(form) {
  return "/tools/stats/?calc=" + encodeURIComponent(JSON.stringify(form));
}

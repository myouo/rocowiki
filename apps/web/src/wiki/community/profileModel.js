// @ts-check
export const PROFILE_AVATARS = /** @type {const} */(["dimo", "haifu", "bishui", "sailemu"]);
/** @param {unknown} value */
export function normalizeAvatar(value) {
  return PROFILE_AVATARS.find(avatar=>avatar===value) || "dimo";
}

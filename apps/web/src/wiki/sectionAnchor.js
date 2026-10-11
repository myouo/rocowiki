// Stable ASCII anchors survive URL encoding and both Docusaurus/preview routers.
export function sectionAnchor(title, ordinal = 1) {
  let hash = 2166136261;
  for (const character of String(title)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `wiki-${(hash >>> 0).toString(16)}${ordinal > 1 ? `-${ordinal}` : ""}`;
}

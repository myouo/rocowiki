import { searchRecordForPath } from "./data";
import { pageVisual } from "./visuals";
import { publishedDocs } from "./content/bundled.js";

export const isReaderPath = (path) =>
  !/^\/(edit|account|review|history|feedback|search|not-found|copyright)\//.test(path);
const documentPaths = new Set((publishedDocs.documents || []).map((doc) => doc.path));
export const isEditableArticlePath = (path = "/") => documentPaths.has(path.split(/[?#]/)[0]);

/** Visual headings are not content records. Custom sections opt in explicitly. */
export function canAutoEditSection(path = "/", { title = "", explicit = false, article = false } = {}) {
  const clean = path.split(/[?#]/)[0];
  if (!title || !isReaderPath(clean)) return false;
  if (["/", "/pets/", "/skills/", "/bloodlines/", "/events/", "/adventure/", "/tools/", "/npcs/", "/places/", "/pve/"].includes(clean)) return false;
  return isEditableArticlePath(clean) || explicit || article;
}
export function editingContext(
  path = "/",
  section = "条目正文",
  entity,
  overrides = {},
) {
  const clean = path.split(/[?#]/)[0];
  const known = searchRecordForPath(clean);
  let mode = "article";
  const kind = clean.split("/").filter(Boolean)[0];
  const detail = clean.split("/").filter(Boolean).length > 1;
  if (section === "条目正文") {
    mode = isEditableArticlePath(clean) ? "article" : detail
      ? { pets: "pet", skills: "skill", npcs: "npc", events: "event" }[kind] ||
        "article"
      : "index";
  } else if (kind === "pets" && /获取|时间线/.test(section))
    mode = "acquisition";
  else if (kind === "pets" && /对位|Counter/.test(section)) mode = "matchup";
  else if (kind === "pets" && /基础资料|种族值|种族能力/.test(section))
    mode = "pet";
  else if (kind === "skills" && /效果|参数|描述|命中/.test(section))
    mode = "skill";
  else if (kind === "events" && detail && /开放|活动信息|奖励/.test(section))
    mode = "event";
  else if (kind === "npcs" && detail && /人物|位置|服务|身份/.test(section))
    mode = "npc";
  else if (kind === "pve" && /方案|挑战宠物|推荐宠物/.test(section))
    mode = "pve";
  else if (kind === "mechanics" && /关系实测/.test(section))
    mode = "relationship";
  return {
    entity: entity || known?.title || pageVisual(clean).label,
    section,
    mode,
    returnTo: clean,
    ...overrides,
  };
}

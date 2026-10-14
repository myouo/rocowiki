import { pets, skills, npcs, places, getSearchRecords } from "../data";
import { petMetadata } from "../content/bundled.js";
import { eventData } from "../content/bundled.js";
import { publishedDocs } from "../content/bundled.js";
import { publishedSections } from "../content/bundled.js";
import { pveData } from "../content/bundled.js";
import { calculatorData } from "../content/bundled.js";
import { skillRulePresentation } from "../skillPresentation";
import { resolvePublishedRecords } from "./publishedRecords";
import { pvePetRecords } from "../content/bundled.js";
import { NPC_DETAILS, NPC_SOURCE } from "../npcPresentation";
import { composePublishedDocument } from "./documentComposition";
import { resolvePublishedCatalogPets, resolvePublishedCatalogSkills } from "../catalogPublished";
import { normalizeMatchupBloodline } from "../matchupBloodlines";
import { getBloodlineArticleSnapshot } from "../catalogBloodlines";
import { getPveGuideEditorData, getPveGuidePublishedSnapshot } from "../pvePublished";
import {
  blankAcquisition,
  blankMatchup,
  blankOccurrence,
  cloneData,
  contentRevision,
  normalizeMode,
  safeInternalPath,
  serializeData,
} from "./model";

import { STORAGE_KEY as COMMUNITY_STORAGE_KEY } from "../community/constants";
import { readDemoWorkspace } from "../community/workspaceRepository";
export { COMMUNITY_STORAGE_KEY };
function decodeAnchor(value) { try { return decodeURIComponent(value); } catch { return value; } }

export function editorHref({
  entity = "",
  section = "条目正文",
  mode,
  returnTo = "",
  from,
  record = "",
  intent = "",
  submission = "",
  action,
} = {}) {
  const params = new URLSearchParams({ entity, section });
  if (mode) params.set("mode", normalizeMode(mode));
  if (returnTo || from)
    params.set("returnTo", safeInternalPath(returnTo || from));
  if (record) params.set("record", record);
  if (intent === "add" || action === "create") params.set("intent", "add");
  if (intent === "delete") params.set("intent", "delete");
  if (submission) params.set("submission", submission);
  return `/edit/?${params.toString()}`;
}

export function requestFromQuery(query) {
  const get = (key, fallback = "") =>
    String(query?.get?.(key) || fallback).slice(0, 2000);
  return {
    entity: get("entity", "海芙约忒").slice(0, 100),
    section: get("section", "条目正文").slice(0, 100),
    mode: get("mode"),
    returnTo: safeInternalPath(get("returnTo", get("from")), ""),
    record: get("record").slice(0, 100),
    intent:
      get("intent") === "delete" ? "delete" : get("intent") === "add" || get("action") === "create" ? "add" : "edit",
    submission: get("submission").slice(0, 100),
  };
}

function inferMode(request, path) {
  if (request.mode) return normalizeMode(request.mode);
  if (/获取|时间线|acquisition/.test(request.section)) return "acquisition";
  if (/Counter|对位|matchup/.test(request.section)) return "matchup";
  if (path.startsWith("/events/") && path !== "/events/") return "event";
  if (path.startsWith("/skills/") && path !== "/skills/") return "skill";
  if (path.startsWith("/npcs/") && path !== "/npcs/") return "npc";
  if (path.startsWith("/pets/") && path !== "/pets/") return "pet";
  if (/效果关系实测|覆盖关系|施加方向/.test(request.section))
    return "relationship";
  if ((publishedDocs.documents || []).some((doc) => doc.path === path))
    return "article";
  if (
    [
      "/pets/",
      "/skills/",
      "/events/",
      "/npcs/",
      "/places/",
      "/pve/",
      "/adventure/",
      "/guides/",
      "/tools/",
      "/bloodlines/",
    ].includes(path)
  )
    return "index";
  return "article";
}

const multiline = (value) =>
  Array.isArray(value)
    ? value
        .map((row) =>
          typeof row === "string" ? row : row.name || row.title || "",
        )
        .join("\n")
    : String(value ?? "");
function acquisitionRow(row) {
  return {
    ...blankAcquisition(),
    ...row,
    reward: row.reward || "",
    sourceLabel: row.sourceLabel || "",
  };
}
function occurrenceRow(row) {
  return {
    ...blankOccurrence(),
    ...row,
    rewards: Array.isArray(row.rewards) ? row.rewards.map((reward) => {
      if (typeof reward === "string") return reward;
      if (reward.kind === "evolution_qualification") return `${reward.name}进化资格`;
      if (reward.kind === "pet_or_evolution_qualification") return `${reward.name}（${reward.kindLabel || "宠物或进化资格，获取形式待核实"}）`;
      return reward.name || "";
    }).join("\n") : String(row.rewards || ""),
    conditions: multiline(row.conditions),
  };
}
function matchupRow(row) {
  return {
    ...blankMatchup(),
    ...row,
    conditions: multiline(row.conditions),
    recordedAt: row.recordedAt || "",
    testedAt: row.testedAt || "",
    myBloodline: normalizeMatchupBloodline(row.myBloodline),
    opponentBloodline: normalizeMatchupBloodline(row.opponentBloodline),
  };
}

export function getPublishedSnapshot(request = {}, workspace) {
  const known = getSearchRecords().find(
    (row) => row.title === request.entity || row.to === request.entity,
  );
  const canonical = safeInternalPath(request.returnTo, known?.to || "/");
  const path = canonical.split(/[?#]/)[0];
  const slug = path.split("/").filter(Boolean)[1];
  const mode = inferMode(request, path);
  const entryParameter = new URLSearchParams(canonical.split("?")[1]?.split("#")[0] || "").get("entry") || "";
  const cataloguePets = resolvePublishedCatalogPets({ pets, metadata: petMetadata, submissions: workspace?.submissions || [] });
  const pet = request.intent === "add" && mode === "pet" ? null : cataloguePets.find(
    (row) =>
      row.name === request.entity ||
      (path.startsWith("/pets/") && (row.slug === slug || row.slug === entryParameter || row.slug === request.record)),
  );
  const meta = pet?.metadata || petMetadata.pets[pet?.slug] || {};
  const skill = resolvePublishedCatalogSkills({ skills, submissions: workspace?.submissions || [] }).find(
    (row) =>
      row.name === request.entity ||
      (path.startsWith("/skills/") && (row.slug === slug || row.slug === entryParameter)),
  );
  const npc = npcs.find(
    (row) =>
      row.name === request.entity ||
      (path.startsWith("/npcs/") && row.slug === slug),
  );
  const localNpc =
    mode === "npc" && request.intent !== "add"
      ? (workspace?.submissions || [])
          .filter((row) => {
            if (
              row.status !== "published" ||
              row.editorVersion !== 7 ||
              row.editorMode !== "npc" ||
              !row.typedData
            )
              return false;
            const value = row.typedData;
            return (
              value.name === request.entity ||
              (npc && value.slug === npc.slug) ||
              [request.record, entryParameter]
                .filter(Boolean)
                .some((key) => key === row.id || key === value.slug)
            );
          })
          .sort((a, b) =>
            String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
          )[0]
      : null;
  const npcIdentity =
    npc?.slug ||
    localNpc?.typedData.slug ||
    entryParameter ||
    (localNpc && (request.record || localNpc.id)) ||
    "";
  const activity = (eventData.activities || []).find(
    (row) =>
      row.name === request.entity ||
      row.id === request.entity ||
      row.slug === slug ||
      row.id === slug ||
      row.occurrences?.some(
        (occ) => occ.id === request.record || occ.legacySlug === slug,
      ),
  );
  const doc = (publishedDocs.documents || []).find(
    (row) => row.path === path || row.title === request.entity,
  );
  const composedDoc = doc ? composePublishedDocument({ document: doc, submissions: workspace?.submissions || [] }) : null;
  const pve = (pveData.guides || []).find(
    (row) =>
      row.name === request.entity ||
      (path.startsWith("/pve/") && row.slug === slug),
  );
  let data = {};
  let exists = false;
  let sourcePath = path;
  let localRecords = null;
  let localPve = null;
  const isAdd = request.intent === "add";
  const bloodlineArticle = mode === "article" && path === "/bloodlines/" && entryParameter ? getBloodlineArticleSnapshot(request, workspace) : null;
  const pveGuideSnapshot = mode === "pve-guide" ? getPveGuidePublishedSnapshot(request, workspace) : null;
  if (bloodlineArticle) {
    data = { markdown: bloodlineArticle.markdown };
    exists = bloodlineArticle.exists;
    sourcePath = bloodlineArticle.sourcePath || canonical;
  } else if (mode === "pve-guide") {
    data = pveGuideSnapshot?.data || getPveGuideEditorData(request, workspace);
    // New-entry baseline stays empty after submission allocates its stable ID.
    if (isAdd) data.id = "";
    exists = !isAdd && Boolean(data.id && data.name);
    sourcePath = pveGuideSnapshot?.sourcePath || "content/pve-v6.json · 玩法条目";
  } else if (mode === "acquisition") {
    const resolved = resolvePublishedRecords({
      entity: request.entity,
      entityAliases: pet?.catalogNames || [],
      mode,
      records: meta.acquisitionHistory || [],
      submissions: workspace?.submissions,
    });
    const rows = resolved.records.filter(
      (row) => !request.record || row.id === request.record,
    );
    if (!isAdd && resolved.revision) localRecords = resolved;
    data = { records: isAdd ? [blankAcquisition()] : rows.map(acquisitionRow) };
    exists = !isAdd && rows.length > 0;
    sourcePath = "content/pet-metadata-v6.json · acquisitionHistory";
  } else if (mode === "matchup") {
    const resolved = resolvePublishedRecords({
      entity: request.entity,
      entityAliases: pet?.catalogNames || [],
      mode,
      records: meta.matchups?.pvp || [],
      submissions: workspace?.submissions,
    });
    const rows = resolved.records.filter(
      (row) => !request.record || row.id === request.record,
    );
    if (!isAdd && resolved.revision) localRecords = resolved;
    data = { records: isAdd ? [blankMatchup()] : rows.map(matchupRow) };
    exists = !isAdd && rows.length > 0;
    sourcePath = "content/pet-metadata-v6.json · matchups.pvp";
  } else if (mode === "event") {
    data = activity
      ? {
          id: activity.id,
          name: activity.name,
          summary: activity.summary || "",
          occurrences: (activity.occurrences || []).map(occurrenceRow),
        }
      : {
          id: "",
          name: isAdd ? "" : request.entity || "",
          summary: "",
          occurrences: [],
        };
    exists = !!activity;
    sourcePath = "content/events-v7.json";
  } else if (mode === "skill") {
    const presentation = skill
      ? skillRulePresentation(skill)
      : { base: [], branches: [] };
    data = {
      name: skill?.name || (isAdd ? "" : request.entity || ""),
      number: skill?.number ?? "",
      type: skill?.type || "",
      category: skill?.category || "变化",
      power: skill?.power ?? "",
      pp: skill?.pp ?? "",
      priority: skill?.priority ?? "",
      summary: skill?.summary || "",
      hit: skill?.hit || "",
      common: multiline(presentation.base),
      terms: cloneData(skill?.terms || (skill?.analysisCurrent ? skill.analysis?.terms : []) || []),
      phases: (presentation.branches || []).map((row) => ({
        ...row,
        label: row.label || "",
        when: row.when || "",
        effect: row.effect || "",
        otherwiseWhen: row.otherwiseWhen || "",
        otherwise: row.otherwise || "",
      })),
      sourceUrl: skill?.source || "",
    };
    if (request.record === "learners") data = { slug: skill?.slug || "", name: skill?.name || request.entity || "", learners: cloneData(skill?.learners || []) };
    exists = !!skill;
    sourcePath = "src/wiki/data.js · skills";
  } else if (mode === "npc") {
    const detail = NPC_DETAILS[npc?.slug] || {};
    const area =
      places.find((row) => row.slug === npc?.place)?.name || npc?.role || "";
    data = {
      name: isAdd ? "" : npc?.name || request.entity || "",
      slug: isAdd ? "" : npc?.slug || "",
      aliases: "",
      location: isAdd
        ? ""
        : [area, detail.scene]
            .filter(
              (value, index, values) =>
                value && values.indexOf(value) === index,
            )
            .join(" · "),
      role: isAdd ? "" : detail.identity || "",
      intro: isAdd ? "" : detail.description || npc?.intro || "",
      services: isAdd ? "" : detail.services || "",
      relatedTasks: isAdd ? "" : detail.serviceNote || "",
      sourceUrl: isAdd ? "" : NPC_SOURCE.url,
      sourceTitle: isAdd ? "" : NPC_SOURCE.label,
    };
    if (localNpc)
      data = { ...data, ...cloneData(localNpc.typedData), slug: npcIdentity };
    exists = !isAdd && !!npc;
    sourcePath = "src/wiki/data.js · npcs";
  } else if (mode === "pet") {
    const stats = pet?.stats || [];
    data = {
      name: pet?.name || "",
      slug: pet?.slug || "",
      number: pet?.number ?? "",
      types: multiline(pet?.types),
      group: meta.group || "",
      series: multiline(meta.series),
      experienceType: meta.experienceType ?? "",
      bloodlines: multiline(meta.bloodlines),
      ladderMagic: meta.ladderMagic?.value ?? "",
      heightM: meta.heightM ?? "",
      weightKg: meta.weightKg ?? "",
      color: meta.color || "",
      catchCategory: meta.catchCategory ?? "",
      hp: stats[0] ?? "",
      attack: stats[1] ?? "",
      defense: stats[2] ?? "",
      magicAttack: stats[3] ?? "",
      magicDefense: stats[4] ?? "",
      speed: stats[5] ?? "",
      sourceUrl: pet?.sourceUrl || "",
      ...(request.intent === "delete" ? { deletionReason: pet?.deletionReason || "", redirectTo: pet?.redirectTo || "" } : {}),
    };
    exists = !!pet;
    sourcePath = "content/pet-sources.json / pet-metadata-v6.json";
  } else if (mode === "pve") {
    if (!isAdd && request.record) localPve = (workspace?.submissions || []).filter((row) => row.status === "published" && row.editorVersion === 7 && row.editorMode === "pve" && row.typedData && (row.editorRequest?.returnTo || "").split(/[?#]/)[0] === path && (row.id === request.record || row.editorRequest?.record === request.record)).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || null;
    const recommendation = (pvePetRecords.records || []).find(
      (row) => row.record?.id === request.record && row.guideSlug === pve?.slug,
    );
    const evidence = recommendation?.record;
    data = {
      title: evidence?.direction || pve?.name || request.entity || "",
      challenge: evidence?.opponent || pve?.name || "",
      version: evidence?.recordedAt ? `${evidence.recordedAt} · 历史记录` : "",
      testedAt: evidence?.testedAt || "",
      pets: recommendation
        ? pets.find((row) => row.slug === recommendation.petSlug)?.name ||
          recommendation.petSlug
        : "",
      requirements: multiline(evidence?.conditions),
      steps: isAdd ? "" : evidence?.conclusion || multiline(pve?.steps),
      alternatives: evidence?.limitations || "",
      sourceUrl: evidence?.sourceUrl || "",
    };
    if (localPve) data = { ...data, ...cloneData(localPve.typedData) };
    exists = !!pve || !!localPve;
    sourcePath = "content/pve-v6.json";
  } else if (mode === "index") {
    const groupPath = path === "/" ? "" : path;
    const entries = getSearchRecords()
      .filter((row) => row.to !== path && row.to.startsWith(groupPath))
      .map((row) => ({
        title: row.title,
        href: row.to,
        description: row.meta || "",
      }));
    data = { title: request.entity || "资料目录", description: "", entries: isAdd ? [] : entries };
    exists = !isAdd && entries.length > 0;
    sourcePath = "当前站内目录条目";
  } else if (mode === "relationship") {
    data = {
      sourceEffect: "",
      incomingEffect: "",
      order: "",
      timing: "",
      conditions: "",
      result: "",
      certainty: "待验证",
      reproduction: "",
      sourceUrl: "",
    };
    sourcePath = "新建效果关系记录";
  } else {
    const anchor = canonical.includes("#")
      ? decodeAnchor(canonical.split("#").slice(1).join("#"))
      : "";
    const section = composedDoc?.sections?.find(
      (row) =>
        row.id === anchor ||
        row.id === request.record ||
        row.title === request.section,
    );
    const customSection = (publishedSections.sections || []).find(
      (row) =>
        row.path === path &&
        (row.id === anchor || row.title === request.section),
    );
    const calculatorArticle =
      path === "/tools/damage/" &&
      (request.section === "计算规则" || anchor === "calculation-rules")
        ? calculatorData.powerModel?.publishedArticle
        : undefined;
    data = {
      markdown:
        section?.markdown ??
        composedDoc?.markdown ??
        calculatorArticle ??
        customSection?.markdown ??
        "",
    };
    exists = !!doc || !!customSection || !!calculatorArticle;
    sourcePath =
      doc?.sourceFile ||
      (calculatorArticle
        ? "content/calculator-sources-v7.json"
        : customSection
          ? "当前阅读页章节快照"
          : path);
    if (!exists) {
      const record =
        pet ||
        skill ||
        npc ||
        pve ||
        places.find((row) => row.name === request.entity);
      data.markdown = record
        ? serializeData("index", record)
        : known?.meta || "";
      exists = !!record || !!known;
    }
  }
  const identity = {
    entity: request.entity || known?.title || "未命名条目",
    section: request.section || "条目正文",
    mode,
    record: request.record || "",
    intent: request.intent || "edit",
    returnTo: canonical,
    directoryManaged: mode === "index" && (request.intent !== "add" || path === "/pets/" || path === "/skills/") && ["/pets/", "/skills/", "/bloodlines/", "/npcs/", "/events/", "/places/", "/pve/"].includes(path),
  };
  const sharedEntity = ["event", "skill", "pet", "npc", "pve-guide"].includes(mode);
  const key = mode === "skill" && request.record === "learners" ? `skill-learners::${skill?.slug || request.entity}` : sharedEntity
    ? [
        mode,
        activity?.id || (mode === "pve-guide" && (data.id || request.record)) || (mode === "npc" && npcIdentity) || (mode === "pet" && (pet?.slug || request.record)) || identity.entity,
      ].join("::")
    : [
        identity.entity,
        identity.section,
        mode,
        identity.record || "all",
        isAdd ? "new" : "existing",
      ].join("::");
  const baselineData = cloneData(data);
  const content = !exists && isAdd ? "" : serializeData(mode, data);
  const revision = contentRevision({ mode, data });
  if (mode === "skill" && request.record === "learners") return { ...identity, key, exists, data, content, revision, sourcePath: "宠物技能池、技能原始资料与学习关系补充", scope: skill?.publishedLearnersRevision ? "local" : "bundle", publishedAt: skill?.publishedLearnersAt || null };
  if (bloodlineArticle) return { ...identity, key, exists, data, content, revision, sourcePath, scope: bloodlineArticle.publishedAt ? "local" : "bundle", publishedAt: bloodlineArticle.publishedAt || null };
  if (pveGuideSnapshot) return { ...identity, key, exists: pveGuideSnapshot.exists, data, content, revision, sourcePath, scope: pveGuideSnapshot.publishedAt ? "local" : "bundle", publishedAt: pveGuideSnapshot.publishedAt || null };
  if (mode === "article" && composedDoc) return { ...identity, key, exists: true, data, content, revision, sourcePath, scope: composedDoc.isLocal ? "local" : "bundle", publishedAt: composedDoc.publishedAt };
  if (localRecords)
    return {
      ...identity,
      key,
      exists,
      data,
      content,
      revision: contentRevision({ mode, data }),
      sourcePath,
      scope: "local",
      publishedAt: localRecords.publishedAt,
    };
  const localPet = mode === "pet" && pet?.publishedRevision ? (workspace?.submissions || []).find((row) => row.id === pet.publishedRevision) : null;
  const local =
    localNpc ||
    localPet ||
    localPve ||
    (["acquisition", "matchup"].includes(mode) || (isAdd && !exists)
      ? null
      : (workspace?.submissions || [])
          .filter(
            (row) =>
              row.status === "published" &&
              row.editorVersion === 7 &&
              row.snapshotKey === key &&
              row.typedData,
          )
          .sort((a, b) =>
            String(b.updatedAt).localeCompare(String(a.updatedAt)),
          )[0]);
  return local
    ? {
        ...identity,
        key,
        exists: true,
        data: ["npc", "pet"].includes(mode) ? data : cloneData(local.typedData),
        content: ["npc", "pet"].includes(mode) ? serializeData(mode, data) : local.after,
        revision: contentRevision({ mode, data: ["npc", "pet"].includes(mode) ? data : local.typedData }),
        sourcePath,
        scope: "local",
        publishedAt: local.updatedAt,
        bundledData: baselineData,
      }
    : {
        ...identity,
        key,
        exists,
        data,
        content,
        revision,
        sourcePath,
        scope: "bundle",
        publishedAt: null,
      };
}

export function readLocalPublished(request) {
  if (typeof window === "undefined") return null;
  try {
    const workspace = readDemoWorkspace();
    const snapshot = getPublishedSnapshot(request, workspace);
    return snapshot.scope === "local" ? snapshot : null;
  } catch {
    return null;
  }
}

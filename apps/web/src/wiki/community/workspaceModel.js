import { normalizeAvatar } from "./profileModel";
import { normalizeRegistrationUid, UUID_RE } from "../communitySocialModel";
import { sanitizeData } from "../editing/model";
import { KNOWN_STATUSES } from "./constants.js";
import { makeSeed } from "./demo/fixtures.js";

function safeText(value, length = 10000) {
  return typeof value === "string" ? value.slice(0, length) : "";
}

function safeFields(value) {
  return {
    trigger: safeText(value?.trigger, 2000),
    effect: safeText(value?.effect, 4000),
    limits: safeText(value?.limits, 2000),
  };
}

function normalizeWorkspace(value) {
  if (!value || typeof value !== "object" || value.version !== 1)
    return makeSeed();
  const seed = makeSeed();
  return {
    version: 1,
    profile: {
      uuid: UUID_RE.test(value.profile?.uuid || "") ? value.profile.uuid.toLowerCase() : "",
      uid: normalizeRegistrationUid(value.profile?.uid),
      avatar: normalizeAvatar(value.profile?.avatar),
      nickname:
        typeof value.profile?.nickname === "string"
          ? value.profile.nickname.slice(0, 24)
          : "",
      bio:
        typeof value.profile?.bio === "string"
          ? value.profile.bio.slice(0, 160)
          : "",
    },
    drafts: Array.isArray(value.drafts)
      ? value.drafts
          .filter(
            (d) =>
              d &&
              typeof d.key === "string" &&
              typeof d.target === "string" &&
              typeof d.section === "string" &&
              (d.type === "structured" || d.type === "markdown"),
          )
          .map((d) => ({
            ...d,
            fields: safeFields(d.fields),
            ...(d.editorVersion === 7
              ? {
                  typedData: sanitizeData(d.typedData),
                  baseData: sanitizeData(d.baseData),
                  editorRequest: sanitizeData(d.editorRequest),
                  baseContent: safeText(d.baseContent, 50000),
                }
              : {}),
            markdown: safeText(d.markdown),
            summary: safeText(d.summary, 500),
            evidenceUrl: safeText(d.evidenceUrl, 2000),
            evidenceNote: safeText(d.evidenceNote, 3000),
            baseVersion: safeText(d.baseVersion, 80) || "demo-r17",
            revisesSubmissionId: safeText(d.revisesSubmissionId, 100),
            updatedAt: safeText(d.updatedAt, 40),
          }))
          .slice(0, 80)
      : [],
    claimedTasks: Array.isArray(value.claimedTasks)
      ? value.claimedTasks.filter((t) => typeof t === "string")
      : [],
    submissions: Array.isArray(value.submissions)
      ? value.submissions
          .filter(
            (s) =>
              s &&
              typeof s.id === "string" &&
              typeof s.target === "string" &&
              typeof s.section === "string" &&
              typeof s.before === "string" &&
              typeof s.after === "string" &&
              KNOWN_STATUSES.has(s.status),
          )
          .map((s) => ({
            ...s,
            type: s.type === "structured" ? "structured" : "markdown",
            before: safeText(s.before, 50000),
            after: safeText(s.after, 50000),
            markdown: safeText(s.markdown),
            summary: safeText(s.summary, 500),
            evidenceUrl: safeText(s.evidenceUrl, 2000),
            evidenceNote: safeText(s.evidenceNote, 3000),
            fields: safeFields(s.fields),
            ...(s.editorVersion === 7
              ? {
                  typedData: sanitizeData(s.typedData),
                  baseData: sanitizeData(s.baseData),
                  editorRequest: sanitizeData(s.editorRequest),
                  baseContent: safeText(s.baseContent, 50000),
                }
              : {}),
            author: safeText(s.author, 24) || "本地访客",
            authorId: UUID_RE.test(s.authorId || "") ? s.authorId : "",
            authorAvatar: normalizeAvatar(s.authorAvatar),
            firstPublishedAt: safeText(s.firstPublishedAt, 40),
            baseVersion: safeText(s.baseVersion, 80) || "demo-r17",
            reviewNote: safeText(s.reviewNote, 1200),
            submittedAt: safeText(s.submittedAt, 40),
            updatedAt: safeText(s.updatedAt, 40),
            revisionCount:
              Number.isInteger(s.revisionCount) && s.revisionCount > 0
                ? s.revisionCount
                : 1,
            events: Array.isArray(s.events)
              ? s.events
                  .filter((e) => e && typeof e.label === "string")
                  .map((e) => ({
                    label: safeText(e.label, 120),
                    at: safeText(e.at, 40),
                    note: safeText(e.note, 1200),
                  }))
                  .slice(-200)
              : [],
          }))
          .slice(0, 100)
      : seed.submissions,
  };
}

export { normalizeWorkspace };

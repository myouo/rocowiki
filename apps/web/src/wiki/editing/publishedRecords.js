import { contentRevision, sanitizeData } from "./model";
import { matchupBloodlineClaim, normalizeMatchupBloodline } from "../matchupBloodlines";

const recordObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
function recordList(value, mode) {
  if (!Array.isArray(value)) return [];
  return value.filter(recordObject).map((input) => {
    const row = sanitizeData(input);
    const fields =
      mode === "matchup"
        ? [
            "id",
            "opponent",
            "opponentSlug",
            "direction",
            "conclusion",
            "scene",
            "sceneDirection",
            "sceneDirectionFor",
            "limitations",
            "evidenceLabel",
            "sourceLabel",
            "sourceUrl",
            "recordedAt",
            "testedAt",
            "claimRevision",
          ]
        : [
            "id",
            "activityId",
            "occurrenceId",
            "title",
            "kind",
            "startDate",
            "endDate",
            "place",
            "conditions",
            "method",
            "reward",
            "sourceUrl",
            "sourceLabel",
            "evidence",
          ];
    for (const field of fields)
      if (typeof row[field] !== "string") row[field] = "";
    if (mode === "matchup") {
      row.myBloodline = normalizeMatchupBloodline(row.myBloodline);
      row.opponentBloodline = normalizeMatchupBloodline(row.opponentBloodline);
      row.conditions = Array.isArray(row.conditions)
        ? row.conditions.filter((part) => typeof part === "string")
        : typeof row.conditions === "string"
          ? row.conditions
          : "";
      row.relatedSkills = Array.isArray(row.relatedSkills)
        ? row.relatedSkills.filter((part) => typeof part === "string")
        : [];
      if (
        ![
          "lead-together",
          "switch-in",
          "already-active",
          "unspecified",
        ].includes(row.scene)
      )
        row.scene = "unspecified";
    }
    return row;
  });
}
const modeName = (value) =>
  value === "counter"
    ? "matchup"
    : value === "timeline"
      ? "acquisition"
      : value;
const lines = (value) =>
  (Array.isArray(value) ? value : String(value || "").split(/\r?\n/))
    .map((part) => String(part).trim())
    .filter(Boolean);

function claimContent(record) {
  return {
    opponent: record.opponent || "",
    opponentSlug: record.opponentSlug || "",
    scene: record.scene || "unspecified",
    sceneDirection: record.sceneDirection || "",
    direction: record.direction || "",
    conclusion: record.conclusion || "",
    conditions: lines(record.conditions),
    limitations: record.limitations || "",
    sourceUrl: record.sourceUrl || "",
    recordedAt: record.recordedAt || "",
    testedAt: record.testedAt || "",
    myBloodline: matchupBloodlineClaim(record.myBloodline),
    opponentBloodline: matchupBloodlineClaim(record.opponentBloodline),
  };
}

function publishedRecord(row, before, submission, index, mode, forceId) {
  const id = forceId || row.id || `local-${submission.id}-${index + 1}`;
  const next = { ...row, id: String(id).slice(0, 150) };
  if (mode === "matchup") {
    const explicitSceneBinding = next.sceneDirectionFor === next.scene;
    const compatibleExistingWording =
      before &&
      next.scene === before.scene &&
      next.sceneDirection === before.sceneDirection &&
      before.sceneDirectionFor === before.scene;
    if (
      next.sceneDirection &&
      (explicitSceneBinding || compatibleExistingWording)
    ) {
      next.sceneDirectionFor = next.scene;
    } else {
      // The editor can change the scene without editing legacy explanatory text.
      // Unbound or stale wording must never contradict the newly selected scene.
      next.sceneDirection = "";
      next.sceneDirectionFor = next.scene;
    }
    const revision = contentRevision(claimContent(next));
    const unchanged =
      before && contentRevision(claimContent(before)) === revision;
    next.claimRevision = unchanged
      ? before.claimRevision || "r1"
      : `local-${submission.id}-${revision.slice(4)}`;
  }
  return next;
}

/** Resolve published section replacements, row edits and additions in publish order. */
export function resolvePublishedRecords({
  entity,
  entityAliases = [],
  mode,
  records,
  submissions,
}) {
  const resolvedMode = modeName(mode);
  let result = recordList(records, resolvedMode).map((record) =>
    resolvedMode === "matchup" && record.sceneDirection
      ? {
          ...record,
          sceneDirectionFor: record.sceneDirectionFor || record.scene,
        }
      : record,
  );
  const relevant = (Array.isArray(submissions) ? submissions : [])
    .filter((submission) => {
      if (
        !recordObject(submission) ||
        submission.status !== "published" ||
        submission.editorVersion !== 7 ||
        !Array.isArray(submission.typedData?.records)
      )
        return false;
      const request = submission.editorRequest || {};
      return (
        [entity, ...entityAliases].includes(request.entity || submission.target) &&
        modeName(submission.editorMode || request.mode) === resolvedMode
      );
    })
    .slice()
    .sort(
      (a, b) =>
        String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")) ||
        String(a.id || "").localeCompare(String(b.id || "")),
    );

  for (const submission of relevant) {
    const request = submission.editorRequest || {};
    const rows = recordList(submission.typedData.records, resolvedMode);
    const recordId = typeof request.record === "string" ? request.record : "";
    const adding = request.intent === "add" || request.action === "create";
    if (adding) {
      const ids = new Set(result.map((row) => row.id));
      for (const [index, row] of rows.entries()) {
        const next = publishedRecord(
          row,
          null,
          submission,
          index,
          resolvedMode,
        );
        if (ids.has(next.id)) continue;
        result.push(next);
        ids.add(next.id);
      }
    } else if (recordId) {
      const index = result.findIndex((row) => row.id === recordId);
      if (!rows.length) {
        result = result.filter((row) => row.id !== recordId);
      } else {
        const selected = rows.find((row) => row.id === recordId) || rows[0];
        const next = publishedRecord(
          selected,
          index >= 0 ? result[index] : null,
          submission,
          0,
          resolvedMode,
          recordId,
        );
        if (index >= 0) result[index] = next;
        else result.push(next);
      }
    } else {
      const previous = new Map(result.map((row) => [row.id, row]));
      const seen = new Set();
      result = rows
        .map((row, index) =>
          publishedRecord(
            row,
            previous.get(row.id),
            submission,
            index,
            resolvedMode,
          ),
        )
        .filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          return true;
        });
    }
  }
  const last = relevant.at(-1);
  return {
    records: result,
    revision: last
      ? typeof last.id === "string"
        ? last.id
        : "local-records"
      : null,
    publishedAt: typeof last?.updatedAt === "string" ? last.updatedAt : null,
  };
}

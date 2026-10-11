/* Local preview storage only. Server implementations must validate identity and revision. */
import { matchupBloodlineClaim } from "./matchupBloodlines";
export const COUNTER_VOTE_KEY = "roco-wiki-v7:counter-votes";
export const COUNTER_VISITOR_KEY = "roco-wiki-v7:counter-visitor";
export const COUNTER_VOTE_EVENT = "roco:counter-votes-changed";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const validVoter = (value) =>
  typeof value === "string" &&
  /^(guest|user):[A-Za-z0-9.%_~-]{1,180}$/.test(value);
const validTarget = (value) =>
  typeof value === "string" &&
  value.length <= 300 &&
  /^[a-z0-9._-]+\/[a-z0-9._-]+\/[a-z0-9._-]+\/[a-z0-9._-]+\/[a-f0-9]{8}$/i.test(
    value,
  );

export function emptyCounterVotes() {
  return { schemaVersion: 1, votes: {} };
}

export function normalizeCounterVotes(value) {
  const result = emptyCounterVotes();
  if (!object(value) || value.schemaVersion !== 1 || !object(value.votes))
    return result;
  for (const [target, voters] of Object.entries(value.votes).slice(-300)) {
    if (!validTarget(target) || !object(voters)) continue;
    const entries = {};
    for (const [voter, ballot] of Object.entries(voters).slice(-100)) {
      if (
        !validVoter(voter) ||
        !object(ballot) ||
        ![1, -1].includes(ballot.choice)
      )
        continue;
      entries[voter] = {
        choice: ballot.choice,
        updatedAt:
          typeof ballot.updatedAt === "string" &&
          Number.isFinite(Date.parse(ballot.updatedAt))
            ? ballot.updatedAt.slice(0, 40)
            : null,
      };
    }
    if (Object.keys(entries).length) result.votes[target] = entries;
  }
  return result;
}

function fingerprint(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function counterClaimKey(petSlug, record) {
  // The digest prevents accidental reuse when a local edit changes a claim without bumping rN.
  const claim = JSON.stringify({
    opponent: record.opponent,
    opponentSlug: record.opponentSlug || null,
    direction: record.direction,
    conclusion: record.conclusion,
    conditions: record.conditions || [],
    myBloodline: matchupBloodlineClaim(record.myBloodline),
    opponentBloodline: matchupBloodlineClaim(record.opponentBloodline),
    limitations: record.limitations || "",
    scene: record.scene || "unspecified",
    sceneDirection: record.sceneDirection || "",
    recordedAt: record.recordedAt || null,
    testedAt: record.testedAt || null,
    sourceUrl: record.sourceUrl || null,
  });
  const safe = (value) =>
    String(value)
      .replace(/[^a-z0-9._-]/gi, "_")
      .slice(0, 70);
  return `${safe(petSlug)}/${safe(record.id)}/${safe(record.claimRevision || "r1")}/${safe(record.scene || "unspecified")}/${fingerprint(claim)}`;
}

export function counterVoter({ authenticatedUserId, guestId }) {
  if (typeof authenticatedUserId === "string" && authenticatedUserId.trim()) {
    return (
      "user:" + encodeURIComponent(authenticatedUserId.trim()).slice(0, 180)
    );
  }
  return validVoter(guestId) && guestId.startsWith("guest:") ? guestId : null;
}

export function counterVoteSummary(state, target, voter) {
  const ballots = own(state.votes || {}, target) ? state.votes[target] : {};
  const all = Object.values(ballots);
  const support = all.filter((vote) => vote.choice === 1).length;
  const oppose = all.filter((vote) => vote.choice === -1).length;
  const total = support + oppose;
  return {
    support,
    oppose,
    total,
    supportRate: total ? Math.round((support / total) * 100) : null,
    choice: voter && own(ballots, voter) ? ballots[voter].choice : 0,
  };
}

export function toggleCounterVote(
  state,
  target,
  voter,
  choice,
  now = new Date().toISOString(),
) {
  const next = normalizeCounterVotes(state);
  if (!validVoter(voter) || ![1, -1].includes(choice) || !validTarget(target))
    return next;
  const ballots = { ...(next.votes[target] || {}) };
  if (ballots[voter]?.choice === choice) delete ballots[voter];
  else ballots[voter] = { choice, updatedAt: now };
  if (Object.keys(ballots).length) next.votes[target] = ballots;
  else delete next.votes[target];
  return next;
}

export function adoptVisitorCounterVotes(state, guestId, userId) {
  const next = normalizeCounterVotes(state);
  if (
    !validVoter(guestId) ||
    !guestId.startsWith("guest:") ||
    !validVoter(userId) ||
    !userId.startsWith("user:")
  )
    return next;
  for (const ballots of Object.values(next.votes)) {
    if (!own(ballots, guestId)) continue;
    // An existing account ballot wins; logging in never counts the same person's guest vote twice.
    if (!own(ballots, userId)) ballots[userId] = ballots[guestId];
    delete ballots[guestId];
  }
  return next;
}

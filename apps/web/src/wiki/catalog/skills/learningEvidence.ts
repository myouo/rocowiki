// SPDX-License-Identifier: GPL-3.0-only
export interface LearningEvidence { method: string; level: number | null; gameObserved?: boolean }
export function mergeLearningEvidence(previous: LearningEvidence, details: LearningEvidence): LearningEvidence {
  if (details.gameObserved) return { method: details.method, level: details.level, gameObserved: true };
  if (previous.gameObserved) return previous;
  return { method: details.method || previous.method, level: details.level ?? previous.level, gameObserved: false };
}

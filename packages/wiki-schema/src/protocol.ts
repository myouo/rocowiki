// Lightweight protocol shared by the API and browser. No database or content imports.
export const editorKinds = ['article', 'pet', 'skill'] as const;
export const states = ['pending_review','changes_requested','rejected','approved','git_pending','git_pr_open','git_merged','deploying','published','conflict','retryable_error','cancelled'] as const;
export type SubmissionState = typeof states[number];

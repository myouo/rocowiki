CREATE TABLE publication_reconciliation_errors (
  revision_id TEXT PRIMARY KEY REFERENCES submissions(revision_id),
  release_id TEXT NOT NULL REFERENCES deployments(release_id),
  error_code TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts>0),
  next_attempt_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX reconciliation_errors_due ON publication_reconciliation_errors(next_attempt_at,updated_at);

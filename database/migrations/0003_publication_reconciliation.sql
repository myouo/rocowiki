-- Stable keyset pagination; each sweep has a fixed end so new records cannot
-- starve old publications. A lease fences concurrent Cron/webhook invocations.
CREATE TABLE publication_reconciliation (
  name TEXT PRIMARY KEY CHECK(name='published'),
  release_id TEXT REFERENCES deployments(release_id),
  cursor_created_at INTEGER, cursor_revision_id TEXT,
  end_created_at INTEGER, end_revision_id TEXT,
  lease_token TEXT, lease_until INTEGER,
  completed_passes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  CHECK((cursor_created_at IS NULL)=(cursor_revision_id IS NULL)),
  CHECK((end_created_at IS NULL)=(end_revision_id IS NULL))
);
CREATE INDEX published_scan_order ON submissions(created_at,revision_id) WHERE status='published';

PRAGMA foreign_keys = ON;
CREATE TABLE users (
  uid TEXT PRIMARY KEY CHECK(uid GLOB 'usr_*'), username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  role TEXT NOT NULL DEFAULT 'contributor' CHECK(role IN ('viewer','contributor','reviewer','admin')),
  created_at INTEGER NOT NULL, disabled_at INTEGER
);
CREATE TABLE oidc_identities (
  issuer TEXT NOT NULL, subject TEXT NOT NULL, uid TEXT NOT NULL REFERENCES users(uid), PRIMARY KEY(issuer,subject)
);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(uid), csrf_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL, authenticated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('oidc','github')),
  uid TEXT REFERENCES users(uid), session_hash TEXT, browser_hash TEXT NOT NULL,
  verifier TEXT, nonce TEXT, expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_expiry ON oauth_states(expires_at);
CREATE TABLE github_identities (
  uid TEXT PRIMARY KEY REFERENCES users(uid), github_numeric_id INTEGER NOT NULL UNIQUE,
  login TEXT NOT NULL, coauthor_email TEXT, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  consent_version TEXT, consent_at INTEGER, binding_version TEXT NOT NULL,
  CHECK(enabled=0 OR (coauthor_email IS NOT NULL AND consent_at IS NOT NULL))
);
CREATE TABLE drafts (
  draft_id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(uid), page_id TEXT NOT NULL,
  body_json TEXT NOT NULL CHECK(json_valid(body_json)), updated_at INTEGER NOT NULL
);
CREATE INDEX drafts_owner ON drafts(uid,updated_at);
CREATE TABLE submissions (
  revision_id TEXT PRIMARY KEY, uid TEXT NOT NULL REFERENCES users(uid), page_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending_review','changes_requested','rejected','approved','git_pending','git_pr_open','git_merged','deploying','published','conflict','retryable_error','cancelled')),
  edit_summary TEXT NOT NULL, required_reviews INTEGER NOT NULL CHECK(required_reviews IN (1,2)),
  idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, supersedes TEXT REFERENCES submissions(revision_id),
  version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(uid,idempotency_key)
);
CREATE INDEX submissions_author ON submissions(uid,created_at);
CREATE INDEX submissions_status ON submissions(status,created_at);
CREATE TABLE submission_content (
  revision_id TEXT PRIMARY KEY REFERENCES submissions(revision_id), content TEXT NOT NULL,
  base_content TEXT NOT NULL, base_commit_sha TEXT NOT NULL, base_blob_sha TEXT NOT NULL,
  sources_json TEXT NOT NULL CHECK(json_valid(sources_json)), coauthor_json TEXT CHECK(coauthor_json IS NULL OR json_valid(coauthor_json))
);
CREATE TRIGGER immutable_content_update BEFORE UPDATE ON submission_content BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
CREATE TRIGGER immutable_content_delete BEFORE DELETE ON submission_content BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
CREATE TRIGGER immutable_submission BEFORE UPDATE ON submissions
WHEN NEW.uid!=OLD.uid OR NEW.page_id!=OLD.page_id OR NEW.snapshot_hash!=OLD.snapshot_hash OR NEW.request_hash!=OLD.request_hash OR NEW.edit_summary!=OLD.edit_summary OR NEW.required_reviews!=OLD.required_reviews OR NEW.idempotency_key!=OLD.idempotency_key OR NEW.supersedes IS NOT OLD.supersedes
BEGIN SELECT RAISE(ABORT,'immutable revision'); END;
CREATE TABLE reviews (
  review_id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES submissions(revision_id), reviewer_uid TEXT NOT NULL REFERENCES users(uid),
  verdict TEXT NOT NULL CHECK(verdict IN ('approve','changes_requested','reject')), comment TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(revision_id,reviewer_uid)
);
CREATE TRIGGER no_self_review BEFORE INSERT ON reviews
WHEN NEW.reviewer_uid=(SELECT uid FROM submissions WHERE revision_id=NEW.revision_id)
BEGIN SELECT RAISE(ABORT,'self review forbidden'); END;
CREATE TRIGGER immutable_review_update BEFORE UPDATE ON reviews BEGIN SELECT RAISE(ABORT,'immutable review'); END;
CREATE TRIGGER immutable_review_delete BEFORE DELETE ON reviews BEGIN SELECT RAISE(ABORT,'immutable review'); END;
CREATE TABLE publish_jobs (
  job_id TEXT PRIMARY KEY, revision_id TEXT NOT NULL UNIQUE REFERENCES submissions(revision_id),
  stage TEXT NOT NULL DEFAULT 'git' CHECK(stage IN ('git','pr','deploy','done','conflict','blocked')),
  idempotency_key TEXT NOT NULL UNIQUE, lease_token TEXT, lease_until INTEGER, retries INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL, last_error TEXT, resume_stage TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_due ON publish_jobs(stage,next_attempt_at,lease_until);
-- Atomic transactional outbox: approval and its publishing job cannot separate.
CREATE TRIGGER approved_outbox AFTER UPDATE OF status ON submissions
WHEN NEW.status='approved' AND OLD.status!='approved'
BEGIN
  INSERT INTO publish_jobs(job_id,revision_id,idempotency_key,next_attempt_at,created_at,updated_at)
  VALUES('job_'||NEW.revision_id,NEW.revision_id,NEW.revision_id||':publish',NEW.updated_at,NEW.updated_at,NEW.updated_at);
END;
CREATE TABLE git_links (
  revision_id TEXT PRIMARY KEY REFERENCES submissions(revision_id), branch TEXT NOT NULL UNIQUE,
  pr_number INTEGER, content_commit_sha TEXT NOT NULL, merge_sha TEXT
);
CREATE TABLE deployments (
  release_id TEXT PRIMARY KEY, source_sha TEXT NOT NULL, artifact_digest TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment='production'), status TEXT NOT NULL CHECK(status IN ('reported','verified')),
  deployed_at INTEGER NOT NULL, verified_at INTEGER
);
CREATE INDEX deployment_sha ON deployments(source_sha);
CREATE TABLE publication_events (
  event_id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES submissions(revision_id), release_id TEXT NOT NULL REFERENCES deployments(release_id),
  action TEXT NOT NULL CHECK(action IN ('published','withdrawn')), created_at INTEGER NOT NULL, UNIQUE(revision_id,release_id,action)
);
CREATE TABLE webhook_events (
  delivery_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, received_at INTEGER NOT NULL, processed_at INTEGER
);
CREATE TABLE rate_limits (key_hash TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX rate_expiry ON rate_limits(expires_at);
CREATE TABLE audit_events (
  event_id TEXT PRIMARY KEY, actor_uid TEXT REFERENCES users(uid), action TEXT NOT NULL,
  target_id TEXT NOT NULL, ts INTEGER NOT NULL, metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata))
);
CREATE INDEX audit_target ON audit_events(target_id,ts);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'append-only audit'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'append-only audit'); END;

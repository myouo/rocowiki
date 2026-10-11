CREATE UNIQUE INDEX users_username_casefold ON users(lower(username));
CREATE TRIGGER immutable_user_identity BEFORE UPDATE ON users
WHEN NEW.uid IS NOT OLD.uid OR NEW.username IS NOT OLD.username
BEGIN SELECT RAISE(ABORT,'immutable user identity'); END;

CREATE TABLE password_credentials (
  uid TEXT PRIMARY KEY REFERENCES users(uid),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(email) BETWEEN 3 AND 254 AND email=lower(email)),
  password_hash TEXT NOT NULL,
  credential_version INTEGER NOT NULL DEFAULT 1 CHECK(credential_version>0),
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TRIGGER revoke_password_sessions AFTER UPDATE OF password_hash ON password_credentials
WHEN NEW.password_hash!=OLD.password_hash
BEGIN UPDATE sessions SET revoked_at=NEW.updated_at WHERE uid=NEW.uid AND revoked_at IS NULL; END;

CREATE TABLE account_tokens (
  token_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES password_credentials(uid),
  purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),
  credential_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, consumed_at INTEGER, claim_id TEXT
);
CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);

-- Pending registrations do not own a permanent username, UID or credentials.
CREATE TABLE pending_registrations (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  registration_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL, display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX pending_registrations_expiry ON pending_registrations(expires_at);

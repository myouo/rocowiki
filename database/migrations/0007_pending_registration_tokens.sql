-- SPDX-License-Identifier: GPL-3.0-only
-- Resends preserve all links until the registration is confirmed, replaced or expires.
CREATE TABLE pending_registration_tokens (
  token_hash TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES pending_registrations(registration_id) ON DELETE CASCADE
);
CREATE INDEX pending_registration_tokens_registration ON pending_registration_tokens(registration_id);

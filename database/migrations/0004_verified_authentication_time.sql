-- Previous versions recorded callback arrival time as authentication time.
-- Keep existing login sessions, but require fresh OIDC verification for sensitive actions.
UPDATE sessions SET authenticated_at=0;

CREATE TABLE mirror_observations (
  observation_id TEXT PRIMARY KEY, source_sha TEXT NOT NULL, mirror_sha TEXT,
  status TEXT NOT NULL CHECK(status IN ('synced','lagging','failed')), checked_at INTEGER NOT NULL
);
CREATE INDEX mirror_time ON mirror_observations(checked_at);

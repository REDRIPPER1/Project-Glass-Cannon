-- Derived anonymous local-demo state for the book library and progression APIs.
-- The profile JSON remains the compatibility source of truth; these tables make
-- one-time claims and permanent local ownership auditable without payments.
CREATE TABLE IF NOT EXISTS book_ownership (
  profile_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  owned_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, book_id)
);

CREATE TABLE IF NOT EXISTS quest_awards (
  profile_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  awarded_xp INTEGER NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, attempt_id)
);

CREATE TABLE IF NOT EXISTS collection_state (
  profile_id TEXT NOT NULL,
  collection_type TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  earned_at TEXT,
  PRIMARY KEY (profile_id, collection_type, catalog_id)
);

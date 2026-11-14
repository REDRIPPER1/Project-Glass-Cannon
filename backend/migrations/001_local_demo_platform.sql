-- Versioned local-only persistence for the optional LitLearn companion APIs.
-- Values are anonymous demo-profile state; no payment details are stored.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  profile_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  xp INTEGER NOT NULL,
  level INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  profile_id TEXT NOT NULL,
  inventory_type TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (profile_id, inventory_type, catalog_id)
);

CREATE TABLE IF NOT EXISTS currencies (
  profile_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  balance INTEGER NOT NULL,
  PRIMARY KEY (profile_id, currency)
);

CREATE TABLE IF NOT EXISTS rewards (
  reward_instance_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  claim_status TEXT NOT NULL,
  source TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  claimed_at TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  shop_item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reversible INTEGER NOT NULL,
  reversed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  profile_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  features_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_pass_progress (
  profile_id TEXT NOT NULL,
  battle_pass_id TEXT NOT NULL,
  progress INTEGER NOT NULL,
  claim_state_json TEXT NOT NULL,
  PRIMARY KEY (profile_id, battle_pass_id)
);

CREATE TABLE IF NOT EXISTS wishlists (
  profile_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  PRIMARY KEY (profile_id, item_type, catalog_id)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  properties_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

-- Wallet migration and auditable local Wishlist Page redemptions.
-- All records are anonymous local-demo state; no payment data is retained.
CREATE TABLE IF NOT EXISTS wallet_migrations (
  profile_id TEXT PRIMARY KEY,
  migration_version INTEGER NOT NULL,
  migrated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wishlist_redemptions (
  redemption_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  selected_book_id TEXT NOT NULL,
  consumed_pages INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL
);

-- Migration 0018: create atlas_adapter_user_profiles table
--
-- Backs the D1StorageAdapter 'userProfiles' collection.
-- payload_json holds a complete serialised UserProfileV1 object.
--
-- Each row is keyed by userId (one profile per user).
-- The profile stores display name, tenant roles, and per-user preferences.
-- Email is stored in payload_json only — it must never be projected into
-- analytics queries or exported aggregates.
--
-- This table is only queried when the D1 storage adapter is active;
-- local (browser localStorage) mode does not touch this table.

CREATE TABLE IF NOT EXISTS atlas_adapter_user_profiles (
  id           TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_atlas_adapter_user_profiles_updated_at
  ON atlas_adapter_user_profiles (updated_at DESC);

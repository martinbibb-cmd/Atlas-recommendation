-- Migration 0019: create user_oauth_tokens table
--
-- Stores Google OAuth access and refresh tokens per user.
-- The access_token is short-lived (1 hour). The refresh_token is long-lived
-- and must be kept secure — never expose it to the client.
--
-- expires_at is an ISO-8601 timestamp; the worker checks this before each
-- Drive API call and refreshes automatically when it is in the past.
--
-- This table is the "glue" that lets Atlas reconnect to a user's Google
-- Drive on every subsequent request without requiring a full re-auth flow.

CREATE TABLE IF NOT EXISTS user_oauth_tokens (
  user_id       TEXT    PRIMARY KEY,
  provider      TEXT    NOT NULL DEFAULT 'google',
  access_token  TEXT    NOT NULL,
  refresh_token TEXT,
  expires_at    TEXT    NOT NULL,
  scope         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

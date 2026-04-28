-- Migration 0009: create transcripts table
--
-- Stores voice-note transcripts and AI-generated summaries associated with
-- a scan session, optionally scoped to a room.

CREATE TABLE IF NOT EXISTS transcripts (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  room_id    TEXT,
  source     TEXT NOT NULL CHECK (source IN ('voice_note', 'ai_summary')),
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);

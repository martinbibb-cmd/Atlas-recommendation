-- Migration 0011: add voice_note_id column to transcripts table
--
-- Adds a nullable voice_note_id column so that transcripts stored from
-- SessionCaptureV2 voice notes can be cross-referenced back to the
-- originating voice note entity within the capture.
--
-- The column is nullable because AI-generated summaries (source = 'ai_summary')
-- do not have a corresponding voice note.

ALTER TABLE transcripts ADD COLUMN voice_note_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transcripts_voice_note_id ON transcripts(voice_note_id)
  WHERE voice_note_id IS NOT NULL;

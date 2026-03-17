-- Migration 0001: create reports table
--
-- Stores persisted Atlas digital reports.
-- payload_json holds the canonical saved-report snapshot:
--   { surveyData, engineInput, engineOutput, decisionSynthesis }

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  title         TEXT,
  customer_name TEXT,
  postcode      TEXT,
  payload_json  TEXT NOT NULL
);

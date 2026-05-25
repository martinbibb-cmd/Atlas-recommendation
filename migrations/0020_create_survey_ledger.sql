-- Migration 0020: create survey_ledger table
--
-- Lightweight ledger that records the outcome of every "Finalize & Push to
-- Drive" operation.  Each row stores only the tiny metadata needed for the
-- dashboard list view — no large blobs.
--
-- Drive identifiers allow the worker to retrieve the full JSON data file or
-- PDF directly from Google Drive when the user opens a survey detail view.
--
-- Indexed columns support the dashboard filter queries described in the
-- hybrid-architecture design:
--   "Show me all properties surveyed in Christchurch with heat loss > 6 kW"

CREATE TABLE IF NOT EXISTS survey_ledger (
  id                  TEXT PRIMARY KEY,
  visit_id            TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  customer_name       TEXT,
  postcode            TEXT,
  finalized_at        TEXT NOT NULL,
  drive_folder_id     TEXT,
  drive_folder_url    TEXT,
  drive_data_file_id  TEXT,
  drive_data_file_url TEXT,
  drive_pdf_file_id   TEXT,
  drive_pdf_file_url  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_survey_ledger_user_id
  ON survey_ledger (user_id);

CREATE INDEX IF NOT EXISTS idx_survey_ledger_visit_id
  ON survey_ledger (visit_id);

CREATE INDEX IF NOT EXISTS idx_survey_ledger_finalized_at
  ON survey_ledger (finalized_at DESC);

CREATE INDEX IF NOT EXISTS idx_survey_ledger_postcode
  ON survey_ledger (postcode);

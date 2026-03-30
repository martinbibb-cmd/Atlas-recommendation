-- Migration 0005: add perimeter and bearing columns
--
-- Adds queryable columns for ground-floor perimeter, ground-floor area,
-- and building compass bearing to both the visits (in-progress) and
-- reports (finalised) tables.
--
-- These values are derived from the heat-loss step's drawn polygon and
-- the compass control on the floor plan / heat-loss step respectively.
-- The authoritative data lives in working_payload_json / payload_json;
-- these columns are denormalised copies for fast server-side queries
-- (e.g. filtering by property size or clustering by building orientation).
--
-- Both columns are nullable — they are absent when the surveyor has not
-- yet drawn the perimeter or set the compass bearing.

ALTER TABLE visits ADD COLUMN perimeter_m          REAL;
ALTER TABLE visits ADD COLUMN ground_floor_area_m2  REAL;
ALTER TABLE visits ADD COLUMN building_bearing_deg  REAL;

ALTER TABLE reports ADD COLUMN perimeter_m          REAL;
ALTER TABLE reports ADD COLUMN ground_floor_area_m2 REAL;
ALTER TABLE reports ADD COLUMN building_bearing_deg REAL;

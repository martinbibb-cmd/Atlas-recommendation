/**
 * ReportView.tsx
 *
 * Unified printable report surface — detailed decision document.
 *
 * Structure
 * ──────────
 *  Report header
 *  Completeness banner (if partial)
 *
 *  Section 0 — current_system    : existing installation snapshot (when input available)
 *  Page 1    — decision_page     : constraint → consequence → system → why required
 *  Page 2    — daily_experience  : typical-day use scenarios
 *  Page 3    — what_changes      : required installation changes
 *  Page 4    — alternatives_page : one controlled alternative with trade-offs
 *  Section E — evidence_summary  : full measured/derived evidence table
 *  Page 5    — engineer_summary  : job-reference snapshot
 *  Section S — scans_summary     : Atlas Scan package metadata (when available)
 *  Section P — photos            : captured property photos (when available)
 *  QR footer — portal link
 *
 * Printed output is print-first. Interactive chrome is hidden via @media print.
 */

import { useState, useEffect } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { ScanImportManifest } from '../../features/scanImport/package/ScanImportManifest';
import type { CapturedPhoto } from '../../features/scanImport/session/propertyScanSession';
import type { ExternalClearanceSceneV1 } from '../../contracts/spatial3dEvidence';
import type { VoiceNote } from '../../features/voiceNotes/voiceNoteTypes';
import type { DerivedFloorplanOutput } from '../floorplan/floorplanDerivations';
import { buildPortalUrl } from '../../lib/portal/portalUrl';
import { generatePortalToken } from '../../lib/portal/portalToken';
import {
  checkCompleteness,
  buildReportSections,
  type CurrentSystemSection,
  type DecisionPageSection,
  type DailyExperienceSection,
  type WhatChangesSection,
  type AlternativesPageSection,
  type EvidenceSummarySection,
  type EngineerSummarySection,
  type ScansSection,
  type FlueClearanceSummarySection,
  type ReportSection,
} from './reportSections.model';
import HeatLossContextCard from './HeatLossContextCard';
import ReportCompletenessBanner from './ReportCompletenessBanner';
import ReportQrFooter from './ReportQrFooter';
import './reportPrint.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Engine output to render. Pass null to show a graceful "no data" state. */
  output: EngineOutputV1 | null;
  /** Called when the user clicks the back button on screen. Defaults to window.history.back(). */
  onBack?: () => void;
  /** Optional report reference used to generate the customer portal QR code. */
  reportReference?: string;
  /**
   * Optional engine input — when provided the report includes a "current system"
   * section derived from the survey inputs that drove this engine run.
   */
  engineInput?: Partial<EngineInputV2_3>;
  /**
   * Optional scan manifest — when provided the report includes a "scans" section
   * summarising the Atlas Scan package imported for this property.
   */
  scanManifest?: ScanImportManifest;
  /**
   * Optional captured photos from the scan session.
   * When provided the report includes a photo grid section.
   */
  capturedPhotos?: CapturedPhoto[];
  /**
   * Optional external flue-clearance scenes.
   * When provided the report includes a flue clearance summary section
   * (preview image + compliance outcome) after the scans section.
   */
  externalClearanceScenes?: ExternalClearanceSceneV1[];
  /**
   * Optional voice notes captured during the site visit.
   * When provided the report includes a voice notes section with full transcripts
   * and any accepted survey suggestions.
   */
  voiceNotes?: VoiceNote[];
  /**
   * Optional floor-plan derived outputs.
   * When provided the report includes a floor plan summary section showing
   * room metrics and heat-loss estimates per room.
   */
  floorplanOutput?: DerivedFloorplanOutput;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Section renderers ────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<'info' | 'warn' | 'fail', string> = {
  info: 'ℹ',
  warn: '⚠',
  fail: '✕',
};

function CurrentSystemRenderer({ section }: { section: CurrentSystemSection }) {
  return (
    <section className="rv-section rv-current-system" aria-labelledby="rv-current-system">
      <h2 className="rv-section__title" id="rv-current-system">Current system</h2>
      <p className="rv-section__subtitle">{section.heatSourceLabel}</p>

      {section.facts.length > 0 && (
        <dl className="rv-dl">
          {section.facts.map((f, i) => (
            <div key={i} className="rv-dl-row">
              <dt className="rv-dt">{f.label}</dt>
              <dd className="rv-dd">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {section.contextBullets.length > 0 && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">System context</p>
          <ul className="rv-bullet-list" aria-label="System context summary">
            {section.contextBullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {section.currentSystemFlags.length > 0 && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Notes on current installation</p>
          <ul className="rv-flag-list" aria-label="Current system flags">
            {section.currentSystemFlags.map((f, i) => (
              <li key={i} className={`rv-flag rv-flag--${f.severity}`}>
                <span className="rv-flag__icon" aria-hidden="true">{SEVERITY_ICON[f.severity]}</span>
                <span className="rv-flag__body">
                  <strong>{f.title}</strong>{f.detail ? ` — ${f.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DecisionPageRenderer({ section }: { section: DecisionPageSection }) {
  return (
    <section className="rv-section rv-decision-page" aria-labelledby="rv-decision-page">
      {/* Headline */}
      <div className={`rv-decision-headline rv-decision-headline--${section.verdictStatus}`}>
        <h2 className="rv-decision-headline__title" id="rv-decision-page">
          {section.headline}
        </h2>
      </div>

      {/* What we found */}
      {section.measuredFacts.length > 0 && (
        <div className="rv-decision-block">
          <p className="rv-label">What we found</p>
          <dl className="rv-dl">
            {section.measuredFacts.map((f, i) => (
              <div key={i} className="rv-dl-row">
                <dt className="rv-dt">{f.label}</dt>
                <dd className="rv-dd">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* What this means */}
      {section.consequence && (
        <div className="rv-decision-block">
          <p className="rv-label">What this means</p>
          <p className="rv-decision-consequence">{section.consequence}</p>
        </div>
      )}

      {/* Recommended solution */}
      <div className="rv-decision-block rv-decision-block--recommend">
        <p className="rv-label">Recommended solution</p>
        <p className="rv-decision-system">{section.recommendedSystem}</p>
        {section.whyRequired.length > 0 && (
          <ul className="rv-bullet-list rv-bullet-list--why" aria-label="Why this system is required">
            {section.whyRequired.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const OUTCOME_ICON: Record<DailyExperienceSection['scenarios'][number]['outcome'], string> = {
  ok: '✓',
  limited: '~',
  slow: '~',
};

const OUTCOME_LABEL: Record<DailyExperienceSection['scenarios'][number]['outcome'], string> = {
  ok: 'Works normally',
  limited: 'Limited',
  slow: 'Slower',
};

function DailyExperienceRenderer({ section }: { section: DailyExperienceSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-daily-experience">
      <h2 className="rv-section__title" id="rv-daily-experience">Daily experience</h2>
      <div className="rv-scenarios" role="list">
        {section.scenarios.map((s, i) => (
          <div
            key={i}
            className={`rv-scenario rv-scenario--${s.outcome}`}
            role="listitem"
          >
            <span
              className={`rv-scenario__icon rv-scenario__icon--${s.outcome}`}
              aria-hidden="true"
            >
              {OUTCOME_ICON[s.outcome]}
            </span>
            <div className="rv-scenario__body">
              <p className="rv-scenario__name">{s.scenario}</p>
              {s.note && <p className="rv-scenario__note">{s.note}</p>}
            </div>
            <span className={`rv-scenario__badge rv-scenario__badge--${s.outcome}`}>
              {OUTCOME_LABEL[s.outcome]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatChangesRenderer({ section }: { section: WhatChangesSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-what-changes">
      <h2 className="rv-section__title" id="rv-what-changes">What changes</h2>
      <p className="rv-section__subtitle">{section.systemLabel}</p>
      <ul className="rv-bullet-list" aria-label="Required installation changes">
        {section.changes.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </section>
  );
}

function AlternativesPageRenderer({ section }: { section: AlternativesPageSection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-alternatives">
      <h2 className="rv-section__title" id="rv-alternatives">Alternatives</h2>
      <p className="rv-alternatives__primary">
        Recommended: <strong>{section.recommendedLabel}</strong>
      </p>
      {section.alternative ? (
        <div className="rv-alternative-card" aria-label={`Alternative: ${section.alternative.label}`}>
          <p className="rv-alternative-card__label">{section.alternative.label}</p>
          {section.alternative.requirement && (
            <p className="rv-alternative-card__requirement">{section.alternative.requirement}</p>
          )}
          {section.alternative.tradeOffs.length > 0 && (
            <div>
              <p className="rv-label rv-label--risk">Trade-offs versus recommendation</p>
              <ul className="rv-bullet-list" aria-label="Trade-offs">
                {section.alternative.tradeOffs.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="rv-alternatives__none">No comparable alternative available for this setup.</p>
      )}
      <p className="rv-alternatives__footnote">
        Other options can be explored in the interactive simulator.
      </p>
    </section>
  );
}

function EngineerSummaryRenderer({ section }: { section: EngineerSummarySection }) {
  return (
    <section
      className="rv-section rv-page-break-before rv-section--engineer"
      aria-labelledby="rv-engineer-summary"
    >
      <h2 className="rv-section__title" id="rv-engineer-summary">Engineer snapshot</h2>
      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Recommended</dt>
          <dd className="rv-dd">{section.recommendedSystem}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Key constraint</dt>
          <dd className="rv-dd">{section.keyConstraint}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Confidence</dt>
          <dd className="rv-dd">{capitalise(section.confidenceLevel)}</dd>
        </div>
      </dl>
      {section.beforeYouStart.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Before you start</p>
          <ul className="rv-bullet-list" aria-label="Pre-install checks">
            {section.beforeYouStart.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  manual:      'Measured',
  assumed:     'Assumed',
  placeholder: 'Placeholder',
  derived:     'Derived',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

function EvidenceSummaryRenderer({ section }: { section: EvidenceSummarySection }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-evidence-summary">
      <h2 className="rv-section__title" id="rv-evidence-summary">Measurements collected</h2>
      <p className="rv-section__subtitle">
        All inputs used by the engine to produce this recommendation
      </p>
      <table className="rv-evidence-table" aria-label="Engine evidence">
        <thead>
          <tr>
            <th className="rv-evidence-table__th">Input</th>
            <th className="rv-evidence-table__th">Value</th>
            <th className="rv-evidence-table__th">Source</th>
            <th className="rv-evidence-table__th">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {section.items.map((item, i) => (
            <tr key={i} className={`rv-evidence-table__row rv-evidence-table__row--${item.confidence}`}>
              <td className="rv-evidence-table__td">{item.label}</td>
              <td className="rv-evidence-table__td rv-evidence-table__td--value">{item.value}</td>
              <td className="rv-evidence-table__td">{SOURCE_LABEL[item.source] ?? item.source}</td>
              <td className="rv-evidence-table__td">{CONFIDENCE_LABEL[item.confidence] ?? item.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ScansSummaryRenderer({ section }: { section: ScansSection }) {
  const formattedDate = (() => {
    const date = new Date(section.generatedAt);
    if (Number.isNaN(date.getTime())) {
      return section.generatedAt;
    }
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <section className="rv-section rv-page-break-before rv-scans-section" aria-labelledby="rv-scans-summary">
      <h2 className="rv-section__title" id="rv-scans-summary">Scans</h2>
      <p className="rv-section__subtitle">{section.propertyAddress}</p>
      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Job reference</dt>
          <dd className="rv-dd">{section.jobRef}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Captured</dt>
          <dd className="rv-dd">{formattedDate}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Rooms</dt>
          <dd className="rv-dd">{section.roomCount} total, {section.reviewedRoomCount} reviewed</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Detected objects</dt>
          <dd className="rv-dd">{section.totalObjects}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Photos</dt>
          <dd className="rv-dd">{section.totalPhotos}</dd>
        </div>
      </dl>
      {section.blockingIssues && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label rv-label--risk">Blocking issues detected</p>
          <p className="rv-scan-warning">
            The scan client flagged issues that may require manual review before the floor
            plan can be used.
          </p>
        </div>
      )}
      {section.validationWarnings.length > 0 && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Scan warnings</p>
          <ul className="rv-bullet-list" aria-label="Scan validation warnings">
            {section.validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function FlueClearanceSummaryRenderer({ section }: { section: FlueClearanceSummarySection }) {
  const passLabel = section.pass === true ? '✓ Clearances pass' : section.pass === false ? '✗ Clearance issue — review required' : 'Compliance not yet assessed';
  const passClass = section.pass === true ? 'rv-badge--pass' : section.pass === false ? 'rv-badge--fail' : 'rv-badge--warn';

  return (
    <section className="rv-section rv-page-break-before rv-flue-clearance-section" aria-labelledby="rv-flue-clearance">
      <h2 className="rv-section__title" id="rv-flue-clearance">Flue clearance evidence</h2>
      <p className="rv-section__subtitle">External flue area — captured during survey</p>

      {section.previewImageUrl && (
        <div className="rv-flue-clearance__preview">
          <img
            src={section.previewImageUrl}
            alt="Flue area preview"
            className="rv-flue-clearance__img"
            style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.75rem' }}
          />
        </div>
      )}

      <span className={`rv-badge ${passClass}`} style={{ display: 'inline-block', marginBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
        {passLabel}
      </span>

      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Clearance measurements</dt>
          <dd className="rv-dd">{section.measurementCount}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Tagged features</dt>
          <dd className="rv-dd">{section.featureCount}</dd>
        </div>
        {section.standardRef && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Standard</dt>
            <dd className="rv-dd">{section.standardRef}</dd>
          </div>
        )}
      </dl>

      {section.warnings.length > 0 && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label rv-label--risk">Clearance warnings</p>
          <ul className="rv-bullet-list" aria-label="Flue clearance warnings">
            {section.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {section.sceneUrl && (
        <p className="rv-scan-detail" style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
          Full scene:{' '}
          <a href={section.sceneUrl} target="_blank" rel="noopener noreferrer" className="rv-link">
            View interactive clearance scene ↗
          </a>
          <span className="rv-print-only"> (see portal for 3D view)</span>
        </p>
      )}
    </section>
  );
}

interface PhotosSectionProps {
  photos: CapturedPhoto[];
}

function PhotosSectionRenderer({ photos }: PhotosSectionProps) {
  if (photos.length === 0) return null;
  return (
    <section className="rv-section rv-page-break-before rv-photos-section" aria-labelledby="rv-photos">
      <h2 className="rv-section__title" id="rv-photos">Photos</h2>
      <p className="rv-section__subtitle">{photos.length} photo{photos.length !== 1 ? 's' : ''} captured during survey</p>
      <div className="rv-photo-grid" role="list">
        {photos.map((photo) => (
          <figure key={photo.id} className="rv-photo-item" role="listitem">
            <img
              className="rv-photo-item__img"
              src={photo.localFileURL}
              alt={photo.note ?? `Photo ${photo.id}`}
              loading="lazy"
            />
            {(photo.note || photo.issueTag) && (
              <figcaption className="rv-photo-item__caption">
                {photo.issueTag && (
                  <span className="rv-photo-item__tag">{photo.issueTag}</span>
                )}
                {photo.note && <span>{photo.note}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

// ─── Voice notes section renderer ─────────────────────────────────────────────

function VoiceNotesSectionRenderer({ notes }: { notes: VoiceNote[] }) {
  if (notes.length === 0) return null;

  function formatNoteDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  let acceptedCount = 0;
  for (const n of notes) {
    for (const s of n.suggestions) {
      if (s.status === 'accepted') acceptedCount++;
    }
  }

  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-voice-notes">
      <h2 className="rv-section__title" id="rv-voice-notes">Voice notes</h2>
      <p className="rv-section__subtitle">
        {notes.length} note{notes.length !== 1 ? 's' : ''} recorded during visit
        {acceptedCount > 0 && ` · ${acceptedCount} suggestion${acceptedCount !== 1 ? 's' : ''} applied to survey`}
      </p>

      {notes.map((note, idx) => {
        const accepted = note.suggestions.filter(s => s.status === 'accepted');
        return (
          <div
            key={note.id}
            className="rv-voice-note"
            style={{
              marginBottom: '1.25rem',
              padding: '0.85rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#4a5568' }}>
                Note {idx + 1}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#718096' }}>
                {formatNoteDate(note.createdAt)}
              </span>
            </div>

            <p style={{ margin: '0 0 0.6rem', fontSize: '0.88rem', lineHeight: 1.55, color: '#1a202c', whiteSpace: 'pre-wrap' }}>
              {note.transcript}
            </p>

            {accepted.length > 0 && (
              <div style={{ marginTop: '0.6rem' }}>
                <p className="rv-label" style={{ fontSize: '0.76rem', marginBottom: '0.3rem' }}>
                  Suggestions applied to survey
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#2d3748' }}>
                  {accepted.map(s => (
                    <li key={s.id} style={{ marginBottom: '0.15rem' }}>
                      <strong>{s.label}:</strong> {s.suggestedValue}
                      {s.sourceSnippet && (
                        <span style={{ color: '#718096', fontStyle: 'italic' }}>
                          {' '}— &ldquo;{s.sourceSnippet}&rdquo;
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ─── Heat loss render section ──────────────────────────────────────────────────

function HeatLossRenderSection({ heatLossKw }: { heatLossKw: number }) {
  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-heat-loss-render">
      <h2 className="rv-section__title" id="rv-heat-loss-render">Heat demand analysis</h2>
      <p className="rv-section__subtitle">Peak design heat loss for this property</p>
      <HeatLossContextCard heatLossKw={heatLossKw} />
    </section>
  );
}

// ─── Floor plan summary section ────────────────────────────────────────────────

function FloorplanSummarySection({ floorplanOutput }: { floorplanOutput: DerivedFloorplanOutput }) {
  const { roomMetrics, roomHeatLossKw, totalPipeLengthM, feasibilityChecks, sitingFlags } = floorplanOutput;
  const heatedRooms = roomMetrics.length;
  const totalAreaM2 = roomMetrics.reduce((sum, r) => sum + r.areaM2, 0);
  const totalHeatLossKw = roomHeatLossKw.reduce((sum, r) => sum + r.heatLossKw, 0);

  return (
    <section className="rv-section rv-page-break-before" aria-labelledby="rv-floorplan-summary">
      <h2 className="rv-section__title" id="rv-floorplan-summary">Floor plan summary</h2>
      <p className="rv-section__subtitle">Derived from property floor plan</p>

      <dl className="rv-dl">
        <div className="rv-dl-row">
          <dt className="rv-dt">Heated rooms</dt>
          <dd className="rv-dd">{heatedRooms}</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Total heated area</dt>
          <dd className="rv-dd">{totalAreaM2.toFixed(1)} m²</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Estimated total heat loss</dt>
          <dd className="rv-dd">{totalHeatLossKw.toFixed(2)} kW</dd>
        </div>
        <div className="rv-dl-row">
          <dt className="rv-dt">Total pipe length</dt>
          <dd className="rv-dd">{totalPipeLengthM.toFixed(1)} m</dd>
        </div>
        {feasibilityChecks.hasOutdoorHeatPump && (
          <div className="rv-dl-row">
            <dt className="rv-dt">Heat pump sited</dt>
            <dd className="rv-dd">✓ Outdoor unit placed</dd>
          </div>
        )}
      </dl>

      {roomHeatLossKw.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Room-by-room heat loss</p>
          <table className="rv-evidence-table" aria-label="Room heat loss">
            <thead>
              <tr>
                <th className="rv-evidence-table__th">Room</th>
                <th className="rv-evidence-table__th">Area (m²)</th>
                <th className="rv-evidence-table__th">Heat loss (kW)</th>
              </tr>
            </thead>
            <tbody>
              {roomHeatLossKw.map((r) => {
                const metrics = roomMetrics.find(m => m.roomId === r.roomId);
                return (
                  <tr key={r.roomId} className="rv-evidence-table__row rv-evidence-table__row--high">
                    <td className="rv-evidence-table__td">{r.roomName}</td>
                    <td className="rv-evidence-table__td rv-evidence-table__td--value">
                      {metrics?.areaM2.toFixed(1) ?? '—'}
                    </td>
                    <td className="rv-evidence-table__td rv-evidence-table__td--value">
                      {r.heatLossKw.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sitingFlags.length > 0 && (
        <div className="rv-decision-block" style={{ marginTop: '0.75rem' }}>
          <p className="rv-label">Siting notes</p>
          <ul className="rv-flag-list" aria-label="Siting flags">
            {sitingFlags.map((f, i) => (
              <li
                key={i}
                className={`rv-flag rv-flag--${f.status === 'ok' ? 'info' : f.status === 'warn' ? 'warn' : 'fail'}`}
              >
                <span className="rv-flag__body">
                  <strong>{f.objectType}</strong> — {f.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RenderSection({ section }: { section: ReportSection }) {
  switch (section.id) {
    case 'current_system':
      return <CurrentSystemRenderer section={section} />;
    case 'decision_page':
      return <DecisionPageRenderer section={section} />;
    case 'daily_experience':
      return <DailyExperienceRenderer section={section} />;
    case 'what_changes':
      return <WhatChangesRenderer section={section} />;
    case 'alternatives_page':
      return <AlternativesPageRenderer section={section} />;
    case 'evidence_summary':
      return <EvidenceSummaryRenderer section={section} />;
    case 'engineer_summary':
      return <EngineerSummaryRenderer section={section} />;
    case 'scans_summary':
      return <ScansSummaryRenderer section={section} />;
    case 'flue_clearance_summary':
      return <FlueClearanceSummaryRenderer section={section} />;
    // Simulator-derived sections (rendered by SimulatorReportView, not here)
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportView({ output, onBack, reportReference, engineInput, scanManifest, capturedPhotos, externalClearanceScenes, voiceNotes, floorplanOutput }: Props) {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reportReference) return;
    let cancelled = false;
    generatePortalToken(reportReference)
      .then((token) => buildPortalUrl(reportReference, window.location.origin, token))
      .then((url) => { if (!cancelled) setPortalUrl(url); })
      .catch(() => { /* Portal URL generation failure is non-critical — silently omit the link. */ });
    return () => { cancelled = true; };
  }, [reportReference]);

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  }

  // Guard: no engine output available (e.g. ?report=1 loaded without demo data).
  if (output === null) {
    return (
      <div className="rv-wrap">
        <div className="rv-toolbar" aria-hidden="false">
          <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
          <span className="rv-toolbar__label">System Report</span>
        </div>
        <div
          role="alert"
          style={{
            padding: '1.25rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            fontSize: '0.84rem',
            color: '#742a2a',
          }}
        >
          <strong>No data available</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            No engine output is available. Complete an assessment first to generate a report.
          </p>
        </div>
      </div>
    );
  }

  const completeness = checkCompleteness(output);

  // If essential data is missing, render a blocked state rather than a broken report.
  if (!completeness.isReportable) {
    return (
      <div className="rv-wrap">
        <div className="rv-toolbar" aria-hidden="false">
          <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
          <span className="rv-toolbar__label">System Report</span>
        </div>
        <div
          role="alert"
          style={{
            padding: '1.25rem',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: '8px',
            fontSize: '0.84rem',
            color: '#742a2a',
          }}
        >
          <strong>Report not available</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            Insufficient data to generate a report. The following essential
            inputs are missing:
          </p>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem' }}>
            {completeness.missingEssential.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const sections = buildReportSections(output, engineInput, scanManifest, externalClearanceScenes);
  const engineerSection = sections.find(s => s.id === 'engineer_summary') as EngineerSummarySection | undefined;
  const confidenceLevel = engineerSection?.confidenceLevel ?? '—';
  const generatedDate = formatCurrentDate();

  return (
    <div className="rv-wrap">

      {/* ── Screen toolbar (hidden on print) ─────────────────────────────── */}
      <div className="rv-toolbar" aria-hidden="false">
        <button className="rv-toolbar__back" onClick={handleBack}>← Back</button>
        <span className="rv-toolbar__label">System Report</span>
        {portalUrl && (
          <a
            className="rv-toolbar__portal-link"
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open interactive home heating plan"
            data-testid="portal-link"
          >
            🏠 Open interactive home heating plan
          </a>
        )}
        <button className="rv-toolbar__print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── Document header ───────────────────────────────────────────────── */}
      <header className="rv-doc-header">
        <div>
          <h1 className="rv-doc-header__title">Heating system assessment</h1>
          <p className="rv-doc-header__sub">Based on your home survey</p>
        </div>
        <div className="rv-doc-header__meta">
          <div>Generated: {generatedDate}</div>
          <div>Confidence: {confidenceLevel}</div>
        </div>
      </header>

      {/* ── Completeness banner (if partial) ──────────────────────────────── */}
      {completeness.isPartial && (
        <ReportCompletenessBanner missingOptional={completeness.missingOptional} />
      )}

      {/* ── Report sections ────────────────────────────────────────────────── */}
      {sections.map((section) => (
        <RenderSection key={section.id} section={section} />
      ))}

      {/* ── Photos section (optional) ─────────────────────────────────────── */}
      {capturedPhotos && capturedPhotos.length > 0 && (
        <PhotosSectionRenderer photos={capturedPhotos} />
      )}

      {/* ── Heat demand analysis (optional) ──────────────────────────────── */}
      {engineInput?.heatLossWatts != null && engineInput.heatLossWatts > 0 && (
        <HeatLossRenderSection heatLossKw={engineInput.heatLossWatts / 1000} />
      )}

      {/* ── Floor plan summary (optional) ────────────────────────────────── */}
      {floorplanOutput && floorplanOutput.roomMetrics.length > 0 && (
        <FloorplanSummarySection floorplanOutput={floorplanOutput} />
      )}

      {/* ── Voice notes / transcripts (optional) ─────────────────────────── */}
      {voiceNotes && voiceNotes.length > 0 && (
        <VoiceNotesSectionRenderer notes={voiceNotes} />
      )}

      {/* ── QR code footer — portal link ──────────────────────────────────── */}
      {reportReference && (
        <ReportQrFooter reportReference={reportReference} />
      )}

    </div>
  );
}

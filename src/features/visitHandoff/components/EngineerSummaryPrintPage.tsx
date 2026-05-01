/**
 * EngineerSummaryPrintPage.tsx
 *
 * PR13 — Dedicated engineer share route and compact install-prep print page.
 *
 * Renders a VisitHandoffPack as a dense, engineer-facing, A4-printable handoff
 * sheet for install preparation.  Only EngineerVisitSummary fields are shown —
 * no customer-only simplified framing.
 *
 * Sections
 * ────────
 *   1. Visit complete  (completion metadata)
 *   2. Rooms
 *   3. Key objects
 *   4. Proposed emitters
 *   5. Access notes
 *   6. Room plan notes
 *   7. Spec notes
 *   8. Field notes summary
 *
 * Actions (screen only)
 * ─────────────────────
 *   · Print handoff  — window.print()
 *   · Share handoff  — Web Share API where available, clipboard copy fallback
 *
 * Architecture rules
 * ──────────────────
 *   - Renders EngineerVisitSummary only — no CustomerVisitSummary fields.
 *   - No dependency on the legacy report / Insight pipeline.
 *   - No dependency on the recommendation engine.
 *   - Fully isolated read-only surface.
 *   - No edit controls or mutation hooks.
 *
 * Terminology: docs/atlas-terminology.md applies to all user-facing strings.
 */

import { useState, useCallback } from 'react';
import type {
  VisitHandoffPack,
  HandoffRoom,
  HandoffKeyObject,
  HandoffProposedEmitter,
  HandoffAccessNote,
} from '../types/visitHandoffPack';
import { safeParseVisitHandoffPack } from '../parser/parseVisitHandoffPack';
import './EngineerSummaryPrintPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Error / missing-pack state ───────────────────────────────────────────────

function MissingPackState() {
  return (
    <div className="esp-error" data-testid="esp-missing-pack">
      <div className="esp-error__icon" aria-hidden="true">⚠️</div>
      <h2 className="esp-error__heading">No handoff available</h2>
      <p className="esp-error__body">
        This link does not contain a valid engineer handoff pack. It may have
        expired or the data may be missing. Please contact the office if you
        need a copy of this handoff.
      </p>
    </div>
  );
}

// ─── Dev pack loader (DEV only) ───────────────────────────────────────────────

function DevPackLoader({ onLoad }: { onLoad: (raw: unknown) => void }) {
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onLoad(JSON.parse(String(ev.target?.result ?? '')));
      } catch {
        onLoad(null);
      }
    };
    reader.readAsText(file);
  }, [onLoad]);

  const handlePaste = useCallback(() => {
    try {
      onLoad(JSON.parse(pasteText));
    } catch {
      onLoad(null);
    }
  }, [pasteText, onLoad]);

  return (
    <div style={{
      background: '#fefce8',
      border: '1px solid #fde68a',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      color: '#78350f',
      maxWidth: 794,
      margin: '0 auto',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🔬 Dev: load a different pack</div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ cursor: 'pointer' }}>
          <span>Upload JSON</span>
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </label>
        <button
          onClick={() => setShowPaste((v) => !v)}
          style={{
            background: 'none',
            border: '1px solid #fbbf24',
            borderRadius: 4,
            padding: '0.25rem 0.6rem',
            cursor: 'pointer',
            color: '#78350f',
            fontSize: '0.8rem',
          }}
        >
          {showPaste ? 'Hide paste' : 'Paste JSON'}
        </button>
      </div>
      {showPaste && (
        <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste VisitHandoffPack JSON here…"
            rows={5}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              border: '1px solid #fbbf24',
              borderRadius: 4,
              padding: '0.4rem',
              background: '#fffbeb',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handlePaste}
            disabled={!pasteText.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '0.3rem 0.75rem',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.8rem',
              opacity: pasteText.trim() ? 1 : 0.5,
            }}
          >
            Load
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Section primitives ───────────────────────────────────────────────────────

function Section({
  heading,
  testId,
  children,
}: {
  heading: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="esp-section" data-testid={testId}>
      <h2 className="esp-section__heading">{heading}</h2>
      {children}
    </section>
  );
}

function EmptyNote({ message }: { message: string }) {
  return <p className="esp-empty">{message}</p>;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

function RoomsList({ rooms }: { rooms: HandoffRoom[] }) {
  if (rooms.length === 0) return <EmptyNote message="No rooms recorded." />;
  return (
    <div className="esp-room-list">
      {rooms.map((room) => (
        <div key={room.id} className="esp-room-row">
          <span className="esp-room-row__name">{room.name}</span>
          <span className="esp-room-row__area">
            {room.areaM2 != null ? `${room.areaM2} m²` : ''}
          </span>
          {room.notes && (
            <span className="esp-room-row__notes">{room.notes}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Key objects ──────────────────────────────────────────────────────────────

function KeyObjectsTable({ objects }: { objects: HandoffKeyObject[] }) {
  if (objects.length === 0) return <EmptyNote message="No key objects recorded." />;
  return (
    <table className="esp-table" data-testid="esp-key-objects-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Make / Model</th>
          <th>Install year</th>
          <th>Condition</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {objects.map((obj, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 600 }}>{obj.type}</td>
            <td className="esp-table__muted">{obj.make ?? '—'}</td>
            <td className="esp-table__muted">
              {obj.installYear != null ? obj.installYear : '—'}
            </td>
            <td className="esp-table__muted">{obj.condition ?? '—'}</td>
            <td className="esp-table__muted">{obj.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Proposed emitters ────────────────────────────────────────────────────────

function ProposedEmittersTable({ emitters }: { emitters: HandoffProposedEmitter[] }) {
  if (emitters.length === 0) return <EmptyNote message="No proposed emitters recorded." />;
  return (
    <table className="esp-table" data-testid="esp-emitters-table">
      <thead>
        <tr>
          <th>Room</th>
          <th>Type</th>
          <th>Output</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {emitters.map((emitter, i) => (
          <tr key={i}>
            <td>{emitter.roomName}</td>
            <td>{emitter.emitterType}</td>
            <td className="esp-table__muted">
              {emitter.outputWatts != null ? `${emitter.outputWatts} W` : '—'}
            </td>
            <td className="esp-table__muted">{emitter.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Access notes ─────────────────────────────────────────────────────────────

function AccessNotesTable({ notes }: { notes: HandoffAccessNote[] }) {
  if (notes.length === 0) return <EmptyNote message="No access notes recorded." />;
  return (
    <table className="esp-table" data-testid="esp-access-notes-table">
      <thead>
        <tr>
          <th>Location</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {notes.map((note, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 500, minWidth: 140 }}>{note.location}</td>
            <td className="esp-table__muted">{note.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Notes block ──────────────────────────────────────────────────────────────

function NotesBlock({ text }: { text: string }) {
  return <p className="esp-notes-block">{text}</p>;
}

// ─── Engineer summary content ─────────────────────────────────────────────────

interface EngineerSummaryContentProps {
  pack: VisitHandoffPack;
}

function EngineerSummaryContent({ pack }: EngineerSummaryContentProps) {
  const { engineerSummary } = pack;
  const formattedDate = formatDate(pack.completedAt);

  return (
    <>
      {/* ── Page header ── */}
      <header className="esp-header">
        <div className="esp-header__main">
          <p className="esp-header__title">Engineer handoff</p>
          <p className="esp-header__subtitle">
            Completed visit summary for install preparation
          </p>
          <p className="esp-header__address">
            {pack.customerSummary.address}
          </p>
          <p className="esp-header__meta">
            Completed {formattedDate}
            {pack.engineerName ? ` · ${pack.engineerName}` : ''}
          </p>
        </div>
        <span className="esp-badge" aria-label="Read only">Read only</span>
      </header>

      {/* ── ⚠ Recommendation mismatch warning (blocking banner) ── */}
      {engineerSummary.recommendationMismatchWarning && (
        <div
          className="esp-mismatch-warning"
          data-testid="esp-mismatch-warning"
          role="alert"
        >
          <span className="esp-mismatch-warning__icon" aria-hidden="true">⚠️</span>
          <div>
            <p className="esp-mismatch-warning__heading">
              Recommendation mismatch — confirm before handoff
            </p>
            <p className="esp-mismatch-warning__body">
              {engineerSummary.recommendationMismatchWarning}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Visit complete ── */}
      <div className="esp-completion" data-testid="esp-completion">
        <span className="esp-completion__icon" aria-hidden="true">✓</span>
        <div>
          <p className="esp-completion__text">Visit complete</p>
          <p className="esp-completion__meta">
            {formattedDate}
            {pack.engineerName ? ` · ${pack.engineerName}` : ''}
          </p>
        </div>
      </div>

      {/* ── 2. Rooms ── */}
      <Section heading="Rooms" testId="esp-section-rooms">
        <RoomsList rooms={engineerSummary.rooms} />
      </Section>

      {/* ── 3. Key objects ── */}
      <Section heading="Key objects" testId="esp-section-key-objects">
        <KeyObjectsTable objects={engineerSummary.keyObjects} />
      </Section>

      {/* ── 4. Proposed emitters ── */}
      <Section heading="Proposed emitters" testId="esp-section-proposed-emitters">
        <ProposedEmittersTable emitters={engineerSummary.proposedEmitters} />
      </Section>

      {/* ── 5. Access notes ── */}
      <Section heading="Access notes" testId="esp-section-access-notes">
        <AccessNotesTable notes={engineerSummary.accessNotes} />
      </Section>

      {/* ── 6. Room plan notes ── */}
      <Section heading="Room plan notes" testId="esp-section-room-plan-notes">
        {engineerSummary.roomPlanNotes ? (
          <NotesBlock text={engineerSummary.roomPlanNotes} />
        ) : (
          <EmptyNote message="No room plan notes recorded." />
        )}
      </Section>

      {/* ── 7. Spec notes ── */}
      <Section heading="Spec notes" testId="esp-section-spec-notes">
        {engineerSummary.specNotes ? (
          <NotesBlock text={engineerSummary.specNotes} />
        ) : (
          <EmptyNote message="No spec notes recorded." />
        )}
      </Section>

      {/* ── 8. Field notes summary ── */}
      <Section heading="Field notes summary" testId="esp-section-field-notes">
        {engineerSummary.fieldNotesSummary ? (
          <NotesBlock text={engineerSummary.fieldNotesSummary} />
        ) : (
          <EmptyNote message="No field notes available." />
        )}
      </Section>

      {/* ── Footer ── */}
      <footer className="esp-footer" data-testid="esp-footer">
        <p className="esp-footer__text">Generated from Atlas handoff pack</p>
      </footer>
    </>
  );
}

// ─── Share button ─────────────────────────────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Engineer handoff', url });
        return;
      } catch {
        // Fallthrough to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently skip
    }
  }, []);

  return (
    <button
      className={`esp-toolbar__share${copied ? ' esp-toolbar__share--copied' : ''}`}
      onClick={handleShare}
      data-testid="esp-share-button"
      aria-label="Share handoff"
    >
      {copied ? 'Link copied' : 'Share handoff'}
    </button>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export interface EngineerSummaryPrintPageProps {
  /** Initial pack to display.  Pass null / undefined to show the missing-pack state. */
  initialPack?: VisitHandoffPack | null;
  onBack?: () => void;
}

export default function EngineerSummaryPrintPage({
  initialPack,
  onBack,
}: EngineerSummaryPrintPageProps) {
  const [pack, setPack] = useState<VisitHandoffPack | null>(initialPack ?? null);
  const [parseError, setParseError] = useState(false);

  const handleLoad = useCallback((raw: unknown) => {
    const parsed = safeParseVisitHandoffPack(raw);
    if (parsed) {
      setPack(parsed);
      setParseError(false);
    } else {
      setPack(null);
      setParseError(true);
    }
  }, []);

  const showContent = pack !== null;

  return (
    <div className="esp-wrap">

      {/* ── Screen toolbar (hidden when printing) ── */}
      <div className="esp-toolbar" data-testid="esp-toolbar">
        {onBack && (
          <button
            className="esp-toolbar__back"
            onClick={onBack}
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <span className="esp-toolbar__label">Engineer handoff</span>
        {showContent && (
          <div className="esp-toolbar__actions">
            <button
              className="esp-toolbar__print"
              onClick={() => window.print()}
              data-testid="esp-print-button"
              aria-label="Print handoff"
            >
              Print handoff
            </button>
            <ShareButton />
          </div>
        )}
      </div>

      {/* ── Page card ── */}
      <div className="esp-page" data-testid="esp-page">

        {/* Error / missing pack */}
        {!showContent && (
          parseError
            ? (
              <div className="esp-error" data-testid="esp-parse-error">
                <div className="esp-error__icon" aria-hidden="true">⚠️</div>
                <h2 className="esp-error__heading">Could not read handoff data</h2>
                <p className="esp-error__body">
                  The handoff pack data could not be parsed. It may be corrupted
                  or in an unsupported format. Please contact the office for a
                  fresh copy of this handoff.
                </p>
              </div>
            )
            : <MissingPackState />
        )}

        {/* Loaded pack — engineer summary only */}
        {showContent && <EngineerSummaryContent pack={pack} />}
      </div>

      {/* Dev: pack loader (only in development builds, below the page card) */}
      {import.meta.env.DEV && (
        <div style={{ marginTop: '1.25rem' }}>
          <DevPackLoader onLoad={handleLoad} />
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';

type UnknownRecord = Record<string, unknown>;

interface NormalizedCapturePoint {
  id: string;
  anchorConfidence: string;
  surfaceSemantic: string | null;
  needsReview: boolean;
  objectPins: string[];
  photos: string[];
  transcriptExcerpts: string[];
  ghostAppliances: string[];
  measurements: string[];
}

interface NormalizedRoom {
  id: string;
  name: string;
  geometryStatus: string | null;
  area: string | null;
  ceilingHeight: string | null;
  warnings: string[];
  capturePoints: NormalizedCapturePoint[];
}

interface NormalizedUnresolvedEvidence {
  id: string;
  room: string | null;
  capturePointId: string | null;
  label: string;
  detail: string | null;
}

function asObject(value: unknown): UnknownRecord | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  const result: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string' && item.trim().length > 0) {
      result.push(item.trim());
      continue;
    }
    const obj = asObject(item);
    if (!obj) continue;
    const label =
      readString(obj['label']) ??
      readString(obj['name']) ??
      readString(obj['title']) ??
      readString(obj['type']) ??
      readString(obj['id']) ??
      readString(obj['url']) ??
      readString(obj['transcript']) ??
      readString(obj['text']) ??
      readString(obj['excerpt']);
    if (label) result.push(label);
  }
  return result;
}

function formatMaybeMetres(value: unknown): string | null {
  const n = readNumber(value);
  if (n == null) return null;
  return `${n} m`;
}

function formatMaybeArea(value: unknown): string | null {
  const n = readNumber(value);
  if (n == null) return null;
  return `${n} m²`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeMeasurements(value: unknown): string[] {
  const out: string[] = [];
  for (const entry of asArray(value)) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry.trim());
      continue;
    }
    const obj = asObject(entry);
    if (!obj) continue;
    const label = readString(obj['label']) ?? readString(obj['kind']) ?? readString(obj['name']);
    const numericValue =
      readNumber(obj['value']) ??
      readNumber(obj['valueM']) ??
      readNumber(obj['length']) ??
      readNumber(obj['distance']);
    const unit =
      readString(obj['unit']) ??
      (obj['valueM'] != null ? 'm' : null);
    if (numericValue != null) {
      const formattedValue = `${numericValue}${unit ? ` ${unit}` : ''}`;
      out.push(label ? `${label}: ${formattedValue}` : formattedValue);
      continue;
    }
    const fallback = readString(obj['detail']) ?? readString(obj['text']) ?? readString(obj['id']);
    if (fallback) out.push(label ? `${label}: ${fallback}` : fallback);
  }
  return out;
}

function normalizeCapturePoint(raw: unknown, index: number): NormalizedCapturePoint {
  const obj = asObject(raw);
  const evidence = obj ? asObject(obj['evidence']) : null;
  const id =
    (obj && (readString(obj['capturePointId']) ?? readString(obj['capture_point_id']) ?? readString(obj['id']))) ??
    `capture-point-${index + 1}`;
  const anchorConfidenceValue =
    obj?.['anchorConfidence'] ??
    obj?.['confidence'] ??
    asObject(obj?.['anchor'])?.['confidence'];
  const anchorConfidence = (() => {
    const numeric = readNumber(anchorConfidenceValue);
    if (numeric != null) return `${numeric}`;
    return readString(anchorConfidenceValue) ?? 'unknown';
  })();
  const surfaceSemantic =
    (obj && (readString(obj['surfaceSemantic']) ?? readString(obj['semantic']) ?? readString(asObject(obj['surface'])?.['semantic']))) ??
    null;
  const reviewStatus = readString(obj?.['reviewStatus']);
  const needsReview =
    obj?.['needsReview'] === true ||
    reviewStatus === 'needs_review' ||
    reviewStatus === 'unresolved' ||
    reviewStatus === 'pending_review';
  const objectPins = uniqueStrings([
    ...readStringArray(obj?.['objectPins']),
    ...readStringArray(obj?.['pins']),
    ...readStringArray(evidence?.['objectPins']),
  ]);
  const photos = uniqueStrings([
    ...readStringArray(obj?.['photos']),
    ...readStringArray(evidence?.['photos']),
  ]);
  const transcriptExcerpts = uniqueStrings([
    ...readStringArray(obj?.['voice']),
    ...readStringArray(obj?.['voiceExcerpts']),
    ...readStringArray(obj?.['transcripts']),
    ...readStringArray(obj?.['voiceNotes']),
    ...readStringArray(evidence?.['voice']),
    ...readStringArray(evidence?.['transcripts']),
  ]);
  const ghostAppliances = uniqueStrings([
    ...readStringArray(obj?.['ghostAppliances']),
    ...readStringArray(evidence?.['ghostAppliances']),
  ]);
  const measurements = uniqueStrings([
    ...normalizeMeasurements(obj?.['measurements']),
    ...normalizeMeasurements(evidence?.['measurements']),
  ]);
  return {
    id,
    anchorConfidence,
    surfaceSemantic,
    needsReview,
    objectPins,
    photos,
    transcriptExcerpts,
    ghostAppliances,
    measurements,
  };
}

function normalizeRoom(raw: unknown, index: number): NormalizedRoom {
  const room = asObject(raw);
  const geometry = asObject(room?.['geometry']);
  const id = (room && (readString(room['roomId']) ?? readString(room['id']))) ?? `room-${index + 1}`;
  const name =
    (room && (readString(room['roomName']) ?? readString(room['name']))) ??
    id;
  const capturePointsRaw = [
    ...asArray(room?.['capturePoints']),
    ...asArray(room?.['capture_points']),
    ...asArray(room?.['points']),
  ];
  const warnings = uniqueStrings([
    ...readStringArray(room?.['warnings']),
    ...readStringArray(geometry?.['warnings']),
  ]);
  return {
    id,
    name,
    geometryStatus:
      (room && (readString(room['roomGeometryStatus']) ?? readString(room['geometryStatus']))) ??
      readString(geometry?.['status']) ??
      null,
    area:
      formatMaybeArea(room?.['areaM2']) ??
      formatMaybeArea(room?.['areaSqm']) ??
      formatMaybeArea(room?.['area']) ??
      formatMaybeArea(geometry?.['areaM2']) ??
      null,
    ceilingHeight:
      formatMaybeMetres(room?.['ceilingHeightM']) ??
      formatMaybeMetres(room?.['ceilingHeight']) ??
      formatMaybeMetres(geometry?.['ceilingHeightM']) ??
      null,
    warnings,
    capturePoints: capturePointsRaw.map(normalizeCapturePoint),
  };
}

function normalizeSpatialEvidenceGraph(graph: unknown): NormalizedRoom[] {
  const graphObj = asObject(graph);
  const roomsRaw = graphObj
    ? [
        ...asArray(graphObj['rooms']),
        ...asArray(graphObj['roomNodes']),
      ]
    : [];

  if (roomsRaw.length > 0) {
    return roomsRaw.map(normalizeRoom);
  }

  const flattenedCapturePoints = graphObj
    ? [
        ...asArray(graphObj['capturePoints']),
        ...asArray(graphObj['capture_points']),
        ...asArray(graphObj['nodes']),
      ]
    : asArray(graph);

  const grouped = new Map<string, { room: NormalizedRoom; points: unknown[] }>();
  for (const point of flattenedCapturePoints) {
    const obj = asObject(point);
    const roomId =
      (obj && (readString(obj['roomId']) ?? readString(obj['room_id']))) ??
      'room-unknown';
    const roomName =
      (obj && (readString(obj['roomName']) ?? readString(obj['room']) ?? readString(obj['roomLabel']))) ??
      roomId;
    if (!grouped.has(roomId)) {
      grouped.set(roomId, {
        room: {
          id: roomId,
          name: roomName,
          geometryStatus: readString(obj?.['roomGeometryStatus']) ?? null,
          area: formatMaybeArea(obj?.['roomAreaM2']) ?? null,
          ceilingHeight: formatMaybeMetres(obj?.['roomCeilingHeightM']) ?? null,
          warnings: readStringArray(obj?.['roomWarnings']),
          capturePoints: [],
        },
        points: [],
      });
    }
    grouped.get(roomId)?.points.push(point);
  }

  return [...grouped.values()].map((group) => ({
    ...group.room,
    capturePoints: group.points.map(normalizeCapturePoint),
  }));
}

function normalizeUnresolvedEvidence(unresolved: unknown): NormalizedUnresolvedEvidence[] {
  const unresolvedObj = asObject(unresolved);
  const unresolvedItems = unresolvedObj
    ? [
        ...asArray(unresolvedObj['items']),
        ...asArray(unresolvedObj['evidence']),
        ...asArray(unresolvedObj['capturePoints']),
      ]
    : asArray(unresolved);

  return unresolvedItems.map((item, index) => {
    const obj = asObject(item);
    const id = (obj && (readString(obj['id']) ?? readString(obj['unresolvedId']))) ?? `unresolved-${index + 1}`;
    const room =
      (obj && (readString(obj['room']) ?? readString(obj['roomName']) ?? readString(obj['roomId']))) ??
      null;
    const capturePointId =
      (obj && (readString(obj['capturePointId']) ?? readString(obj['capture_point_id']))) ??
      null;
    const label =
      (obj && (readString(obj['type']) ?? readString(obj['title']) ?? readString(obj['code']) ?? readString(obj['reason']))) ??
      'Unresolved evidence item';
    const detail = obj
      ? (readString(obj['detail']) ?? readString(obj['message']) ?? readString(obj['notes']))
      : null;
    return { id, room, capturePointId, label, detail };
  });
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: '0.35rem' }}>
      <p style={{ margin: 0, fontSize: '0.73rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
        {title}
      </p>
      <ul style={{ margin: '0.15rem 0 0 0.95rem', color: '#334155', fontSize: '0.8rem' }}>
        {items.map((item, idx) => (
          <li key={`${title}-${item}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export interface CapturedEvidencePanelProps {
  spatialEvidenceGraph?: unknown;
  unresolvedEvidence?: unknown;
  customerFacing?: boolean;
  allowUnresolvedDetails?: boolean;
}

export function CapturedEvidencePanel({
  spatialEvidenceGraph,
  unresolvedEvidence,
  customerFacing = false,
  allowUnresolvedDetails = false,
}: CapturedEvidencePanelProps) {
  const rooms = useMemo(
    () => normalizeSpatialEvidenceGraph(spatialEvidenceGraph),
    [spatialEvidenceGraph],
  );
  const unresolved = useMemo(
    () => normalizeUnresolvedEvidence(unresolvedEvidence),
    [unresolvedEvidence],
  );

  if (rooms.length === 0 && unresolved.length === 0) return null;

  const showUnresolvedDetails = !customerFacing || allowUnresolvedDetails;

  return (
    <section
      data-testid="captured-evidence-panel"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '1rem 1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#1e293b' }}>Captured evidence</h3>
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Structured by room → capture point
        </span>
      </div>

      {rooms.map((room) => (
        <article
          key={room.id}
          data-testid={`captured-evidence-room-${room.id}`}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 0.8rem', background: '#f8fafc' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
              {room.name}
            </p>
            <code style={{ color: '#64748b', fontSize: '0.72rem' }}>{room.id}</code>
          </div>
          <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            {room.geometryStatus && <span style={{ fontSize: '0.75rem', color: '#334155' }}>Geometry: {room.geometryStatus}</span>}
            {room.area && <span style={{ fontSize: '0.75rem', color: '#334155' }}>Area: {room.area}</span>}
            {room.ceilingHeight && <span style={{ fontSize: '0.75rem', color: '#334155' }}>Ceiling: {room.ceilingHeight}</span>}
          </div>
          {room.warnings.length > 0 && (
            <ul style={{ margin: '0.4rem 0 0 1rem', color: '#92400e', fontSize: '0.78rem' }}>
              {room.warnings.map((warning, idx) => (
                <li key={`room-warning-${warning}-${idx}`}>{warning}</li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {room.capturePoints.map((capturePoint) => (
              <div
                key={`${room.id}-${capturePoint.id}`}
                data-testid={`captured-evidence-capture-point-${capturePoint.id}`}
                style={{ border: '1px solid #dbeafe', background: '#ffffff', borderRadius: 6, padding: '0.55rem 0.65rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1e3a8a' }}>
                    capturePointId: {capturePoint.id}
                  </p>
                  {capturePoint.needsReview && (
                    <span
                      data-testid={`captured-evidence-needs-review-${capturePoint.id}`}
                      style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9a3412', background: '#ffedd5', border: '1px solid #fdba74', borderRadius: 999, padding: '0.12rem 0.45rem' }}
                    >
                      Needs review
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.77rem', color: '#475569' }}>
                  Anchor confidence: {capturePoint.anchorConfidence}
                  {capturePoint.surfaceSemantic ? ` · Surface: ${capturePoint.surfaceSemantic}` : ''}
                </p>
                <EvidenceList title="Object pins" items={capturePoint.objectPins} />
                <EvidenceList title="Photos" items={capturePoint.photos} />
                <EvidenceList title="Voice / transcript excerpts" items={capturePoint.transcriptExcerpts} />
                <EvidenceList title="Ghost appliances" items={capturePoint.ghostAppliances} />
                <EvidenceList title="Measurements" items={capturePoint.measurements} />
              </div>
            ))}
          </div>
        </article>
      ))}

      {unresolved.length > 0 && (
        <article
          data-testid="captured-evidence-unresolved-panel"
          style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 8, padding: '0.75rem 0.85rem' }}
        >
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>
            Unresolved evidence {customerFacing ? '(review pending)' : '(engineer review required)'}
          </p>
          {!showUnresolvedDetails ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#92400e' }}>
              {unresolved.length} item{unresolved.length !== 1 ? 's are' : ' is'} under review.
            </p>
          ) : (
            <ul style={{ margin: '0.4rem 0 0 1rem', fontSize: '0.8rem', color: '#78350f' }}>
              {unresolved.map((item) => (
                <li key={item.id}>
                  {item.label}
                  {item.room ? ` · room: ${item.room}` : ''}
                  {item.capturePointId ? ` · capturePointId: ${item.capturePointId}` : ''}
                  {item.detail ? ` · ${item.detail}` : ''}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </section>
  );
}

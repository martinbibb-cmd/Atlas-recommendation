/**
 * ImplementationPackReviewPanel.tsx
 *
 * Dev-only panel for reviewing a SuggestedImplementationPackV1.
 *
 * Purpose:
 *   Renders all nine sections of the implementation pack for visual QA and
 *   developer review.  NOT customer-facing.
 *
 * Access: dev_only — never mounts in production customer journeys.
 *
 * Usage:
 *   <ImplementationPackReviewPanel pack={pack} />
 */

import type { SuggestedImplementationPackV1 } from '../../specification/SuggestedImplementationPackV1';
import type {
  SuggestedComponent,
  UnresolvedRisk,
  RequiredQualification,
  RequiredComplianceItem,
  RequiredValidation,
  ImplementationNoteSeverity,
} from '../../specification/SuggestedImplementationPackV1';

// ─── Severity badge ───────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<ImplementationNoteSeverity, string> = {
  required: '#c0392b',
  advisory: '#e67e22',
  info:     '#2980b9',
};

const SEVERITY_LABELS: Record<ImplementationNoteSeverity, string> = {
  required: 'REQUIRED',
  advisory: 'ADVISORY',
  info:     'INFO',
};

function SeverityBadge({ severity }: { severity: ImplementationNoteSeverity }) {
  return (
    <span
      style={{
        display:       'inline-block',
        padding:       '1px 6px',
        borderRadius:  3,
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: 0.5,
        color:         '#fff',
        background:    SEVERITY_COLORS[severity],
        marginRight:   6,
        verticalAlign: 'middle',
      }}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ComponentsList({ components }: { components: readonly SuggestedComponent[] }) {
  if (components.length === 0) return <p style={styles.empty}>No components specified.</p>;
  return (
    <ul style={styles.list}>
      {components.map((c) => (
        <li key={c.id} style={styles.listItem}>
          <strong>{c.description}</strong>
          <span
            style={{
              marginLeft:    8,
              fontSize:      10,
              background:    c.confidence === 'required' ? '#27ae60' : c.confidence === 'suggested' ? '#2980b9' : '#95a5a6',
              color:         '#fff',
              padding:       '1px 5px',
              borderRadius:  3,
              verticalAlign: 'middle',
            }}
          >
            {c.confidence}
          </span>
          {c.suggestedSpec && <div style={{ marginTop: 2, color: '#555', fontSize: 12 }}>Spec: {c.suggestedSpec}</div>}
          <div style={{ marginTop: 2, color: '#777', fontSize: 12 }}>Rationale: {c.rationale}</div>
        </li>
      ))}
    </ul>
  );
}

function NotesList({ notes, label }: { notes: readonly string[]; label?: string }) {
  if (notes.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {label && <div style={styles.subLabel}>{label}</div>}
      <ul style={styles.list}>
        {notes.map((n, i) => (
          <li key={i} style={{ ...styles.listItem, color: '#444' }}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function RisksList({ risks }: { risks: readonly UnresolvedRisk[] }) {
  if (risks.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={styles.subLabel}>Unresolved Risks</div>
      {risks.map((r) => (
        <div key={r.id} style={styles.riskCard}>
          <SeverityBadge severity={r.severity} />
          <strong style={{ fontSize: 12 }}>{r.description}</strong>
          <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
            Resolution: {r.resolution}
          </div>
        </div>
      ))}
    </div>
  );
}

function QualificationsList({ qualifications }: { qualifications: readonly RequiredQualification[] }) {
  if (qualifications.length === 0) return <p style={styles.empty}>None required.</p>;
  return (
    <ul style={styles.list}>
      {qualifications.map((q) => (
        <li key={q.id} style={styles.listItem}>
          <strong>{q.label}</strong>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Triggered by: {q.triggeredBy}</div>
          {q.reference && <div style={{ fontSize: 11, color: '#888' }}>Ref: {q.reference}</div>}
        </li>
      ))}
    </ul>
  );
}

function ComplianceList({ items }: { items: readonly RequiredComplianceItem[] }) {
  if (items.length === 0) return <p style={styles.empty}>None identified.</p>;
  return (
    <ul style={styles.list}>
      {items.map((c) => (
        <li key={c.id} style={styles.listItem}>
          <span
            style={{
              fontSize:   10,
              background: c.timing === 'before' ? '#e74c3c' : c.timing === 'during' ? '#e67e22' : '#27ae60',
              color:      '#fff',
              padding:    '1px 5px',
              borderRadius: 3,
              marginRight: 6,
              verticalAlign: 'middle',
            }}
          >
            {c.timing.toUpperCase()}
          </span>
          {c.description}
          {c.regulatoryRef && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Ref: {c.regulatoryRef}</div>}
        </li>
      ))}
    </ul>
  );
}

function ValidationsList({ validations }: { validations: readonly RequiredValidation[] }) {
  if (validations.length === 0) return <p style={styles.empty}>None identified.</p>;
  return (
    <ul style={styles.list}>
      {validations.map((v) => (
        <li key={v.id} style={styles.listItem}>
          <SeverityBadge severity={v.severity} />
          <strong style={{ fontSize: 12 }}>{v.check}</strong>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{v.reason}</div>
        </li>
      ))}
    </ul>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>{title}</span>
        {badge && (
          <span
            style={{
              marginLeft:   8,
              fontSize:     11,
              background:   '#34495e',
              color:        '#ecf0f1',
              padding:      '2px 7px',
              borderRadius: 10,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  pack: SuggestedImplementationPackV1;
}

/**
 * ImplementationPackReviewPanel
 *
 * Dev-only review panel for a SuggestedImplementationPackV1.
 * NOT customer-facing.
 */
export function ImplementationPackReviewPanel({ pack }: Props) {
  return (
    <div style={styles.root}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          Implementation Pack Review
          <span style={styles.devBadge}>DEV ONLY</span>
        </div>
        <div style={styles.headerMeta}>
          Scenario: <strong>{pack.recommendedScenarioId}</strong>
          &nbsp;·&nbsp;
          Version: <strong>{pack.packVersion}</strong>
          &nbsp;·&nbsp;
          Generated: <strong>{pack.generatedAt}</strong>
        </div>
        <div style={styles.headerWarning}>
          NOT customer-facing · NOT quote pricing · NOT compliance pass/fail · NOT final engineering design
        </div>
      </div>

      {/* ── Cross-section summary ───────────────────────────────────────── */}
      <Section
        title="Summary — Unresolved Risks"
        badge={`${pack.allUnresolvedRisks.length} risks`}
      >
        <RisksList risks={pack.allUnresolvedRisks} />
        {pack.allUnresolvedRisks.length === 0 && (
          <p style={styles.empty}>No unresolved risks identified.</p>
        )}
      </Section>

      <Section
        title="Summary — Required Qualifications"
        badge={`${pack.allRequiredQualifications.length}`}
      >
        <QualificationsList qualifications={pack.allRequiredQualifications} />
      </Section>

      <Section
        title="Summary — Required Compliance Items"
        badge={`${pack.allRequiredComplianceItems.length}`}
      >
        <ComplianceList items={pack.allRequiredComplianceItems} />
      </Section>

      <Section
        title="Summary — Required Site Validations"
        badge={`${pack.allRequiredValidations.length}`}
      >
        <ValidationsList validations={pack.allRequiredValidations} />
      </Section>

      {/* ── Section 1: Heat source ──────────────────────────────────────── */}
      <Section title="1. Heat Source">
        <div style={styles.fieldRow}>
          <span style={styles.fieldLabel}>Recommended family:</span>
          <strong>{pack.heatSource.label}</strong>
          <span style={{ marginLeft: 8, color: '#777', fontSize: 12 }}>({pack.heatSource.recommendedFamily})</span>
        </div>
        <NotesList notes={pack.heatSource.sizingRationale} label="Sizing Rationale" />
        <ComponentsList components={pack.heatSource.suggestedComponents} />
        <NotesList notes={pack.heatSource.installNotes} label="Install Notes" />
        <RisksList risks={pack.heatSource.unresolvedRisks} />
      </Section>

      {/* ── Section 2: Hot water ────────────────────────────────────────── */}
      <Section title="2. Hot Water">
        <div style={styles.fieldRow}>
          <span style={styles.fieldLabel}>DHW Strategy:</span>
          <strong>{pack.hotWater.strategy}</strong>
        </div>
        <ComponentsList components={pack.hotWater.suggestedComponents} />
        {pack.hotWater.expansionManagement && (
          <NotesList notes={pack.hotWater.expansionManagement} label="Expansion Management" />
        )}
        {pack.hotWater.dischargeRequirements && (
          <NotesList notes={pack.hotWater.dischargeRequirements} label="Discharge / Tundish Requirements" />
        )}
        <NotesList notes={pack.hotWater.installNotes} label="Install Notes" />
        <RisksList risks={pack.hotWater.unresolvedRisks} />
      </Section>

      {/* ── Section 3: Hydraulic components ────────────────────────────── */}
      <Section title="3. Hydraulic Components">
        <ComponentsList components={pack.hydraulicComponents.suggestedComponents} />
        <NotesList notes={pack.hydraulicComponents.installNotes} label="Install Notes" />
        <RisksList risks={pack.hydraulicComponents.unresolvedRisks} />
      </Section>

      {/* ── Section 4: Controls ─────────────────────────────────────────── */}
      <Section title="4. Controls">
        <ComponentsList components={pack.controls.suggestedComponents} />
        <NotesList notes={pack.controls.installNotes} label="Install Notes" />
        <RisksList risks={pack.controls.unresolvedRisks} />
      </Section>

      {/* ── Section 5: Water quality ─────────────────────────────────────── */}
      <Section title="5. Water Quality">
        {pack.waterQuality.filterRecommendation && (
          <div style={styles.qualityItem}>
            <span style={styles.fieldLabel}>Filter:</span> {pack.waterQuality.filterRecommendation}
          </div>
        )}
        {pack.waterQuality.flushStrategy && (
          <div style={styles.qualityItem}>
            <span style={styles.fieldLabel}>Flush strategy:</span> {pack.waterQuality.flushStrategy}
          </div>
        )}
        {pack.waterQuality.inhibitorRecommendation && (
          <div style={styles.qualityItem}>
            <span style={styles.fieldLabel}>Inhibitor:</span> {pack.waterQuality.inhibitorRecommendation}
          </div>
        )}
        {pack.waterQuality.scaleManagement && (
          <div style={styles.qualityItem}>
            <span style={styles.fieldLabel}>Scale management:</span> {pack.waterQuality.scaleManagement}
          </div>
        )}
        <ComponentsList components={pack.waterQuality.suggestedComponents} />
        <NotesList notes={pack.waterQuality.installNotes} label="Install Notes" />
        <RisksList risks={pack.waterQuality.unresolvedRisks} />
      </Section>

      {/* ── Section 6: Safety / compliance ──────────────────────────────── */}
      <Section title="6. Safety &amp; Compliance">
        <div style={styles.subLabel}>Required Qualifications</div>
        <QualificationsList qualifications={pack.safetyCompliance.requiredQualifications} />
        <div style={{ marginTop: 12, ...styles.subLabel }}>Required Compliance Items</div>
        <ComplianceList items={pack.safetyCompliance.requiredComplianceItems} />
        <NotesList notes={pack.safetyCompliance.installNotes} label="Install Notes" />
        <RisksList risks={pack.safetyCompliance.unresolvedRisks} />
      </Section>

      {/* ── Section 7: Pipework ──────────────────────────────────────────── */}
      <Section title="7. Pipework">
        <NotesList notes={pack.pipework.topologyNotes} label="Topology Notes" />
        <NotesList notes={pack.pipework.pipeSizingNotes} label="Pipe Sizing Notes" />
        <NotesList notes={pack.pipework.routingNotes} label="Routing Notes" />
        <ComponentsList components={pack.pipework.suggestedComponents} />
        <RisksList risks={pack.pipework.unresolvedRisks} />
      </Section>

      {/* ── Section 8: Commissioning ─────────────────────────────────────── */}
      <Section title="8. Commissioning">
        <NotesList notes={pack.commissioning.steps} label="Commissioning Steps" />
        <NotesList notes={pack.commissioning.requiredDocumentation} label="Required Documentation" />
        <RisksList risks={pack.commissioning.unresolvedRisks} />
      </Section>

      {/* ── Section 9: Future ready ──────────────────────────────────────── */}
      <Section title="9. Future-Ready Options">
        {pack.futureReady.items.length === 0 && (
          <p style={styles.empty}>No future-ready items identified.</p>
        )}
        {pack.futureReady.items.map((item) => (
          <div key={item.id} style={styles.futureItem}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{item.label}</strong>
              <span
                style={{
                  fontSize:     10,
                  background:   item.horizon === 'near_term' ? '#8e44ad' : '#7f8c8d',
                  color:        '#fff',
                  padding:      '1px 5px',
                  borderRadius: 3,
                }}
              >
                {item.horizon === 'near_term' ? 'NEAR TERM' : 'LONG TERM'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{item.preparationNote}</div>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    fontFamily:    "'Inter', system-ui, sans-serif",
    fontSize:      13,
    color:         '#2c3e50',
    background:    '#f0f2f5',
    minHeight:     '100vh',
    padding:       16,
  } as React.CSSProperties,

  header: {
    background:    '#1a252f',
    color:         '#ecf0f1',
    borderRadius:  6,
    padding:       '12px 16px',
    marginBottom:  16,
  } as React.CSSProperties,

  headerTitle: {
    fontSize:      18,
    fontWeight:    700,
    display:       'flex',
    alignItems:    'center',
    gap:           10,
  } as React.CSSProperties,

  devBadge: {
    fontSize:      10,
    background:    '#e74c3c',
    color:         '#fff',
    padding:       '2px 8px',
    borderRadius:  10,
    fontWeight:    700,
    letterSpacing: 1,
  } as React.CSSProperties,

  headerMeta: {
    marginTop:     6,
    fontSize:      12,
    color:         '#bdc3c7',
  } as React.CSSProperties,

  headerWarning: {
    marginTop:     6,
    fontSize:      11,
    color:         '#e67e22',
    fontStyle:     'italic',
  } as React.CSSProperties,

  section: {
    background:    '#fff',
    borderRadius:  6,
    marginBottom:  12,
    overflow:      'hidden',
    boxShadow:     '0 1px 3px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  sectionHeader: {
    background:    '#2c3e50',
    color:         '#ecf0f1',
    padding:       '8px 14px',
    display:       'flex',
    alignItems:    'center',
  } as React.CSSProperties,

  sectionTitle: {
    fontWeight:    600,
    fontSize:      13,
  } as React.CSSProperties,

  sectionBody: {
    padding:       '10px 14px',
  } as React.CSSProperties,

  subLabel: {
    fontSize:      11,
    fontWeight:    700,
    color:         '#7f8c8d',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom:  4,
  } as React.CSSProperties,

  fieldRow: {
    display:       'flex',
    alignItems:    'center',
    gap:           6,
    marginBottom:  6,
    fontSize:      13,
  } as React.CSSProperties,

  fieldLabel: {
    color:         '#7f8c8d',
    fontWeight:    600,
    fontSize:      12,
    minWidth:      120,
  } as React.CSSProperties,

  list: {
    margin:        '4px 0',
    paddingLeft:   18,
  } as React.CSSProperties,

  listItem: {
    marginBottom:  6,
    lineHeight:    1.5,
    fontSize:      13,
  } as React.CSSProperties,

  empty: {
    color:         '#95a5a6',
    fontStyle:     'italic',
    fontSize:      12,
    margin:        '4px 0',
  } as React.CSSProperties,

  riskCard: {
    background:    '#fdf6f0',
    border:        '1px solid #e8d5c7',
    borderRadius:  4,
    padding:       '6px 10px',
    marginBottom:  6,
  } as React.CSSProperties,

  qualityItem: {
    marginBottom:  6,
    fontSize:      13,
    lineHeight:    1.5,
  } as React.CSSProperties,

  futureItem: {
    background:    '#f8f9ff',
    border:        '1px solid #dde3f0',
    borderRadius:  4,
    padding:       '8px 12px',
    marginBottom:  8,
  } as React.CSSProperties,
};

export default ImplementationPackReviewPanel;

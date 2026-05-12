import { useMemo, useState } from 'react';
import type { ScopePackHandoverPackSummaryV1, ScopePackHandoverV1 } from '../../specification/handover';

interface Props {
  handover: ScopePackHandoverV1;
}

type HandoverPreviewTab = 'customer' | 'engineer' | 'office';

function renderPackSummaries(
  packs: readonly ScopePackHandoverPackSummaryV1[],
  testIdPrefix: string,
) {
  if (packs.length === 0) {
    return <p style={{ margin: 0, color: '#64748b' }}>No scope packs available for this handover view.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {packs.map((pack) => (
        <section
          key={pack.packId}
          style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem', background: '#fff' }}
          data-testid={`${testIdPrefix}-pack-${pack.packId}`}
        >
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{pack.packLabel}</h3>
          <p style={{ margin: '0 0 0.5rem', fontSize: 13, color: '#334155' }}>{pack.summary}</p>
          {pack.lines.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.35rem' }}>
              {pack.lines.map((line) => (
                <li key={line.lineId} style={{ fontSize: 12, color: '#0f172a' }}>
                  <strong>{line.label}</strong>
                  {line.description !== line.label ? ` — ${line.description}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No audience-visible specification lines.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Checklist({
  title,
  items,
  emptyText,
  testId,
}: {
  title: string;
  items: readonly string[];
  emptyText: string;
  testId: string;
}) {
  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem', background: '#fff' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{title}</h3>
      {items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.35rem' }} data-testid={testId}>
          {items.map((item) => (
            <li key={item} style={{ fontSize: 12 }}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{emptyText}</p>
      )}
    </section>
  );
}

export default function ScopePackHandoverPreviewPanel({ handover }: Props) {
  const [activeTab, setActiveTab] = useState<HandoverPreviewTab>('customer');

  const engineerValidationItems = useMemo(
    () => handover.engineerInstallNotes.validations.map((validation) => `${validation.check} — ${validation.reason}`),
    [handover.engineerInstallNotes.validations],
  );
  const engineerRiskItems = useMemo(
    () => handover.engineerInstallNotes.risks.map((risk) => `${risk.description} — ${risk.resolution}`),
    [handover.engineerInstallNotes.risks],
  );
  const unresolvedCheckItems = useMemo(
    () => handover.officeReviewSummary.unresolvedChecks.map((check) => `${check.label} — ${check.detail}`),
    [handover.officeReviewSummary.unresolvedChecks],
  );
  const qualificationItems = useMemo(
    () => handover.officeReviewSummary.qualifications.map((item) => `${item.label} — ${item.triggeredBy}`),
    [handover.officeReviewSummary.qualifications],
  );
  const complianceItems = useMemo(
    () => handover.officeReviewSummary.compliance.map((item) => `${item.description} — ${item.regulatoryRef ?? item.timing}`),
    [handover.officeReviewSummary.compliance],
  );
  const excludedItems = useMemo(
    () => handover.excludedOrDeferredItems.map((item) => `${item.label} — ${item.detail}`),
    [handover.excludedOrDeferredItems],
  );

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="scope-pack-handover-preview-panel">
      <div
        style={{ display: 'flex', gap: '0.5rem' }}
        role="tablist"
        aria-label="Scope pack handover preview tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'customer'}
          onClick={() => setActiveTab('customer')}
          className="dev-portal-fixture__btn"
          data-testid="scope-pack-handover-tab-customer"
        >
          Customer handover
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'engineer'}
          onClick={() => setActiveTab('engineer')}
          className="dev-portal-fixture__btn"
          data-testid="scope-pack-handover-tab-engineer"
        >
          Engineer handover
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'office'}
          onClick={() => setActiveTab('office')}
          className="dev-portal-fixture__btn"
          data-testid="scope-pack-handover-tab-office"
        >
          Office review
        </button>
      </div>

      {activeTab === 'customer' ? (
        renderPackSummaries(handover.customerScopeSummary.packs, 'scope-pack-handover-customer')
      ) : activeTab === 'engineer' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {renderPackSummaries(handover.engineerInstallNotes.packs, 'scope-pack-handover-engineer')}
          <Checklist
            title="Validation checklist"
            items={engineerValidationItems}
            emptyText="No engineer validations identified."
            testId="scope-pack-handover-engineer-validations"
          />
          <Checklist
            title="Risks"
            items={engineerRiskItems}
            emptyText="No engineer risks identified."
            testId="scope-pack-handover-engineer-risks"
          />
          <Checklist
            title="Commissioning notes"
            items={handover.engineerInstallNotes.commissioningNotes}
            emptyText="No commissioning notes identified."
            testId="scope-pack-handover-engineer-commissioning"
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {renderPackSummaries(handover.officeReviewSummary.packs, 'scope-pack-handover-office')}
          <Checklist
            title="Qualifications"
            items={qualificationItems}
            emptyText="No qualifications identified."
            testId="scope-pack-handover-office-qualifications"
          />
          <Checklist
            title="Compliance"
            items={complianceItems}
            emptyText="No compliance items identified."
            testId="scope-pack-handover-office-compliance"
          />
          <Checklist
            title="Unresolved checks"
            items={unresolvedCheckItems}
            emptyText="No unresolved checks identified."
            testId="scope-pack-handover-office-unresolved"
          />
          <Checklist
            title="Excluded or deferred items"
            items={excludedItems}
            emptyText="No excluded or deferred items."
            testId="scope-pack-handover-office-excluded"
          />
        </div>
      )}
    </div>
  );
}

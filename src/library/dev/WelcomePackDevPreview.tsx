import { useEffect, useMemo, useState } from 'react';
import { BRAND_PROFILES, DEFAULT_BRAND_ID } from '../../features/branding/brandProfiles';
import { getAuditForAsset } from '../audits/auditLookup';
import { getLibraryReadyAssets } from '../audits/getLibraryReadyAssets';
import { CalmWelcomePack } from '../packRenderer/CalmWelcomePack';
import { PrintableWelcomePackSkeleton } from '../packRenderer/PrintableWelcomePackSkeleton';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import {
  getContentQaErrors,
  getContentQaWarnings,
  runEducationalContentQa,
} from '../content/qa/runEducationalContentQa';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';
import {
  getAssetQaErrors,
  getAssetQaWarnings,
  runEducationalAssetQa,
} from '../registry/qa/runEducationalAssetQa';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { buildDemoWelcomePack } from './buildDemoWelcomePack';
import {
  welcomePackDemoFixtureList,
  type WelcomePackDemoFixtureId,
} from './welcomePackDemoFixtures';
import type { WelcomePackEligibilityMode } from '../packComposer/WelcomePackComposerV1';

function toAccessibilityProfiles(dyslexia: boolean, adhd: boolean): Array<'dyslexia' | 'adhd'> {
  const profiles: Array<'dyslexia' | 'adhd'> = [];
  if (dyslexia) {
    profiles.push('dyslexia');
  }
  if (adhd) {
    profiles.push('adhd');
  }
  return profiles;
}

export function WelcomePackDevPreview() {
  const [fixtureId, setFixtureId] = useState<WelcomePackDemoFixtureId>('heat_pump_install');
  const selectedFixture = useMemo(
    () => welcomePackDemoFixtureList.find((fixture) => fixture.id === fixtureId) ?? welcomePackDemoFixtureList[0],
    [fixtureId],
  );

  const [printFirst, setPrintFirst] = useState(Boolean(selectedFixture.accessibilityPreferences.prefersPrint));
  const [dyslexia, setDyslexia] = useState(selectedFixture.accessibilityPreferences.profiles?.includes('dyslexia') ?? false);
  const [adhd, setAdhd] = useState(selectedFixture.accessibilityPreferences.profiles?.includes('adhd') ?? false);
  const [technicalAppendix, setTechnicalAppendix] = useState(
    Boolean(selectedFixture.accessibilityPreferences.includeTechnicalAppendix),
  );
  const [previewCalmCustomerPack, setPreviewCalmCustomerPack] = useState(false);
  const [eligibilityMode, setEligibilityMode] = useState<WelcomePackEligibilityMode>('off');
  const [brandId, setBrandId] = useState(DEFAULT_BRAND_ID);
  const brandOptions = useMemo(
    () => Object.values(BRAND_PROFILES).map((profile) => ({ id: profile.brandId, label: profile.companyName })),
    [],
  );

  useEffect(() => {
    setPrintFirst(Boolean(selectedFixture.accessibilityPreferences.prefersPrint));
    setDyslexia(selectedFixture.accessibilityPreferences.profiles?.includes('dyslexia') ?? false);
    setAdhd(selectedFixture.accessibilityPreferences.profiles?.includes('adhd') ?? false);
    setTechnicalAppendix(Boolean(selectedFixture.accessibilityPreferences.includeTechnicalAppendix));
  }, [selectedFixture]);

  const { plan, viewModel, brandedCalmViewModel } = useMemo(() => buildDemoWelcomePack({
    fixtureId,
    accessibilityOverrides: {
      prefersPrint: printFirst,
      includeTechnicalAppendix: technicalAppendix,
      profiles: toAccessibilityProfiles(dyslexia, adhd),
    },
    eligibilityMode,
    brandId,
  }), [
    fixtureId,
    printFirst,
    dyslexia,
    adhd,
    technicalAppendix,
    eligibilityMode,
    brandId,
  ]);

  const { contentQaFindings, contentQaErrors, contentQaWarnings } = useMemo(() => {
    const findings = runEducationalContentQa(educationalContentRegistry);
    return {
      contentQaFindings: findings,
      contentQaErrors: getContentQaErrors(findings),
      contentQaWarnings: getContentQaWarnings(findings),
    };
  }, []);

  const { assetQaFindings, assetQaErrors, assetQaWarnings } = useMemo(() => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    return {
      assetQaFindings: findings,
      assetQaErrors: getAssetQaErrors(findings),
      assetQaWarnings: getAssetQaWarnings(findings),
    };
  }, []);
  const selectedConceptContentStatus = useMemo(() => plan.selectedConceptIds.map((conceptId) => {
    const contentEntry = educationalContentRegistry.find((entry) => entry.conceptId === conceptId);
    if (!contentEntry) {
      return {
        conceptId,
        contentId: 'missing',
        status: 'error' as const,
        errorCount: 1,
        warningCount: 0,
      };
    }

    const findings = contentQaFindings.filter((finding) => finding.contentId === contentEntry.contentId);
    const errorCount = findings.filter((finding) => finding.severity === 'error').length;
    const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
    const status = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'pass';
    return {
      conceptId,
      contentId: contentEntry.contentId,
      status,
      errorCount,
      warningCount,
    };
  }), [plan.selectedConceptIds, contentQaFindings]);

  const selectedAssetQaStatus = useMemo(() => {
    const assets = educationalAssetRegistry.filter((asset) =>
      asset.conceptIds.some((conceptId) => plan.selectedConceptIds.includes(conceptId)),
    );
    return assets.map((asset) => {
      const findings = assetQaFindings.filter((finding) => finding.assetId === asset.id);
      const errorCount = findings.filter((finding) => finding.severity === 'error').length;
      const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
      const status = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'pass';
      return {
        assetId: asset.id,
        status,
        errorCount,
        warningCount,
      };
    });
  }, [plan.selectedConceptIds, assetQaFindings]);

  const selectedAssetAuditStatus = useMemo(() => {
    const assets = educationalAssetRegistry.filter((asset) =>
      asset.conceptIds.some((conceptId) => plan.selectedConceptIds.includes(conceptId)),
    );
    const { blockedAssets } = getLibraryReadyAssets(
      assets,
      assetQaFindings,
      educationalComponentRegistry as Record<string, unknown>,
    );
    const blockedById = new Map(blockedAssets.map((b) => [b.assetId, b]));
    return assets.map((asset) => {
      const audit = getAuditForAsset(asset.id);
      const blocked = blockedById.get(asset.id);
      return {
        assetId: asset.id,
        auditStatus: audit ? audit.status : 'no_audit',
        approvedFor: audit ? audit.approvedFor : [],
        blockedReasons: blocked ? blocked.blockedReasons : [],
        ready: !blocked,
      };
    });
  }, [plan.selectedConceptIds, assetQaFindings]);

  return (
    <main style={{ margin: '0 auto', maxWidth: 1200, padding: '1rem' }}>
      <h1>Welcome pack development preview</h1>
      <p><strong>Development preview — not customer content.</strong></p>

      <section aria-label="Fixture and preview controls" style={{ marginBottom: '1rem' }}>
        <label htmlFor="welcome-pack-fixture-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Fixture
        </label>
        <select
          id="welcome-pack-fixture-select"
          aria-label="Fixture selector"
          value={fixtureId}
          onChange={(event) => setFixtureId(event.target.value as WelcomePackDemoFixtureId)}
        >
          {welcomePackDemoFixtureList.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>{fixture.label}</option>
          ))}
        </select>

        <fieldset style={{ marginTop: '1rem' }}>
          <legend>Accessibility toggles</legend>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={printFirst}
              onChange={(event) => setPrintFirst(event.target.checked)}
            />
            {' '}
            print-first
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={dyslexia}
              onChange={(event) => setDyslexia(event.target.checked)}
            />
            {' '}
            dyslexia
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={adhd}
              onChange={(event) => setAdhd(event.target.checked)}
            />
            {' '}
            ADHD
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={technicalAppendix}
              onChange={(event) => setTechnicalAppendix(event.target.checked)}
            />
            {' '}
            technical appendix
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={previewCalmCustomerPack}
              onChange={(event) => setPreviewCalmCustomerPack(event.target.checked)}
            />
            {' '}
            Preview calm customer pack
          </label>
        </fieldset>

        <fieldset style={{ marginTop: '1rem' }}>
          <legend>Production eligibility</legend>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="eligibility-mode"
              value="off"
              checked={eligibilityMode === 'off'}
              onChange={() => setEligibilityMode('off')}
            />
            {' '}
            off (dev preview — show all assets)
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="eligibility-mode"
              value="warn"
              checked={eligibilityMode === 'warn'}
              onChange={() => setEligibilityMode('warn')}
            />
            {' '}
            warn (show production eligibility, keep assets selected)
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name="eligibility-mode"
              value="filter"
              checked={eligibilityMode === 'filter'}
              onChange={() => setEligibilityMode('filter')}
            />
            {' '}
            filter (remove ineligible assets from production customer pack)
          </label>
        </fieldset>

        <label htmlFor="welcome-pack-brand-select" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.5rem' }}>
          Brand profile
        </label>
        <select
          id="welcome-pack-brand-select"
          aria-label="Brand profile selector"
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
        >
          {brandOptions.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.label}</option>
          ))}
        </select>
      </section>

      <section aria-label="Plan metadata" style={{ marginBottom: '1rem' }}>
        <h2>Plan metadata</h2>
        <dl>
          <dt>archetypeId</dt>
          <dd>{plan.archetypeId}</dd>
          <dt>pageBudgetUsed</dt>
          <dd>{plan.pageBudgetUsed} / {plan.printPageBudget}</dd>
          <dt>recommendedScenarioId</dt>
          <dd>{plan.recommendedScenarioId}</dd>
          <dt>Technical appendix visibility</dt>
          <dd data-testid="technical-appendix-visibility">{technicalAppendix ? 'visible' : 'hidden'}</dd>
        </dl>

        <h3>selectedConceptIds</h3>
        <ul>
          {plan.selectedConceptIds.map((conceptId) => (
            <li key={`selected-${conceptId}`}>{conceptId}</li>
          ))}
        </ul>

        <h3>deferredConceptIds</h3>
        <ul>
          {plan.deferredConceptIds.length === 0 ? <li>None</li> : plan.deferredConceptIds.map((conceptId) => (
            <li key={`deferred-${conceptId}`}>{conceptId}</li>
          ))}
        </ul>

        <h3>QR destinations</h3>
        <ul>
          {plan.qrDestinations.length === 0 ? <li>None</li> : plan.qrDestinations.map((destination) => (
            <li key={destination}>{destination}</li>
          ))}
        </ul>

        <h3>Omitted assets and reasons</h3>
        <ul>
          {viewModel.omittedSummary.omittedAssets.length === 0 ? <li>None</li> : viewModel.omittedSummary.omittedAssets.map((item) => (
            <li key={item.assetId}>
              <strong>{item.assetId}</strong>: {item.reason}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Content QA" style={{ marginBottom: '1rem' }}>
        <h2>Content QA</h2>

        <h3>Content QA Errors</h3>
        <ul data-testid="content-qa-errors">
          {contentQaErrors.length === 0 ? <li>None</li> : contentQaErrors.map((finding) => (
            <li key={`${finding.contentId}-${finding.ruleId}-${finding.field}`}>
              <strong>{finding.contentId}</strong> [{finding.field}]: {finding.message}
            </li>
          ))}
        </ul>

        <h3>Content QA Warnings</h3>
        <ul data-testid="content-qa-warnings">
          {contentQaWarnings.length === 0 ? <li>None</li> : contentQaWarnings.map((finding) => (
            <li key={`${finding.contentId}-${finding.ruleId}-${finding.field}`}>
              <strong>{finding.contentId}</strong> [{finding.field}]: {finding.message}
            </li>
          ))}
        </ul>

        <h3>Per selected concept content status</h3>
        <ul data-testid="selected-concept-content-status">
          {selectedConceptContentStatus.map((item) => (
            <li key={`${item.conceptId}-${item.contentId}`}>
              <strong>{item.conceptId}</strong> → {item.contentId} ({item.status}; errors: {item.errorCount}; warnings: {item.warningCount})
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Asset QA" style={{ marginBottom: '1rem' }}>
        <h2>Asset QA</h2>

        <h3>Asset QA Errors</h3>
        <ul data-testid="asset-qa-errors">
          {assetQaErrors.length === 0 ? <li>None</li> : assetQaErrors.map((finding) => (
            <li key={`${finding.assetId}-${finding.ruleId}-${finding.field}`}>
              <strong>{finding.assetId}</strong> [{finding.field}]: {finding.message}
            </li>
          ))}
        </ul>

        <h3>Asset QA Warnings</h3>
        <ul data-testid="asset-qa-warnings">
          {assetQaWarnings.length === 0 ? <li>None</li> : assetQaWarnings.map((finding) => (
            <li key={`${finding.assetId}-${finding.ruleId}-${finding.field}`}>
              <strong>{finding.assetId}</strong> [{finding.field}]: {finding.message}
            </li>
          ))}
        </ul>

        <h3>Per selected asset QA status</h3>
        <ul data-testid="selected-asset-qa-status">
          {selectedAssetQaStatus.length === 0 ? <li>None</li> : selectedAssetQaStatus.map((item) => (
            <li key={item.assetId}>
              <strong>{item.assetId}</strong> ({item.status}; errors: {item.errorCount}; warnings: {item.warningCount})
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Asset accessibility audit" style={{ marginBottom: '1rem' }}>
        <h2>Asset accessibility audit</h2>
        <p>
          Audit status is diagnostic only. An asset moves to{' '}
          <code>library_ready</code> only when its audit status is{' '}
          <code>passed</code> and all checks are satisfied.
        </p>

        <h3>Per selected asset audit status</h3>
        <ul data-testid="selected-asset-audit-status">
          {selectedAssetAuditStatus.length === 0 ? (
            <li>None</li>
          ) : (
            selectedAssetAuditStatus.map((item) => (
              <li key={`audit-${item.assetId}`}>
                <strong>{item.assetId}</strong>
                {' — audit: '}
                <span data-testid={`audit-status-${item.assetId}`}>{item.auditStatus}</span>
                {item.approvedFor.length > 0 && (
                  <>{'; approved for: '}<span data-testid={`approved-for-${item.assetId}`}>{item.approvedFor.join(', ')}</span></>
                )}
                {item.blockedReasons.length > 0 && (
                  <ul data-testid={`blocked-reasons-${item.assetId}`}>
                    {item.blockedReasons.map((reason, idx) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-label="Production eligibility" style={{ marginBottom: '1rem' }}>
        <h2>Production eligibility</h2>
        <p>
          Eligibility gates output delivery readiness only. They do not alter recommendations,
          scenario ranking, or engine truth. Dev preview can show unapproved assets; production
          customer pack should use <code>filter</code> mode.
        </p>
        <p data-testid="eligibility-mode-label">
          Mode: <strong data-testid="eligibility-mode-value">{eligibilityMode}</strong>
        </p>

        {eligibilityMode === 'off' ? (
          <p>Eligibility gate is off. All routing-selected assets are shown without delivery-readiness checks.</p>
        ) : (
          <>
            <h3>Per selected asset eligibility status</h3>
            <ul data-testid="selected-asset-eligibility-status">
              {(plan.eligibilityFindings ?? []).length === 0 ? (
                <li>None</li>
              ) : (
                (plan.eligibilityFindings ?? []).map((finding) => (
                  <li key={`eligibility-${finding.assetId}`} data-testid={`eligibility-${finding.assetId}`}>
                    <strong>{finding.assetId}</strong>
                    {' — '}
                    <span data-testid={`eligibility-status-${finding.assetId}`}>
                      {finding.eligible ? 'eligible' : 'blocked'}
                    </span>
                    {' (mode: '}
                    {finding.mode}
                    {')'}
                    {finding.reasons.length > 0 && (
                      <ul data-testid={`eligibility-reasons-${finding.assetId}`}>
                        {finding.reasons.map((reason, idx) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    {finding.replacementHint && (
                      <p data-testid={`eligibility-hint-${finding.assetId}`}>
                        Hint: {finding.replacementHint}
                      </p>
                    )}
                  </li>
                ))
              )}
            </ul>

            {eligibilityMode === 'filter' && (
              <>
                <h3>Assets removed from production customer pack</h3>
                <ul data-testid="eligibility-filtered-assets">
                  {(plan.eligibilityFindings ?? []).filter((f) => !f.eligible).length === 0 ? (
                    <li>None — all selected assets are eligible for this delivery mode.</li>
                  ) : (
                    (plan.eligibilityFindings ?? []).filter((f) => !f.eligible).map((finding) => (
                      <li key={`filtered-${finding.assetId}`} data-testid={`filtered-${finding.assetId}`}>
                        <strong>{finding.assetId}</strong>: {finding.reasons.join(' ')}
                        {finding.replacementHint && <> — {finding.replacementHint}</>}
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {previewCalmCustomerPack && (
        <section aria-label="Calm customer pack preview" style={{ marginBottom: '1rem' }}>
          <h2>Calm customer pack preview</h2>
          <CalmWelcomePack viewModel={brandedCalmViewModel} />
        </section>
      )}

      <PrintableWelcomePackSkeleton viewModel={viewModel} />
    </main>
  );
}

export default WelcomePackDevPreview;

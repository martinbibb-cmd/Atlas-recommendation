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
import {
  runWelcomePackValidation,
  detectRepeatedOmissionPatterns,
  collectTopMissingConcepts,
} from './runWelcomePackValidation';
import type { WelcomePackValidationReportV1 } from './WelcomePackValidationReportV1';
import { AtlasEducationalUiDemo } from '../ui/demo';

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
  const [showValidationAudit, setShowValidationAudit] = useState(false);
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

  const validationReports = useMemo<WelcomePackValidationReportV1[]>(() => {
    if (!showValidationAudit) {
      return [];
    }
    return runWelcomePackValidation('warn');
  }, [showValidationAudit]);

  const repeatedOmissions = useMemo(
    () => detectRepeatedOmissionPatterns(validationReports, 3),
    [validationReports],
  );

  const topMissingConcepts = useMemo(
    () => collectTopMissingConcepts(validationReports),
    [validationReports],
  );

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
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={showValidationAudit}
              onChange={(event) => setShowValidationAudit(event.target.checked)}
            />
            {' '}
            Run validation audit (all 12 real-world fixtures)
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

      {showValidationAudit && (
        <section aria-label="Validation audit" style={{ marginBottom: '1rem' }}>
          <h2>Real-world validation audit</h2>
          <p>
            Stress-testing the calm welcome-pack pipeline using 12 realistic customer journeys.
            This audit does not change recommendations — it surfaces content, routing, accessibility, and trust gaps.
          </p>

          <h3>Top missing concepts (across all fixtures)</h3>
          <ul data-testid="validation-top-missing-concepts">
            {topMissingConcepts.length === 0 ? (
              <li>None — all selected concepts have registered content.</li>
            ) : (
              topMissingConcepts.map((item) => (
                <li key={item.conceptId}>
                  <strong>{item.conceptId}</strong>: missing in {item.count} fixture(s) — {item.missingInFixtures.join(', ')}
                </li>
              ))
            )}
          </ul>

          <h3>Repeated omission patterns (omitted in ≥ 3 fixtures)</h3>
          <ul data-testid="validation-repeated-omissions">
            {repeatedOmissions.length === 0 ? (
              <li>None — no assets are repeatedly omitted across 3 or more fixtures.</li>
            ) : (
              repeatedOmissions.map((item) => (
                <li key={item.assetId}>
                  <strong>{item.assetId}</strong>: omitted in {item.count} fixture(s) — {item.omittedInFixtures.join(', ')}
                </li>
              ))
            )}
          </ul>

          <h3>Fixture comparison table</h3>
          <table data-testid="validation-fixture-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Fixture</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Archetype</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Readiness</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Selected</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Pages</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Missing content</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Trust risks</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>A11y risks</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #ccc' }}>Print risks</th>
              </tr>
            </thead>
            <tbody>
              {validationReports.map((report) => (
                <tr key={report.fixtureId} data-testid={`validation-row-${report.fixtureId}`}>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.fixtureLabel}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.archetypeId}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                    <span data-testid={`validation-readiness-${report.fixtureId}`}>{report.readiness}</span>
                  </td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.selectedAssetIds.length}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.pageCount}/{report.printPageBudget}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.missingContent.length}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.trustRisks.length}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.accessibilityRisks.length}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{report.printRisks.length}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Per-fixture gap details</h3>
          {validationReports.map((report) => (
            <details key={report.fixtureId} style={{ marginBottom: '0.5rem' }}>
              <summary data-testid={`validation-summary-${report.fixtureId}`}>
                <strong>{report.fixtureLabel}</strong>
                {' — '}
                {report.archetypeId}
                {' — '}
                readiness: {report.readiness}
              </summary>
              <dl style={{ paddingLeft: '1rem' }}>
                {report.missingContent.length > 0 && (
                  <>
                    <dt>Missing content</dt>
                    <dd>
                      <ul>
                        {report.missingContent.map((gap) => (
                          <li key={gap.conceptId}>{gap.conceptId}: {gap.reason}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.missingAnalogies.length > 0 && (
                  <>
                    <dt>Missing analogies / misconception coverage</dt>
                    <dd>
                      <ul>
                        {report.missingAnalogies.map((a, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.trustRisks.length > 0 && (
                  <>
                    <dt>Trust risks</dt>
                    <dd>
                      <ul>
                        {report.trustRisks.map((r, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.accessibilityRisks.length > 0 && (
                  <>
                    <dt>Accessibility risks</dt>
                    <dd>
                      <ul>
                        {report.accessibilityRisks.map((r, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.printRisks.length > 0 && (
                  <>
                    <dt>Print risks</dt>
                    <dd>
                      <ul>
                        {report.printRisks.map((r, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.cognitiveOverloadWarnings.length > 0 && (
                  <>
                    <dt>Cognitive overload warnings</dt>
                    <dd>
                      <ul>
                        {report.cognitiveOverloadWarnings.map((w, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.likelyCustomerConfusionPoints.length > 0 && (
                  <>
                    <dt>Likely customer confusion points</dt>
                    <dd>
                      <ul>
                        {report.likelyCustomerConfusionPoints.map((p, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {report.recommendedNextContentAdditions.length > 0 && (
                  <>
                    <dt>Recommended next content additions</dt>
                    <dd>
                      <ul>
                        {report.recommendedNextContentAdditions.map((a, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
              </dl>
            </details>
          ))}
        </section>
      )}

      <AtlasEducationalUiDemo />

      <PrintableWelcomePackSkeleton viewModel={viewModel} />
    </main>
  );
}

export default WelcomePackDevPreview;

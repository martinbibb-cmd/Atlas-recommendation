import { useEffect, useMemo, useState } from 'react';
import { PrintableWelcomePackSkeleton } from '../packRenderer/PrintableWelcomePackSkeleton';
import { buildDemoWelcomePack } from './buildDemoWelcomePack';
import {
  welcomePackDemoFixtureList,
  type WelcomePackDemoFixtureId,
} from './welcomePackDemoFixtures';

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

  useEffect(() => {
    setPrintFirst(Boolean(selectedFixture.accessibilityPreferences.prefersPrint));
    setDyslexia(selectedFixture.accessibilityPreferences.profiles?.includes('dyslexia') ?? false);
    setAdhd(selectedFixture.accessibilityPreferences.profiles?.includes('adhd') ?? false);
    setTechnicalAppendix(Boolean(selectedFixture.accessibilityPreferences.includeTechnicalAppendix));
  }, [selectedFixture]);

  const { plan, viewModel } = useMemo(() => buildDemoWelcomePack({
    fixtureId,
    accessibilityOverrides: {
      prefersPrint: printFirst,
      includeTechnicalAppendix: technicalAppendix,
      profiles: toAccessibilityProfiles(dyslexia, adhd),
    },
  }), [
    fixtureId,
    printFirst,
    dyslexia,
    adhd,
    technicalAppendix,
  ]);

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
        </fieldset>
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

      <PrintableWelcomePackSkeleton viewModel={viewModel} />
    </main>
  );
}

export default WelcomePackDevPreview;

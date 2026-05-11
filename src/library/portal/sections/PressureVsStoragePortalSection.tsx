import { atlasMvpContentMapRegistry } from '../../content/atlasMvpContentMapRegistry';
import { PressureVsStorageDiagram } from '../../diagrams/PressureVsStorageDiagram';
import { PreviewIcon } from '../../packRenderer/visualPreview/PreviewIcon';
import './pressureVsStoragePortalSection.css';

const _con_c02 = atlasMvpContentMapRegistry.find((e) => e.id === 'CON_C02');

if (!_con_c02) {
  throw new Error('CON_C02 entry missing from atlasMvpContentMapRegistry');
}

// TypeScript does not narrow module-level variables through a throw guard when
// they are accessed inside a function body, so we extract the fields we need
// into typed string constants here at module scope.
const CON_C02_ONE_LINE_SUMMARY: string = _con_c02.oneLineSummary;
const CON_C02_WHAT_YOU_MAY_NOTICE: string = _con_c02.whatYouMayNotice;
const CON_C02_WHAT_NOT_TO_WORRY: string = _con_c02.whatNotToWorryAbout;
const CON_C02_MISCONCEPTION: string = _con_c02.misconception;
const CON_C02_REALITY: string = _con_c02.reality;

export interface PressureVsStoragePortalSectionProps {
  bathroomCount?: number;
}

export function PressureVsStoragePortalSection({
  bathroomCount = 2,
}: PressureVsStoragePortalSectionProps) {
  const yourHomeBody =
    bathroomCount >= 2
      ? `${bathroomCount} bathrooms create simultaneous demand. Stored hot water means both can draw from the same pressurised store without one waiting for the other.`
      : 'Stored hot water means multiple outlets can draw from the same pressurised store without one waiting for the other.';

  return (
    <section
      className="pvsp-section"
      aria-labelledby="pvsp-heading"
      data-testid="pvsp-section"
    >
      <h2 id="pvsp-heading" className="pvsp-title">
        Why stored hot water suits this home
      </h2>

      <p className="pvsp-summary">{CON_C02_ONE_LINE_SUMMARY}</p>

      <figure
        className="pvsp-diagram-panel"
        data-testid="pvsp-diagram-panel"
      >
        <PressureVsStorageDiagram />
      </figure>

      <div className="pvsp-comparison-grid" data-testid="pvsp-comparison-grid">
        <article className="pvsp-comparison-card" aria-label="Combination boiler">
          <div className="pvsp-comparison-card__icon-row">
            <PreviewIcon
              name="boiler"
              className="pvsp-comparison-card__icon"
              aria-hidden
            />
            <p className="pvsp-comparison-card__eyebrow">Combination boiler (combi)</p>
          </div>
          <h3 className="pvsp-comparison-card__title">
            Heats water on demand
          </h3>
          <p className="pvsp-comparison-card__body">
            On-demand hot water heated through a plate heat exchanger. Output is
            limited by heat exchanger capacity — only one outlet at a time runs
            well under simultaneous demand.
          </p>
        </article>

        <article className="pvsp-comparison-card" aria-label="Unvented cylinder">
          <div className="pvsp-comparison-card__icon-row">
            <PreviewIcon
              name="cylinder"
              className="pvsp-comparison-card__icon"
              aria-hidden
            />
            <p className="pvsp-comparison-card__eyebrow">Unvented cylinder</p>
          </div>
          <h3 className="pvsp-comparison-card__title">
            Stores hot water ready to use
          </h3>
          <p className="pvsp-comparison-card__body">
            Stored hot water supplied at mains pressure. Multiple outlets can run
            at the same time from the same pressurised store without a pump.
          </p>
        </article>

        <article
          className="pvsp-comparison-card pvsp-comparison-card--highlight"
          aria-label="Your home"
          data-testid="pvsp-your-home-card"
        >
          <div className="pvsp-comparison-card__icon-row">
            <PreviewIcon
              name="water-flow"
              className="pvsp-comparison-card__icon"
              aria-hidden
            />
            <p className="pvsp-comparison-card__eyebrow">Your home</p>
          </div>
          <h3 className="pvsp-comparison-card__title">
            {bathroomCount >= 2
              ? `${bathroomCount} bathrooms — overlap matters`
              : 'Overlap matters'}
          </h3>
          <p className="pvsp-comparison-card__body">{yourHomeBody}</p>
        </article>
      </div>

      <div className="pvsp-notice-grid" data-testid="pvsp-notice-grid">
        <div className="pvsp-notice-card" data-testid="pvsp-what-you-may-notice">
          <p className="pvsp-notice-card__label">What you may notice</p>
          <p className="pvsp-notice-card__body">{CON_C02_WHAT_YOU_MAY_NOTICE}</p>
        </div>

        <div className="pvsp-notice-card" data-testid="pvsp-what-not-to-worry">
          <p className="pvsp-notice-card__label">What not to worry about</p>
          <p className="pvsp-notice-card__body">{CON_C02_WHAT_NOT_TO_WORRY}</p>
        </div>
      </div>

      <div
        className="pvsp-misconception"
        data-testid="pvsp-misconception"
        aria-label="Common misconception"
      >
        <p className="pvsp-misconception__label">Common misconception</p>
        <p className="pvsp-misconception__text">{CON_C02_MISCONCEPTION}</p>
        <p className="pvsp-misconception__text pvsp-misconception__text--reality">
          Reality: {CON_C02_REALITY}
        </p>
      </div>

      <div className="pvsp-qr-placeholder" data-testid="pvsp-qr-placeholder">
        <PreviewIcon
          name="qr"
          className="pvsp-qr-placeholder__icon"
          aria-hidden
        />
        <div className="pvsp-qr-placeholder__text">
          <p className="pvsp-qr-placeholder__title">Go deeper</p>
          <p className="pvsp-qr-placeholder__note">
            Scan to explore pressure and storage in detail — diagram-guided
            walkthrough available.
          </p>
        </div>
      </div>
    </section>
  );
}

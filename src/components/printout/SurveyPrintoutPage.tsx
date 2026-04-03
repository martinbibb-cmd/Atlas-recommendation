/**
 * SurveyPrintoutPage.tsx
 *
 * Single A4 printout page — leaves the house with the customer.
 *
 * Content (based on the in-room presentation):
 *   - Atlas branding + visit date + postcode
 *   - Headline recommendation (top-ranked option)
 *   - What we know summary: house / home / system
 *   - Required work & key additions
 *   - Portal QR code with URL (so the customer can revisit the presentation)
 *
 * Print behaviour:
 *   - @media print hides screen chrome (toolbar)
 *   - Page is designed for A4 portrait (210mm × 297mm)
 *   - No interactive elements visible on print
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { EngineInputV2_3, FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { RecommendationState } from '../../features/survey/recommendation/recommendationTypes';
import { buildCanonicalPresentation } from '../presentation/buildCanonicalPresentation';
import type { PrioritiesState } from '../../features/survey/priorities/prioritiesTypes';
import './SurveyPrintoutPage.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: FullEngineResult;
  input: EngineInputV2_3;
  recommendationResult?: RecommendationResult;
  prioritiesState?: PrioritiesState;
  /** The surveyor's manually entered recommendation from the final step. */
  surveyorRecommendation?: RecommendationState;
  /** Portal URL to encode as a QR code. */
  portalUrl?: string;
  /** Customer name, if known. */
  customerName?: string;
  /** Visit date string. */
  visitDate?: string;
  /** Called when the user clicks Back (screen only). */
  onBack?: () => void;
}

// ─── QR code canvas ───────────────────────────────────────────────────────────

function QRCodeImage({ url }: { url: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!url || !imgRef.current) return;
    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: '#1a202c', light: '#ffffff' },
    }).then(dataUrl => {
      if (imgRef.current) imgRef.current.src = dataUrl;
    }).catch(() => {/* silently fail — QR is a convenience */});
  }, [url]);

  return (
    <img
      ref={imgRef}
      className="spp-qr__img"
      alt="Portal QR code"
      width={160}
      height={160}
    />
  );
}

// ─── Label helpers ────────────────────────────────────────────────────────────

function heatSourceLabel(hs: RecommendationState['heatSource']): string {
  const map: Record<NonNullable<typeof hs>, string> = {
    combi_boiler:      'Combi Boiler',
    system_boiler:     'System Boiler',
    regular_boiler:    'Regular Boiler',
    heat_pump_air:     'Air Source Heat Pump',
    heat_pump_ground:  'Ground Source Heat Pump',
    keep_existing:     'Keep Existing System',
  };
  return hs ? (map[hs] ?? hs) : '—';
}

function waterSourceLabel(ws: RecommendationState['waterSource']): string {
  const map: Record<NonNullable<typeof ws>, string> = {
    keep_existing:     'Keep Existing',
    unvented_cylinder: 'Unvented Cylinder',
    vented_cylinder:   'Vented Cylinder',
    mixergy_cylinder:  'Mixergy Cylinder',
    combi_plate_hex:   'Combi (Plate HEX)',
  };
  return ws ? (map[ws] ?? ws) : '—';
}

function powerflushLabel(pf: RecommendationState['powerflush']): string {
  const map: Record<NonNullable<typeof pf>, string> = {
    yes:           'Full Powerflush',
    chemical_only: 'Chemical Clean',
    no:            'Not Required',
    not_assessed:  'To be assessed',
  };
  return pf ? (map[pf] ?? pf) : '—';
}

function filterLabel(f: RecommendationState['filter']): string {
  const map: Record<NonNullable<typeof f>, string> = {
    magnetic_inline:    'Magnetic Inline Filter',
    magnetic_full_flow: 'Magnetic Full-Flow Filter',
    scale_reducer:      'Scale Reducer',
    keep_existing:      'Keep Existing Filter',
    none:               'No Filter',
  };
  return f ? (map[f] ?? f) : '—';
}

function additionsList(additions: RecommendationState['additions']): string[] {
  const items: string[] = [];
  if (additions.sealedSystemKit)      items.push('Sealed system kit');
  if (additions.smartControls)         items.push('Smart controls');
  if (additions.trvs)                  items.push('TRVs');
  if (additions.weatherCompensation)   items.push('Weather compensation');
  if (additions.replacementRadiators)  items.push('Replacement radiators');
  if (additions.mixergy)               items.push('Mixergy');
  return items;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurveyPrintoutPage({
  result,
  input,
  recommendationResult,
  prioritiesState,
  surveyorRecommendation,
  portalUrl,
  customerName,
  visitDate,
  onBack,
}: Props) {
  const model = buildCanonicalPresentation(result, input, recommendationResult, prioritiesState);
  const { page1, page3, page4Plus } = model;

  const topOption = page3.items[0];
  const topDetail = page4Plus.options[0] ?? null;

  const today = visitDate ?? new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const additions = surveyorRecommendation
    ? additionsList(surveyorRecommendation.additions)
    : [];

  return (
    <div className="spp-wrap">

      {/* ── Screen toolbar (hidden on print) ────────────────────────── */}
      <div className="spp-toolbar" aria-hidden="false">
        {onBack && (
          <button type="button" className="spp-toolbar__back" onClick={onBack}>
            ← Back
          </button>
        )}
        <span className="spp-toolbar__label">Survey Printout</span>
        <button
          type="button"
          className="spp-toolbar__print"
          onClick={() => window.print()}
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── A4 page content ─────────────────────────────────────────── */}
      <div className="spp-page">

        {/* ── Header row ─────────────────────────────────────── */}
        <header className="spp-header">
          <div className="spp-header__brand" aria-hidden="true"></div>
          <div className="spp-header__info">
            {customerName && <p className="spp-header__customer">{customerName}</p>}
            {input.postcode && <p className="spp-header__postcode">{input.postcode}</p>}
            <p className="spp-header__date">{today}</p>
          </div>
          <h1 className="spp-header__title">Heating Survey Summary</h1>
        </header>

        <div className="spp-body">

          {/* ── Left column ────────────────────────────────────── */}
          <div className="spp-col spp-col--main">

            {/* ── Recommendation block ───────────────────── */}
            {surveyorRecommendation && (
              <section className="spp-section spp-section--rec">
                <h2 className="spp-section__title">Recommendation</h2>
                <div className="spp-rec-grid">
                  <div className="spp-rec-row">
                    <span className="spp-rec-row__label">Heat source</span>
                    <span className="spp-rec-row__value">{heatSourceLabel(surveyorRecommendation.heatSource)}</span>
                  </div>
                  <div className="spp-rec-row">
                    <span className="spp-rec-row__label">Water source</span>
                    <span className="spp-rec-row__value">{waterSourceLabel(surveyorRecommendation.waterSource)}</span>
                  </div>
                  <div className="spp-rec-row">
                    <span className="spp-rec-row__label">Powerflush</span>
                    <span className="spp-rec-row__value">{powerflushLabel(surveyorRecommendation.powerflush)}</span>
                  </div>
                  <div className="spp-rec-row">
                    <span className="spp-rec-row__label">Filter</span>
                    <span className="spp-rec-row__value">{filterLabel(surveyorRecommendation.filter)}</span>
                  </div>
                  {additions.length > 0 && (
                    <div className="spp-rec-row spp-rec-row--full">
                      <span className="spp-rec-row__label">Additions</span>
                      <span className="spp-rec-row__value">{additions.join(' · ')}</span>
                    </div>
                  )}
                  {surveyorRecommendation.notes && (
                    <div className="spp-rec-row spp-rec-row--full spp-rec-row--notes">
                      <span className="spp-rec-row__label">Notes</span>
                      <span className="spp-rec-row__value">{surveyorRecommendation.notes}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Physics ranking summary ─────────────────── */}
            {!surveyorRecommendation && topOption && (
              <section className="spp-section spp-section--rec">
                <h2 className="spp-section__title">Best fit system</h2>
                <p className="spp-best-system">{topOption.label}</p>
                <p className="spp-best-reason">{topOption.reasonLine}</p>
              </section>
            )}

            {/* ── What we know ────────────────────────────── */}
            <section className="spp-section">
              <h2 className="spp-section__title">What we know about this home</h2>
              <div className="spp-fact-grid">
                <div className="spp-fact">
                  <span className="spp-fact__label">Heat loss</span>
                  <span className="spp-fact__value">{page1.house.heatLossLabel}</span>
                </div>
                <div className="spp-fact">
                  <span className="spp-fact__label">Band</span>
                  <span className="spp-fact__value">{page1.house.heatLossBand}</span>
                </div>
                <div className="spp-fact">
                  <span className="spp-fact__label">Walls</span>
                  <span className="spp-fact__value">{page1.house.wallTypeLabel}</span>
                </div>
                <div className="spp-fact">
                  <span className="spp-fact__label">Insulation</span>
                  <span className="spp-fact__value">{page1.house.insulationLabel}</span>
                </div>
                <div className="spp-fact">
                  <span className="spp-fact__label">Current system</span>
                  <span className="spp-fact__value">{page1.currentSystem.systemTypeLabel ?? '—'}</span>
                </div>
                <div className="spp-fact">
                  <span className="spp-fact__label">Occupants</span>
                  <span className="spp-fact__value">{page1.home.dailyHotWaterLabel}</span>
                </div>
                <div className="spp-fact spp-fact--wide">
                  <span className="spp-fact__label">Peak demand</span>
                  <span className="spp-fact__value">{page1.home.peakOutletsLabel}</span>
                </div>
              </div>
            </section>

            {/* ── Required work ───────────────────────────── */}
            {topDetail && topDetail.requiredWork.length > 0 && (
              <section className="spp-section">
                <h2 className="spp-section__title">Required work</h2>
                <ul className="spp-list">
                  {topDetail.requiredWork.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Best performance upgrades ────────────────── */}
            {topDetail && topDetail.bestPerformanceUpgrades.length > 0 && (
              <section className="spp-section">
                <h2 className="spp-section__title">To get the most from it</h2>
                <ul className="spp-list spp-list--positive">
                  {topDetail.bestPerformanceUpgrades.slice(0, 4).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

          </div>

          {/* ── Right column — QR code ─────────────────────────────── */}
          {portalUrl && (
            <aside className="spp-col spp-col--qr">
              <div className="spp-qr">
                <QRCodeImage url={portalUrl} />
                <p className="spp-qr__heading">Your portal</p>
                <p className="spp-qr__desc">
                  Scan to revisit your full recommendation, explore the simulator, and review the evidence behind this advice.
                </p>
                <p className="spp-qr__url">
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer">{portalUrl}</a>
                </p>
              </div>
            </aside>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="spp-footer">
          <p className="spp-footer__text">
            Our recommendation — for information only. All physics-based estimates. Exact specification subject to site survey confirmation.
          </p>
        </footer>

      </div>
    </div>
  );
}

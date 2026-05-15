/**
 * PortalPrimitives.tsx
 *
 * Shared portal layout primitives for the Atlas customer educational portal.
 *
 * Exports:
 *   PortalShell          — outer layout wrapper
 *   PortalHeroCard       — hero section at top of portal page
 *   EducationalInfoCard  — educational information card (calm blue/green)
 *   ComparisonTriptych   — side-by-side comparison (2–3 items)
 *   ReassurancePanel     — "what stays familiar" reassurance block
 *   WhatYouMayNoticePanel — paired notice/reassurance strips
 *   QRDeepDiveCard       — QR code deep-dive teaser
 *   SectionDivider       — visual section separator
 *   StickyBottomNav      — sticky bottom nav (mobile-first)
 *   PortalDiagramFrame   — diagram container with caption
 *   PortalMisconceptionBlock — misconception + reality block
 */

import type { ReactNode } from 'react';
import type { LivingExperiencePatternV1 } from '../../content/LivingExperiencePatternV1';
import './portalPrimitives.css';

// ─── PortalShell ─────────────────────────────────────────────────────────────

export interface PortalShellProps {
  children: ReactNode;
  className?: string;
  reducedMotion?: boolean;
}

export function PortalShell({ children, className = '', reducedMotion = false }: PortalShellProps) {
  return (
    <div
      className={`portal-shell${reducedMotion ? ' portal-shell--reduced-motion' : ''}${className ? ` ${className}` : ''}`}
      data-reduced-motion={reducedMotion || undefined}
    >
      {children}
    </div>
  );
}

// ─── PortalHeroCard ───────────────────────────────────────────────────────────

export interface PortalHeroCardProps {
  eyebrow?: string;
  heading: string;
  summary?: string;
  badge?: string;
  children?: ReactNode;
}

export function PortalHeroCard({ eyebrow, heading, summary, badge, children }: PortalHeroCardProps) {
  return (
    <section className="portal-hero-card" aria-label={heading} data-testid="portal-hero-card">
      {eyebrow ? <p className="portal-hero-card__eyebrow">{eyebrow}</p> : null}
      <h2 className="portal-hero-card__heading">{heading}</h2>
      {summary ? <p className="portal-hero-card__summary">{summary}</p> : null}
      {badge ? <p className="portal-hero-card__badge">{badge}</p> : null}
      {children}
    </section>
  );
}

// ─── EducationalInfoCard ──────────────────────────────────────────────────────

type InfoCardTone = 'default' | 'primary' | 'reassurance';
type HeadingLevel = 2 | 3 | 4;

export interface EducationalInfoCardProps {
  eyebrow?: string;
  heading: string;
  headingLevel?: HeadingLevel;
  body?: string;
  tone?: InfoCardTone;
  children?: ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
}

function renderInfoHeading(level: HeadingLevel, text: string) {
  if (level === 2) return <h2 className="portal-info-card__heading">{text}</h2>;
  if (level === 4) return <h4 className="portal-info-card__heading">{text}</h4>;
  return <h3 className="portal-info-card__heading">{text}</h3>;
}

export function EducationalInfoCard({
  eyebrow,
  heading,
  headingLevel = 3,
  body,
  tone = 'default',
  children,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: EducationalInfoCardProps) {
  const toneClass = tone !== 'default' ? ` portal-info-card--${tone}` : '';
  return (
    <article
      className={`portal-info-card${toneClass}`}
      aria-label={ariaLabel ?? heading}
      data-testid={testId ?? 'portal-info-card'}
    >
      {eyebrow ? <p className="portal-info-card__eyebrow">{eyebrow}</p> : null}
      {renderInfoHeading(headingLevel, heading)}
      {body ? <p className="portal-info-card__body">{body}</p> : null}
      {children}
    </article>
  );
}

// ─── ComparisonTriptych ───────────────────────────────────────────────────────

export interface ComparisonCard {
  eyebrow?: string;
  heading: string;
  body: string;
  icon?: ReactNode;
  highlight?: boolean;
  ariaLabel?: string;
  testId?: string;
}

export interface ComparisonTriptychProps {
  cards: ComparisonCard[];
}

export function ComparisonTriptych({ cards }: ComparisonTriptychProps) {
  return (
    <div className="portal-comparison-triptych" data-testid="portal-comparison-triptych">
      {cards.map((card, i) => (
        <article
          key={`${card.heading}-${i}`}
          className={`portal-comparison-triptych__card${card.highlight ? ' portal-comparison-triptych__card--highlight' : ''}`}
          aria-label={card.ariaLabel ?? card.heading}
          data-testid={card.testId}
        >
          {(card.icon || card.eyebrow) ? (
            <div className="portal-comparison-triptych__icon-row">
              {card.icon ? (
                <span className="portal-comparison-triptych__icon" aria-hidden="true">
                  {card.icon}
                </span>
              ) : null}
              {card.eyebrow ? (
                <p className="portal-comparison-triptych__eyebrow">{card.eyebrow}</p>
              ) : null}
            </div>
          ) : null}
          <h3 className="portal-comparison-triptych__heading">{card.heading}</h3>
          <p className="portal-comparison-triptych__body">{card.body}</p>
        </article>
      ))}
    </div>
  );
}

// ─── ReassurancePanel ─────────────────────────────────────────────────────────

export interface ReassurancePanelProps {
  eyebrow?: string;
  heading: string;
  body?: string;
  items?: string[];
  children?: ReactNode;
  'data-testid'?: string;
}

export function ReassurancePanel({
  eyebrow = 'What stays familiar',
  heading,
  body,
  items,
  children,
  'data-testid': testId,
}: ReassurancePanelProps) {
  return (
    <aside
      className="portal-reassurance-panel"
      aria-label={heading}
      data-testid={testId ?? 'portal-reassurance-panel'}
    >
      <p className="portal-reassurance-panel__eyebrow">{eyebrow}</p>
      <h3 className="portal-reassurance-panel__heading">{heading}</h3>
      {body ? <p className="portal-reassurance-panel__body">{body}</p> : null}
      {items && items.length > 0 ? (
        <ul className="portal-reassurance-panel__list">
          {items.map((item, i) => (
            <li key={i} className="portal-reassurance-panel__list-item">{item}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </aside>
  );
}

// ─── WhatYouMayNoticePanel ────────────────────────────────────────────────────

export interface NoticeBlock {
  label: string;
  body: string;
  testId?: string;
}

export interface WhatYouMayNoticePanelProps {
  blocks: NoticeBlock[];
}

export function WhatYouMayNoticePanel({ blocks }: WhatYouMayNoticePanelProps) {
  return (
    <div className="portal-what-you-may-notice" data-testid="portal-what-you-may-notice">
      {blocks.map((block, i) => (
        <div
          key={`${block.label}-${i}`}
          className="portal-what-you-may-notice__block"
          data-testid={block.testId}
        >
          <p className="portal-what-you-may-notice__label">{block.label}</p>
          <p className="portal-what-you-may-notice__body">{block.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── LivingExperienceCard ───────────────────────────────────────────────────────

export interface LivingExperienceCardProps {
  heading: string;
  pattern: LivingExperiencePatternV1;
  summary?: string;
  'data-testid'?: string;
}

export function LivingExperienceCard({
  heading,
  pattern,
  summary,
  'data-testid': testId,
}: LivingExperienceCardProps) {
  return (
    <article
      className="portal-living-experience-card"
      aria-label={heading}
      data-testid={testId ?? 'portal-living-experience-card'}
    >
      <h3 className="portal-living-experience-card__heading">{heading}</h3>
      <p className="portal-living-experience-card__summary">{summary ?? pattern.whatYouMayNotice}</p>

      <details className="portal-living-experience-card__details">
        <summary className="portal-living-experience-card__toggle">Show more</summary>
        <div className="portal-living-experience-card__body">
          <p><strong>What you may notice:</strong> {pattern.whatYouMayNotice}</p>
          <p><strong>What this means:</strong> {pattern.whatThisMeans}</p>
          {pattern.whatStaysFamiliar ? <p><strong>What stays familiar:</strong> {pattern.whatStaysFamiliar}</p> : null}
          {pattern.whatChanges ? <p><strong>What changes:</strong> {pattern.whatChanges}</p> : null}
          {pattern.reassurance ? <p><strong>Reassurance:</strong> {pattern.reassurance}</p> : null}
          {pattern.commonMisunderstanding ? <p><strong>Common misunderstanding:</strong> {pattern.commonMisunderstanding}</p> : null}
          {pattern.dailyLifeEffect ? <p><strong>Daily-life effect:</strong> {pattern.dailyLifeEffect}</p> : null}
          {pattern.optionalTechnicalDetail ? <p><strong>Optional technical detail:</strong> {pattern.optionalTechnicalDetail}</p> : null}
          {pattern.analogyOptions.length > 0 ? (
            <ul className="portal-living-experience-card__analogy-list">
              {pattern.analogyOptions.map((option) => (
                <li key={option.title}>
                  <strong>{option.title}:</strong> {option.explanation}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="portal-living-experience-card__print-summary">
            <strong>Print summary:</strong> {pattern.printSummary}
          </p>
        </div>
      </details>
    </article>
  );
}

// ─── QRDeepDiveCard ───────────────────────────────────────────────────────────

export interface QRDestination {
  title: string;
  assetId?: string;
}

export interface QRDeepDiveCardProps {
  heading?: string;
  note?: string;
  icon?: ReactNode;
  destinations?: QRDestination[];
  'data-testid'?: string;
}

export function QRDeepDiveCard({
  heading = 'Go deeper',
  note,
  icon,
  destinations,
  'data-testid': testId,
}: QRDeepDiveCardProps) {
  return (
    <div className="portal-qr-deepdive" data-testid={testId ?? 'portal-qr-deepdive'}>
      {icon ? (
        <span className="portal-qr-deepdive__icon" aria-hidden="true">{icon}</span>
      ) : null}
      <div className="portal-qr-deepdive__text">
        <p className="portal-qr-deepdive__heading">{heading}</p>
        {note ? <p className="portal-qr-deepdive__note">{note}</p> : null}
        {destinations && destinations.length > 0 ? (
          <ul className="portal-qr-deepdive__destinations">
            {destinations.map((dest, i) => (
              <li key={dest.assetId ?? i}>{dest.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// ─── SectionDivider ───────────────────────────────────────────────────────────

export interface SectionDividerProps {
  label?: string;
  'data-testid'?: string;
}

export function SectionDivider({ label, 'data-testid': testId }: SectionDividerProps) {
  if (!label) {
    return (
      <hr
        className="portal-section-divider portal-section-divider--no-label"
        aria-hidden="true"
        data-testid={testId ?? 'portal-section-divider'}
      />
    );
  }
  return (
    <div
      className="portal-section-divider"
      role="separator"
      aria-label={label}
      data-testid={testId ?? 'portal-section-divider'}
    >
      {label}
    </div>
  );
}

// ─── StickyBottomNav ──────────────────────────────────────────────────────────

export interface StickyBottomNavAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface StickyBottomNavProps {
  label?: string;
  actions: StickyBottomNavAction[];
  'data-testid'?: string;
}

export function StickyBottomNav({ label, actions, 'data-testid': testId }: StickyBottomNavProps) {
  return (
    <nav
      className="portal-sticky-bottom-nav"
      aria-label="Page navigation"
      data-testid={testId ?? 'portal-sticky-bottom-nav'}
    >
      {label ? <p className="portal-sticky-bottom-nav__label">{label}</p> : null}
      <div className="portal-sticky-bottom-nav__actions">
        {actions.map((action, i) => (
          <button
            key={`${action.label}-${i}`}
            type="button"
            className={`portal-sticky-bottom-nav__btn${action.variant === 'secondary' ? ' portal-sticky-bottom-nav__btn--secondary' : ''}`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── PortalDiagramFrame ───────────────────────────────────────────────────────

export interface PortalDiagramFrameProps {
  caption?: string;
  children: ReactNode;
  'data-testid'?: string;
}

export function PortalDiagramFrame({
  caption,
  children,
  'data-testid': testId,
}: PortalDiagramFrameProps) {
  return (
    <figure
      className="portal-diagram-frame"
      data-testid={testId ?? 'portal-diagram-frame'}
    >
      {children}
      {caption ? (
        <figcaption className="portal-diagram-frame__caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

// ─── PortalMisconceptionBlock ─────────────────────────────────────────────────

export interface PortalMisconceptionBlockProps {
  label?: string;
  misconception: string;
  reality: string;
  'data-testid'?: string;
}

export function PortalMisconceptionBlock({
  label = 'Common misconception',
  misconception,
  reality,
  'data-testid': testId,
}: PortalMisconceptionBlockProps) {
  return (
    <div
      className="portal-misconception-block"
      aria-label={label}
      data-testid={testId ?? 'portal-misconception-block'}
    >
      <p className="portal-misconception-block__label">{label}</p>
      <p className="portal-misconception-block__text">{misconception}</p>
      <p className="portal-misconception-block__text portal-misconception-block__reality">
        Reality: {reality}
      </p>
    </div>
  );
}

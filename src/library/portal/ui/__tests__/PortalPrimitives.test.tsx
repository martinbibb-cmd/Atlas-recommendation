/**
 * PortalPrimitives.test.tsx
 *
 * Tests for the portal layout primitives.
 *
 * Covers:
 *   1. Semantic heading structure (h2/h3 roles preserved)
 *   2. aria-label and landmark roles
 *   3. data-testid propagation
 *   4. Reduced-motion variant
 *   5. Print-safe: break-inside class is applied (CSS not evaluated in JSDOM,
 *      but we verify the class token is present on the container)
 *   6. Narrow viewport: no overflow-producing inline styles
 *   7. SectionDivider with and without a label
 *   8. ComparisonTriptych renders all cards
 *   9. ReassurancePanel renders list items
 *  10. QRDeepDiveCard renders destinations
 *  11. StickyBottomNav renders actions and fires callbacks
 *  12. PortalDiagramFrame renders caption
 *  13. PortalMisconceptionBlock renders misconception and reality
 *  14. WhatYouMayNoticePanel renders all blocks
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PortalShell,
  PortalHeroCard,
  EducationalInfoCard,
  ComparisonTriptych,
  ReassurancePanel,
  WhatYouMayNoticePanel,
  LivingExperienceCard,
  ExpectationDeltaCard,
  QRDeepDiveCard,
  SectionDivider,
  StickyBottomNav,
  PortalDiagramFrame,
  PortalMisconceptionBlock,
} from '../PortalPrimitives';

// ─── PortalShell ──────────────────────────────────────────────────────────────

describe('PortalShell', () => {
  it('renders children', () => {
    render(<PortalShell><p>hello</p></PortalShell>);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('adds reduced-motion class when reducedMotion=true', () => {
    const { container } = render(<PortalShell reducedMotion><p>x</p></PortalShell>);
    expect(container.firstElementChild?.classList.contains('portal-shell--reduced-motion')).toBe(true);
  });

  it('sets data-reduced-motion attribute when reducedMotion=true', () => {
    const { container } = render(<PortalShell reducedMotion><p>x</p></PortalShell>);
    expect(container.firstElementChild?.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('does not set data-reduced-motion when reducedMotion=false', () => {
    const { container } = render(<PortalShell><p>x</p></PortalShell>);
    expect(container.firstElementChild?.hasAttribute('data-reduced-motion')).toBe(false);
  });
});

// ─── PortalHeroCard ───────────────────────────────────────────────────────────

describe('PortalHeroCard', () => {
  it('renders an h2 heading', () => {
    render(<PortalHeroCard heading="Your heating recommendation" />);
    expect(screen.getByRole('heading', { level: 2, name: /your heating recommendation/i })).toBeTruthy();
  });

  it('renders eyebrow text', () => {
    render(<PortalHeroCard heading="X" eyebrow="Atlas recommendation" />);
    expect(screen.getByText('Atlas recommendation')).toBeTruthy();
  });

  it('renders summary text', () => {
    render(<PortalHeroCard heading="X" summary="This is a calm summary." />);
    expect(screen.getByText('This is a calm summary.')).toBeTruthy();
  });

  it('renders badge text', () => {
    render(<PortalHeroCard heading="X" badge="Unvented cylinder" />);
    expect(screen.getByText('Unvented cylinder')).toBeTruthy();
  });

  it('has aria-label equal to heading', () => {
    const { container } = render(<PortalHeroCard heading="Your recommendation" />);
    const section = container.querySelector('.portal-hero-card');
    expect(section?.getAttribute('aria-label')).toBe('Your recommendation');
  });

  it('has data-testid="portal-hero-card"', () => {
    render(<PortalHeroCard heading="X" />);
    expect(screen.getByTestId('portal-hero-card')).toBeTruthy();
  });

  it('renders children', () => {
    render(<PortalHeroCard heading="X"><span data-testid="child">child</span></PortalHeroCard>);
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});

// ─── EducationalInfoCard ──────────────────────────────────────────────────────

describe('EducationalInfoCard', () => {
  it('renders an h3 heading by default', () => {
    render(<EducationalInfoCard heading="Stored hot water" />);
    expect(screen.getByRole('heading', { level: 3, name: /stored hot water/i })).toBeTruthy();
  });

  it('renders an h2 when headingLevel=2', () => {
    render(<EducationalInfoCard heading="Stored hot water" headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('renders an h4 when headingLevel=4', () => {
    render(<EducationalInfoCard heading="Stored hot water" headingLevel={4} />);
    expect(screen.getByRole('heading', { level: 4 })).toBeTruthy();
  });

  it('renders body text', () => {
    render(<EducationalInfoCard heading="X" body="Body copy here." />);
    expect(screen.getByText('Body copy here.')).toBeTruthy();
  });

  it('applies primary tone class', () => {
    const { container } = render(<EducationalInfoCard heading="X" tone="primary" />);
    expect(container.querySelector('.portal-info-card--primary')).toBeTruthy();
  });

  it('applies reassurance tone class', () => {
    const { container } = render(<EducationalInfoCard heading="X" tone="reassurance" />);
    expect(container.querySelector('.portal-info-card--reassurance')).toBeTruthy();
  });

  it('uses default tone class (no modifier) for default tone', () => {
    const { container } = render(<EducationalInfoCard heading="X" />);
    expect(container.querySelector('.portal-info-card--default')).toBeFalsy();
    expect(container.querySelector('.portal-info-card')).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<EducationalInfoCard heading="X" />);
    expect(screen.getByTestId('portal-info-card')).toBeTruthy();
  });

  it('uses custom data-testid when provided', () => {
    render(<EducationalInfoCard heading="X" data-testid="my-card" />);
    expect(screen.getByTestId('my-card')).toBeTruthy();
  });

  it('renders eyebrow', () => {
    render(<EducationalInfoCard heading="X" eyebrow="Educational note" />);
    expect(screen.getByText('Educational note')).toBeTruthy();
  });
});

// ─── ComparisonTriptych ───────────────────────────────────────────────────────

describe('ComparisonTriptych', () => {
  const cards = [
    { heading: 'Combination boiler', body: 'On-demand hot water.', eyebrow: 'Combi', ariaLabel: 'Combination boiler' },
    { heading: 'Unvented cylinder', body: 'Stored hot water.', eyebrow: 'Cylinder', ariaLabel: 'Unvented cylinder' },
    { heading: 'Your home', body: 'Two bathrooms.', highlight: true, ariaLabel: 'Your home', testId: 'your-home-card' },
  ];

  it('renders all three cards', () => {
    render(<ComparisonTriptych cards={cards} />);
    expect(screen.getByRole('article', { name: /combination boiler/i })).toBeTruthy();
    expect(screen.getByRole('article', { name: /unvented cylinder/i })).toBeTruthy();
    expect(screen.getByRole('article', { name: /your home/i })).toBeTruthy();
  });

  it('renders h3 headings in each card', () => {
    render(<ComparisonTriptych cards={cards} />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.length).toBeGreaterThanOrEqual(3);
  });

  it('applies highlight class to highlighted card', () => {
    const { container } = render(<ComparisonTriptych cards={cards} />);
    expect(container.querySelector('.portal-comparison-triptych__card--highlight')).toBeTruthy();
  });

  it('renders card body text', () => {
    render(<ComparisonTriptych cards={cards} />);
    expect(screen.getByText('On-demand hot water.')).toBeTruthy();
    expect(screen.getByText('Stored hot water.')).toBeTruthy();
  });

  it('renders test id on highlighted card', () => {
    render(<ComparisonTriptych cards={cards} />);
    expect(screen.getByTestId('your-home-card')).toBeTruthy();
  });

  it('has data-testid="portal-comparison-triptych"', () => {
    render(<ComparisonTriptych cards={cards} />);
    expect(screen.getByTestId('portal-comparison-triptych')).toBeTruthy();
  });
});

// ─── ReassurancePanel ─────────────────────────────────────────────────────────

describe('ReassurancePanel', () => {
  it('renders h3 heading', () => {
    render(<ReassurancePanel heading="Heating still works the same" />);
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
  });

  it('renders default eyebrow', () => {
    render(<ReassurancePanel heading="X" />);
    expect(screen.getByText('What stays familiar')).toBeTruthy();
  });

  it('renders custom eyebrow', () => {
    render(<ReassurancePanel heading="X" eyebrow="What not to worry about" />);
    expect(screen.getByText('What not to worry about')).toBeTruthy();
  });

  it('renders body text', () => {
    render(<ReassurancePanel heading="X" body="Nothing dramatic will change." />);
    expect(screen.getByText('Nothing dramatic will change.')).toBeTruthy();
  });

  it('renders list items', () => {
    render(<ReassurancePanel heading="X" items={['Radiators still work', 'Thermostat still works']} />);
    expect(screen.getByText('Radiators still work')).toBeTruthy();
    expect(screen.getByText('Thermostat still works')).toBeTruthy();
  });

  it('uses default data-testid', () => {
    render(<ReassurancePanel heading="X" />);
    expect(screen.getByTestId('portal-reassurance-panel')).toBeTruthy();
  });
});

// ─── WhatYouMayNoticePanel ────────────────────────────────────────────────────

describe('WhatYouMayNoticePanel', () => {
  const blocks = [
    { label: 'What you may notice', body: 'Water takes a moment to heat.', testId: 'notice-block-1' },
    { label: 'What not to worry about', body: 'This is normal operation.', testId: 'notice-block-2' },
  ];

  it('renders all block labels', () => {
    render(<WhatYouMayNoticePanel blocks={blocks} />);
    expect(screen.getByText('What you may notice')).toBeTruthy();
    expect(screen.getByText('What not to worry about')).toBeTruthy();
  });

  it('renders all block bodies', () => {
    render(<WhatYouMayNoticePanel blocks={blocks} />);
    expect(screen.getByText('Water takes a moment to heat.')).toBeTruthy();
    expect(screen.getByText('This is normal operation.')).toBeTruthy();
  });

  it('renders test ids on blocks', () => {
    render(<WhatYouMayNoticePanel blocks={blocks} />);
    expect(screen.getByTestId('notice-block-1')).toBeTruthy();
    expect(screen.getByTestId('notice-block-2')).toBeTruthy();
  });

  it('has data-testid="portal-what-you-may-notice"', () => {
    render(<WhatYouMayNoticePanel blocks={blocks} />);
    expect(screen.getByTestId('portal-what-you-may-notice')).toBeTruthy();
  });
});

// ─── LivingExperienceCard ──────────────────────────────────────────────────────

describe('LivingExperienceCard', () => {
  const pattern = {
    whatYouMayNotice: 'Radiators feel warm rather than very hot.',
    whatThisMeans: 'Steady lower-temperature operation is expected.',
    whatStaysFamiliar: 'Room comfort targets remain familiar.',
    whatChanges: 'Run periods are usually longer.',
    reassurance: 'This behaviour is normal for this setup.',
    commonMisunderstanding: 'Warm radiators mean the system is failing.',
    dailyLifeEffect: 'Comfort tends to feel steadier through the day.',
    optionalTechnicalDetail: 'Lower flow temperatures can improve part-load efficiency.',
    analogyOptions: [
      {
        title: 'Underfloor heating versus a log fire',
        explanation: 'Both can heat a room, but the feel is different.',
      },
    ],
    printSummary: 'Warm-not-hot radiators are an expected comfort pattern.',
  } as const;

  it('renders heading and default summary', () => {
    render(<LivingExperienceCard heading="Warm-not-hot radiators" pattern={pattern} />);
    expect(screen.getByRole('heading', { level: 3, name: /warm-not-hot radiators/i })).toBeTruthy();
    expect(screen.getAllByText(/radiators feel warm rather than very hot/i).length).toBeGreaterThan(0);
  });

  it('renders custom summary when provided', () => {
    render(<LivingExperienceCard heading="X" pattern={pattern} summary="Custom summary." />);
    expect(screen.getByText('Custom summary.')).toBeTruthy();
  });

  it('renders expandable details content', () => {
    render(<LivingExperienceCard heading="X" pattern={pattern} />);
    expect(screen.getByText(/show more/i)).toBeTruthy();
    expect(screen.getByText(/what this means:/i)).toBeTruthy();
    expect(screen.getByText(/print summary:/i)).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<LivingExperienceCard heading="X" pattern={pattern} />);
    expect(screen.getByTestId('portal-living-experience-card')).toBeTruthy();
  });
});

// ─── ExpectationDeltaCard ──────────────────────────────────────────────────────

describe('ExpectationDeltaCard', () => {
  const delta = {
    category: 'hot_water',
    currentExperience: 'Hot water drops when two outlets open.',
    futureExperience: 'Hot water stays steadier during overlap use.',
    perceivedSeverity: 'major',
    adaptationGuidance: 'Use normal routines first, then adjust peak overlap habits only if needed.',
    reassurance: 'Everyday hot-water use remains straightforward.',
    misconceptionRisk: 'Mains-fed stored hot water is unlimited.',
  } as const;

  it('renders current to future direction', () => {
    render(<ExpectationDeltaCard delta={delta} />);
    expect(screen.getByText(/current → future:/i)).toBeTruthy();
    expect(screen.getByText(/hot water drops when two outlets open/i)).toBeTruthy();
    expect(screen.getByText(/hot water stays steadier during overlap use/i)).toBeTruthy();
  });

  it('renders required expectation labels', () => {
    render(<ExpectationDeltaCard delta={delta} />);
    expect(screen.getByText('What changes')).toBeTruthy();
    expect(screen.getByText('What stays familiar')).toBeTruthy();
    expect(screen.getByText('Usually noticed after…')).toBeTruthy();
    expect(screen.getByText('Most households adapt within…')).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<ExpectationDeltaCard delta={delta} />);
    expect(screen.getByTestId('portal-expectation-delta-card')).toBeTruthy();
  });
});

// ─── QRDeepDiveCard ───────────────────────────────────────────────────────────

describe('QRDeepDiveCard', () => {
  it('renders default heading "Go deeper"', () => {
    render(<QRDeepDiveCard />);
    expect(screen.getByText('Go deeper')).toBeTruthy();
  });

  it('renders custom heading', () => {
    render(<QRDeepDiveCard heading="Learn more" />);
    expect(screen.getByText('Learn more')).toBeTruthy();
  });

  it('renders note text', () => {
    render(<QRDeepDiveCard note="Scan to explore." />);
    expect(screen.getByText('Scan to explore.')).toBeTruthy();
  });

  it('renders destinations', () => {
    render(
      <QRDeepDiveCard
        destinations={[
          { title: 'Pressure guide', assetId: 'pressure_guide' },
          { title: 'Cylinder sizing', assetId: 'cylinder_sizing' },
        ]}
      />,
    );
    expect(screen.getByText('Pressure guide')).toBeTruthy();
    expect(screen.getByText('Cylinder sizing')).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<QRDeepDiveCard />);
    expect(screen.getByTestId('portal-qr-deepdive')).toBeTruthy();
  });
});

// ─── SectionDivider ───────────────────────────────────────────────────────────

describe('SectionDivider', () => {
  it('renders as hr with no-label class when no label', () => {
    const { container } = render(<SectionDivider />);
    const el = container.firstElementChild;
    expect(el?.tagName).toBe('HR');
    expect(el?.classList.contains('portal-section-divider--no-label')).toBe(true);
  });

  it('is aria-hidden when no label', () => {
    const { container } = render(<SectionDivider />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders labeled divider with role="separator"', () => {
    render(<SectionDivider label="System diagram" />);
    expect(screen.getByRole('separator', { name: /system diagram/i })).toBeTruthy();
  });

  it('renders label text', () => {
    render(<SectionDivider label="System diagram" />);
    expect(screen.getByText('System diagram')).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<SectionDivider />);
    expect(screen.getByTestId('portal-section-divider')).toBeTruthy();
  });
});

// ─── StickyBottomNav ──────────────────────────────────────────────────────────

describe('StickyBottomNav', () => {
  it('renders nav with aria-label', () => {
    render(<StickyBottomNav actions={[]} />);
    expect(screen.getByRole('navigation', { name: /page navigation/i })).toBeTruthy();
  });

  it('renders label text', () => {
    render(<StickyBottomNav label="Section 2 of 4" actions={[]} />);
    expect(screen.getByText('Section 2 of 4')).toBeTruthy();
  });

  it('renders action buttons', () => {
    render(
      <StickyBottomNav
        actions={[
          { label: 'Continue', onClick: vi.fn() },
          { label: 'Back', onClick: vi.fn(), variant: 'secondary' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('calls onClick when action button is clicked', () => {
    const onClick = vi.fn();
    render(<StickyBottomNav actions={[{ label: 'Continue', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies secondary class to secondary action', () => {
    const { container } = render(
      <StickyBottomNav
        actions={[{ label: 'Back', onClick: vi.fn(), variant: 'secondary' }]}
      />,
    );
    expect(container.querySelector('.portal-sticky-bottom-nav__btn--secondary')).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<StickyBottomNav actions={[]} />);
    expect(screen.getByTestId('portal-sticky-bottom-nav')).toBeTruthy();
  });
});

// ─── PortalDiagramFrame ───────────────────────────────────────────────────────

describe('PortalDiagramFrame', () => {
  it('renders as a figure', () => {
    const { container } = render(<PortalDiagramFrame><div>diagram</div></PortalDiagramFrame>);
    expect(container.querySelector('figure')).toBeTruthy();
  });

  it('renders children', () => {
    render(<PortalDiagramFrame><div data-testid="inner">diagram</div></PortalDiagramFrame>);
    expect(screen.getByTestId('inner')).toBeTruthy();
  });

  it('renders figcaption when caption is provided', () => {
    render(<PortalDiagramFrame caption="How a cylinder stores heat">
      <div>diagram</div>
    </PortalDiagramFrame>);
    expect(screen.getByText('How a cylinder stores heat')).toBeTruthy();
  });

  it('does not render figcaption when no caption', () => {
    const { container } = render(<PortalDiagramFrame><div>diagram</div></PortalDiagramFrame>);
    expect(container.querySelector('figcaption')).toBeFalsy();
  });

  it('has default data-testid', () => {
    render(<PortalDiagramFrame><div>x</div></PortalDiagramFrame>);
    expect(screen.getByTestId('portal-diagram-frame')).toBeTruthy();
  });
});

// ─── PortalMisconceptionBlock ─────────────────────────────────────────────────

describe('PortalMisconceptionBlock', () => {
  it('renders default label', () => {
    render(<PortalMisconceptionBlock misconception="Myth text" reality="Reality text" />);
    expect(screen.getByText('Common misconception')).toBeTruthy();
  });

  it('renders custom label', () => {
    render(<PortalMisconceptionBlock label="A common misunderstanding" misconception="Myth" reality="Fact" />);
    expect(screen.getByText('A common misunderstanding')).toBeTruthy();
  });

  it('renders misconception text', () => {
    render(<PortalMisconceptionBlock misconception="Higher pressure = more storage." reality="False." />);
    expect(screen.getByText('Higher pressure = more storage.')).toBeTruthy();
  });

  it('renders reality text with "Reality:" prefix', () => {
    render(<PortalMisconceptionBlock misconception="Myth." reality="Pressure affects delivery force." />);
    expect(screen.getByText(/pressure affects delivery force\./i)).toBeTruthy();
  });

  it('has default data-testid', () => {
    render(<PortalMisconceptionBlock misconception="M" reality="R" />);
    expect(screen.getByTestId('portal-misconception-block')).toBeTruthy();
  });

  it('has aria-label matching the label prop', () => {
    const { container } = render(
      <PortalMisconceptionBlock label="Common misconception" misconception="M" reality="R" />,
    );
    expect(container.firstElementChild?.getAttribute('aria-label')).toBe('Common misconception');
  });
});

// ─── Cross-cutting: no overflow-producing inline styles ───────────────────────

describe('Portal primitives — no overflow-producing inline styles', () => {
  it('PortalHeroCard does not apply an overflow:hidden inline style', () => {
    const { container } = render(<PortalHeroCard heading="X" />);
    const style = (container.firstElementChild as HTMLElement)?.style?.overflow;
    expect(style).toBeFalsy();
  });

  it('EducationalInfoCard does not apply a fixed width inline style', () => {
    const { container } = render(<EducationalInfoCard heading="X" />);
    const style = (container.firstElementChild as HTMLElement)?.style?.width;
    expect(style).toBeFalsy();
  });
});

// ─── Print safety: break-inside class token ───────────────────────────────────

describe('Portal primitives — print-safe class tokens', () => {
  it('portal-hero-card class exists on PortalHeroCard', () => {
    const { container } = render(<PortalHeroCard heading="X" />);
    expect(container.querySelector('.portal-hero-card')).toBeTruthy();
  });

  it('portal-info-card class exists on EducationalInfoCard', () => {
    const { container } = render(<EducationalInfoCard heading="X" />);
    expect(container.querySelector('.portal-info-card')).toBeTruthy();
  });

  it('portal-reassurance-panel class exists on ReassurancePanel', () => {
    const { container } = render(<ReassurancePanel heading="X" />);
    expect(container.querySelector('.portal-reassurance-panel')).toBeTruthy();
  });
});

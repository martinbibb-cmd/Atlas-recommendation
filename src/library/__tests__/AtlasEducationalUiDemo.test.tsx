import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AtlasEducationalUiDemo } from '../ui/demo';
import { getAtlasEducationalUiDemoParagraphs } from '../ui/demo/atlasEducationalUiDemoContent';
import {
  EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS,
  EDUCATIONAL_MAX_PARAGRAPH_SENTENCES,
} from '../ui/tokens';

const educationalUiCss = readFileSync(
  `${process.cwd()}/src/library/ui/educationalUi.css`,
  'utf8',
);

function countSentences(value: string) {
  return (value.match(/[.!?](?=\s|$)/g) ?? []).length;
}

describe('AtlasEducationalUiDemo', () => {
  it('renders semantic headings for the showcase, sections, and cards', () => {
    render(<AtlasEducationalUiDemo />);

    expect(screen.getByRole('heading', { level: 2, name: 'Educational UI primitive showcase' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Analogy examples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Misconception examples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Safety examples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Print examples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Trust-recovery examples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Stored hot water as a prepared flask' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Pressure relief outlet dripping after warm-up' })).toBeInTheDocument();
  });

  it('supports explicit reduced-motion and print-safe hooks', () => {
    render(<AtlasEducationalUiDemo motionMode="off" />);

    const showcase = screen.getByLabelText('Educational UI primitive showcase');
    expect(showcase).toHaveAttribute('data-motion', 'off');
    expect(screen.getByLabelText('Print-safe example panel')).toHaveAttribute('data-print-safe', 'true');
    expect(educationalUiCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(educationalUiCss).toContain(".atlas-edu-demo [data-motion='off'] *");
    expect(educationalUiCss).toContain('@media print');
    expect(educationalUiCss).toContain('.atlas-edu-print-safe');
  });

  it('does not rely on colour alone to communicate meaning', () => {
    render(<AtlasEducationalUiDemo />);

    expect(screen.getAllByText('Safety note').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Common misconception').length).toBeGreaterThan(0);
    expect(screen.getAllByText('What you may notice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trust recovery').length).toBeGreaterThan(0);
  });

  it('keeps showcase paragraphs within the typography limits', () => {
    for (const paragraph of getAtlasEducationalUiDemoParagraphs()) {
      expect(paragraph.length).toBeLessThanOrEqual(EDUCATIONAL_MAX_PARAGRAPH_CHARACTERS);
      expect(countSentences(paragraph)).toBeLessThanOrEqual(EDUCATIONAL_MAX_PARAGRAPH_SENTENCES);
    }
  });

  it('exposes aria labels on key educational regions', () => {
    render(<AtlasEducationalUiDemo />);

    expect(screen.getByLabelText('Analogy example card')).toBeInTheDocument();
    expect(screen.getByLabelText('Analogy boundaries')).toBeInTheDocument();
    expect(screen.getByLabelText('System fact example card')).toBeInTheDocument();
    expect(screen.getByLabelText('Printable action sequence')).toBeInTheDocument();
    expect(screen.getByLabelText('Trust recovery example card')).toBeInTheDocument();
  });
});

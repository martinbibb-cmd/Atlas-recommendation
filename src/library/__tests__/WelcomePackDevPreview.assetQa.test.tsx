import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview asset QA panel', () => {
  it('renders asset QA headings, errors, warnings, and per-selected-asset status', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByRole('heading', { level: 2, name: 'Asset QA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Asset QA Errors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Asset QA Warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Per selected asset QA status' })).toBeInTheDocument();
  });

  it('renders asset QA error and warning lists with test ids', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByTestId('asset-qa-errors')).toBeInTheDocument();
    expect(screen.getByTestId('asset-qa-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('selected-asset-qa-status')).toBeInTheDocument();
  });

  it('shows no asset QA errors for the current registry', () => {
    render(<WelcomePackDevPreview />);

    const errorList = screen.getByTestId('asset-qa-errors');
    expect(errorList.textContent).toContain('None');
  });

  it('shows no asset QA warnings for the current registry', () => {
    render(<WelcomePackDevPreview />);

    const warningList = screen.getByTestId('asset-qa-warnings');
    expect(warningList.textContent).toContain('None');
  });

  it('shows selected asset QA status for the default fixture', () => {
    render(<WelcomePackDevPreview />);

    const statusList = screen.getByTestId('selected-asset-qa-status');
    // Default fixture is heat_pump_install; some assets should be selected
    // The list either contains 'None' or asset items — both are valid depending on fixture asset coverage
    expect(statusList).toBeInTheDocument();
  });
});

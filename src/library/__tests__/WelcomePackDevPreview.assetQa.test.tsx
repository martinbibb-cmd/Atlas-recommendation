import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview asset QA panel', () => {
  async function renderDiagnostics() {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);
    await user.click(screen.getByRole('tab', { name: /diagnostics/i }));
  }

  it('renders asset QA headings, errors, warnings, and per-selected-asset status', async () => {
    await renderDiagnostics();

    expect(screen.getByRole('heading', { level: 2, name: 'Asset QA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Asset QA Errors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Asset QA Warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Per selected asset QA status' })).toBeInTheDocument();
  });

  it('renders asset QA error and warning lists with test ids', async () => {
    await renderDiagnostics();

    expect(screen.getByTestId('asset-qa-errors')).toBeInTheDocument();
    expect(screen.getByTestId('asset-qa-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('selected-asset-qa-status')).toBeInTheDocument();
  });

  it('shows no asset QA errors for the current registry', async () => {
    await renderDiagnostics();

    const errorList = screen.getByTestId('asset-qa-errors');
    expect(errorList.textContent).toContain('None');
  });

  it('shows no asset QA warnings for the current registry', async () => {
    await renderDiagnostics();

    const warningList = screen.getByTestId('asset-qa-warnings');
    expect(warningList.textContent).toContain('None');
  });

  it('shows selected asset QA status for the default fixture', async () => {
    await renderDiagnostics();

    expect(screen.getByTestId('selected-asset-qa-status')).toBeInTheDocument();
  });
});

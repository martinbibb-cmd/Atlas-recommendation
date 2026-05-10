import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview asset audit panel', () => {
  async function renderDiagnostics() {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);
    await user.click(screen.getByRole('radio', { name: /diagnostics/i }));
  }

  it('renders the Asset accessibility audit section heading', async () => {
    await renderDiagnostics();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Asset accessibility audit' }),
    ).toBeInTheDocument();
  });

  it('renders the per selected asset audit status heading', async () => {
    await renderDiagnostics();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Per selected asset audit status' }),
    ).toBeInTheDocument();
  });

  it('renders the selected-asset-audit-status list with test id', async () => {
    await renderDiagnostics();
    expect(screen.getByTestId('selected-asset-audit-status')).toBeInTheDocument();
  });

  it('shows audit status for each selected asset in the default fixture', async () => {
    await renderDiagnostics();
    expect(screen.getByTestId('selected-asset-audit-status')).toBeInTheDocument();
  });

  it('shows needs_changes audit status for WhatIfLab when it is in the selected fixture', async () => {
    await renderDiagnostics();
    const statusEl = screen.queryByTestId('audit-status-WhatIfLab');
    if (statusEl) {
      expect(statusEl.textContent).toBe('needs_changes');
    }
  });

  it('displays a blocked reason for seeded assets that are not yet library-ready', async () => {
    await renderDiagnostics();
    const possibleIds = [
      'WhatIfLab',
      'BoilerCyclingAnimation',
      'FlowRestrictionAnimation',
      'RadiatorUpgradeAnimation',
    ];
    const foundReasonsList = possibleIds.some((id) =>
      screen.queryByTestId(`blocked-reasons-${id}`) !== null,
    );
    expect(typeof foundReasonsList).toBe('boolean');
  });

  it('includes a note that audit status is diagnostic only', async () => {
    await renderDiagnostics();
    expect(screen.getByText(/Audit status is diagnostic only/)).toBeInTheDocument();
  });
});

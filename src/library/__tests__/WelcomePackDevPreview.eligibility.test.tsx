import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview eligibility panel', () => {
  async function renderDiagnostics() {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);
    await user.click(screen.getByRole('tab', { name: /diagnostics/i }));
    return user;
  }

  it('renders the Production eligibility section heading', async () => {
    await renderDiagnostics();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Production eligibility' }),
    ).toBeInTheDocument();
  });

  it('renders the Production eligibility fieldset', async () => {
    await renderDiagnostics();
    expect(screen.getByRole('group', { name: /production eligibility/i })).toBeInTheDocument();
  });

  it('shows eligibility mode radio buttons', async () => {
    await renderDiagnostics();
    expect(screen.getByRole('radio', { name: /off/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /warn/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /filter/i })).toBeInTheDocument();
  });

  it('defaults to off mode', async () => {
    await renderDiagnostics();
    const offRadio = screen.getByRole('radio', { name: /off/i });
    expect(offRadio).toBeChecked();
    expect(screen.getByTestId('eligibility-mode-value').textContent).toBe('off');
  });

  it('shows the gate-off message when mode is off', async () => {
    await renderDiagnostics();
    expect(screen.getByText(/eligibility gate is off/i)).toBeInTheDocument();
  });

  it('switching to warn mode renders the per-asset eligibility list', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /warn/i }));

    expect(screen.getByTestId('selected-asset-eligibility-status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /per selected asset eligibility status/i })).toBeInTheDocument();
  });

  it('switching to warn mode updates the mode label', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /warn/i }));

    expect(screen.getByTestId('eligibility-mode-value').textContent).toBe('warn');
  });

  it('switching to warn mode preserves recommendedScenarioId in metadata', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /warn/i }));

    expect(screen.getByRole('heading', { level: 2, name: 'Plan metadata' })).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-mode-value').textContent).toBe('warn');
  });

  it('switching to filter mode renders the filtered assets section', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /filter/i }));

    expect(screen.getByRole('heading', { level: 3, name: /assets removed from production customer pack/i })).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-filtered-assets')).toBeInTheDocument();
  });

  it('switching to filter mode updates the mode label', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /filter/i }));

    expect(screen.getByTestId('eligibility-mode-value').textContent).toBe('filter');
  });

  it('filter mode shows eligible or blocked status items in the list', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /filter/i }));

    const list = screen.getByTestId('eligibility-filtered-assets');
    expect(list).toBeInTheDocument();
    expect(list.children.length).toBeGreaterThan(0);
  });

  it('warn mode per-asset list shows eligible or blocked labels', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /warn/i }));

    const list = screen.getByTestId('selected-asset-eligibility-status');
    expect(/eligible|blocked/i.test(list.textContent ?? '')).toBe(true);
  });

  it('switching back to off mode hides the eligibility list', async () => {
    const user = await renderDiagnostics();

    await user.click(screen.getByRole('radio', { name: /warn/i }));
    expect(screen.getByTestId('selected-asset-eligibility-status')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /off/i }));
    expect(screen.queryByTestId('selected-asset-eligibility-status')).not.toBeInTheDocument();
  });
});

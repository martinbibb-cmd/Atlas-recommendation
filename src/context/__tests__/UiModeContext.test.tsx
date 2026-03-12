/**
 * UiModeContext.test.tsx
 *
 * Validates that:
 *   - UiModeContext defaults to 'engineer'
 *   - useUiMode hook reads and updates the mode via the provider
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { UiModeContext, useUiMode, type UiMode } from '../UiModeContext';

/** Minimal test harness that exposes the current mode and a toggle button. */
function ModeDisplay() {
  const { uiMode, setUiMode } = useUiMode();
  return (
    <div>
      <span data-testid="current-mode">{uiMode}</span>
      <button onClick={() => setUiMode('customer')}>Switch to customer</button>
      <button onClick={() => setUiMode('engineer')}>Switch to engineer</button>
    </div>
  );
}

function TestProvider({ initial }: { initial?: UiMode }) {
  const [uiMode, setUiMode] = useState<UiMode>(initial ?? 'engineer');
  return (
    <UiModeContext.Provider value={{ uiMode, setUiMode }}>
      <ModeDisplay />
    </UiModeContext.Provider>
  );
}

describe('UiModeContext', () => {
  it('defaults to engineer mode when no provider is present', () => {
    render(<ModeDisplay />);
    expect(screen.getByTestId('current-mode').textContent).toBe('engineer');
  });

  it('provides the initial mode through the provider', () => {
    render(<TestProvider initial="customer" />);
    expect(screen.getByTestId('current-mode').textContent).toBe('customer');
  });

  it('updates mode when setUiMode is called', () => {
    render(<TestProvider initial="engineer" />);
    expect(screen.getByTestId('current-mode').textContent).toBe('engineer');
    fireEvent.click(screen.getByText('Switch to customer'));
    expect(screen.getByTestId('current-mode').textContent).toBe('customer');
    fireEvent.click(screen.getByText('Switch to engineer'));
    expect(screen.getByTestId('current-mode').textContent).toBe('engineer');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview content QA panel', () => {
  it('renders content QA errors, warnings, and selected concept status in diagnostics mode', async () => {
    const user = userEvent.setup();
    render(<WelcomePackDevPreview />);

    await user.click(screen.getByRole('radio', { name: /diagnostics/i }));

    expect(screen.getByRole('heading', { level: 2, name: 'Content QA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Content QA Errors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Content QA Warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Per selected concept content status' })).toBeInTheDocument();
    expect(screen.getByTestId('content-qa-errors')).toBeInTheDocument();
    expect(screen.getByTestId('content-qa-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('selected-concept-content-status')).toBeInTheDocument();
  });
});

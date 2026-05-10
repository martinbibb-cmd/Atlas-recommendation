import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WelcomePackDevPreview } from '../dev/WelcomePackDevPreview';

describe('WelcomePackDevPreview content QA panel', () => {
  it('renders content QA errors, warnings, and selected concept status', () => {
    render(<WelcomePackDevPreview />);

    expect(screen.getByRole('heading', { level: 2, name: 'Content QA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'content QA errors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'content QA warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Per selected concept content status' })).toBeInTheDocument();
    expect(screen.getByTestId('content-qa-errors')).toBeInTheDocument();
    expect(screen.getByTestId('content-qa-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('selected-concept-content-status')).toBeInTheDocument();
  });
});

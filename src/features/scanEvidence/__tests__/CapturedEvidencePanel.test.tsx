import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapturedEvidencePanel } from '../CapturedEvidencePanel';

describe('CapturedEvidencePanel', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders room -> capturePoint grouping with required evidence fields', () => {
    render(
      <CapturedEvidencePanel
        spatialEvidenceGraph={{
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              geometryStatus: 'resolved',
              areaM2: 12.5,
              ceilingHeightM: 2.4,
              warnings: ['Wall edge incomplete'],
              capturePoints: [
                {
                  capturePointId: 'cp-001',
                  anchorConfidence: 0.93,
                  surfaceSemantic: 'wall',
                  needsReview: true,
                  objectPins: [{ label: 'Boiler' }],
                  photos: [{ url: 'photo-1.jpg' }],
                  transcripts: [{ excerpt: 'Flue route behind cabinet' }],
                  ghostAppliances: [{ label: 'Legacy combi' }],
                  measurements: [{ label: 'Flue offset', valueM: 0.4 }],
                },
              ],
            },
          ],
        }}
        unresolvedEvidence={[
          {
            id: 'un-1',
            type: 'missing-photo',
            room: 'Kitchen',
            capturePointId: 'cp-001',
            message: 'Need image of condensate termination',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('captured-evidence-panel')).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-room-kitchen')).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-capture-point-cp-001')).toBeTruthy();
    expect(screen.getByText(/Anchor confidence: 0.93/i)).toBeTruthy();
    expect(screen.getByText(/Surface: wall/i)).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-needs-review-cp-001')).toBeTruthy();
    expect(screen.getByText(/Boiler/i)).toBeTruthy();
    expect(screen.getByText(/photo-1.jpg/i)).toBeTruthy();
    expect(screen.getByText(/Flue route behind cabinet/i)).toBeTruthy();
    expect(screen.getByText(/Legacy combi/i)).toBeTruthy();
    expect(screen.getByText(/Flue offset: 0.4 m/i)).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-unresolved-panel')).toBeTruthy();
    expect(screen.getByText(/engineer review required/i)).toBeTruthy();
  });

  it('renders the storyboard walkthrough in the required room-card order', () => {
    render(
      <CapturedEvidencePanel
        initialView="storyboard"
        spatialEvidenceGraph={{
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              geometryStatus: 'resolved',
              areaM2: 12.5,
              ceilingHeightM: 2.4,
              capturePoints: [
                {
                  capturePointId: 'cp-001',
                  surfaceSemantic: 'wall',
                  objectPins: [{ label: 'Boiler' }],
                  ghostAppliances: [{ label: 'Legacy combi' }],
                  measurements: [{ label: 'Flue offset', valueM: 0.4 }],
                },
              ],
            },
          ],
        }}
      />,
    );

    const room = screen.getByTestId('evidence-storyboard-room-kitchen');
    const cardTitles = Array.from(
      room.querySelectorAll('[data-testid^="evidence-storyboard-card-kitchen-"] p:first-child'),
    ).map((node) => node.textContent);

    expect(screen.getByTestId('captured-evidence-storyboard-panel')).toBeTruthy();
    expect(cardTitles).toEqual([
      '1. What we scanned',
      '2. Key objects found',
      '3. Measurements taken',
      '4. Ghost appliance checks',
      '5. Open review items',
    ]);
  });

  it('links storyboard cards back to the graph capture point view', async () => {
    const user = userEvent.setup();

    render(
      <CapturedEvidencePanel
        initialView="storyboard"
        spatialEvidenceGraph={{
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              capturePoints: [
                {
                  capturePointId: 'cp-001',
                  objectPins: [{ label: 'Boiler' }],
                },
              ],
            },
          ],
        }}
      />,
    );

    await user.click(screen.getAllByRole('link', { name: 'cp-001' })[0]);

    expect(screen.getByTestId('captured-evidence-tab-graph').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('captured-evidence-graph-panel')).toBeTruthy();
    expect(screen.getByTestId('captured-evidence-capture-point-cp-001')).toBeTruthy();
  });

  it('softens unresolved evidence for customer-facing mode', () => {
    render(
      <CapturedEvidencePanel
        spatialEvidenceGraph={{ rooms: [] }}
        unresolvedEvidence={[{ id: 'un-2', type: 'pending-verification' }]}
        customerFacing
      />,
    );

    expect(screen.getByText(/review pending/i)).toBeTruthy();
    expect(screen.getByText(/under review/i)).toBeTruthy();
    expect(screen.queryByText(/pending-verification/i)).toBeNull();
    expect(screen.queryByText(/capturePointId:/i)).toBeNull();
  });

  it('shows unresolved technical details when explicitly allowed', () => {
    render(
      <CapturedEvidencePanel
        spatialEvidenceGraph={{ rooms: [] }}
        unresolvedEvidence={[{ id: 'un-3', type: 'pending-verification', capturePointId: 'cp-9' }]}
        customerFacing
        allowUnresolvedDetails
      />,
    );

    expect(screen.getByText(/pending-verification/i)).toBeTruthy();
    expect(screen.getByText(/capturePointId: cp-9/i)).toBeTruthy();
  });

  it('hides storyboard review detail in customer-safe mode', () => {
    render(
      <CapturedEvidencePanel
        initialView="storyboard"
        spatialEvidenceGraph={{
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              warnings: ['Wall edge incomplete'],
              capturePoints: [{ capturePointId: 'cp-001', needsReview: true }],
            },
          ],
        }}
        customerFacing
      />,
    );

    expect(screen.getByText(/Review details are hidden in customer-safe mode/i)).toBeTruthy();
    expect(screen.queryByText(/Wall edge incomplete/i)).toBeNull();
    expect(screen.queryByText(/Capture point flagged for review/i)).toBeNull();
  });
});

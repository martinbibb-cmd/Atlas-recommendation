import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapturedEvidencePanel } from '../CapturedEvidencePanel';

describe('CapturedEvidencePanel', () => {
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
    expect(screen.getByText(/capturePointId: cp-001/i)).toBeTruthy();
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
    expect(screen.queryByText(/capturePointId:/i)).toBeNull();
  });
});


/**
 * LabQuickInputsPanel.test.tsx
 *
 * Validates that the Lab Quick Inputs gate:
 * - Renders only the fields listed in missingFields
 * - Keeps "Run Lab" disabled until all shown fields are answered
 * - Calls onComplete with a merged EngineInputV2_3 after all chips are selected
 * - Calls onCancel when the Back button is clicked
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabQuickInputsPanel from '../LabQuickInputsPanel';
import type { LabQuickField } from '../../../lib/lab/getMissingLabFields';

// ── Helpers ───────────────────────────────────────────────────────────────────

function allFields(): LabQuickField[] {
  return [
    { id: 'systemType',       label: 'System type' },
    { id: 'bathroomCount',    label: 'Bathrooms' },
    { id: 'occupancyCount',   label: 'Occupancy' },
    { id: 'mainsPerformance', label: 'Mains performance' },
    { id: 'primaryPipeSize',  label: 'Primary pipe' },
    { id: 'planType',         label: 'Heating layout' },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LabQuickInputsPanel', () => {
  it('renders the panel heading', () => {
    render(
      <LabQuickInputsPanel
        missingFields={allFields()}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByText(/a few quick inputs are needed to run the simulator/i),
    ).toBeTruthy();
  });

  it('shows field count in the subtitle', () => {
    render(
      <LabQuickInputsPanel
        missingFields={allFields()}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/6 fields needed/i)).toBeTruthy();
  });

  it('shows singular wording when exactly one field is missing', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/1 field needed/i)).toBeTruthy();
  });

  it('does not render system-type chips when systemType is not in missingFields', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('Combi')).toBeNull();
  });

  it('renders system-type chips when systemType is in missingFields', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'systemType', label: 'System type' }]}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Combi')).toBeTruthy();
    expect(screen.getByText('Heat pump')).toBeTruthy();
  });

  it('Run Lab button is disabled until all fields are answered', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: /run lab/i });
    expect(btn).toBeDisabled();
  });

  it('Run Lab button becomes enabled after answering the only missing field', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        initialInput={{ currentHeatSourceType: 'combi', occupancyCount: 2, dynamicMainsPressure: 2.5, primaryPipeDiameter: 22, systemPlanType: 'y_plan' }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    // Click the "1" bathroom chip
    fireEvent.click(screen.getByText('1'));
    const btn = screen.getByRole('button', { name: /run lab/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls onCancel when the Back button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <LabQuickInputsPanel
        missingFields={allFields()}
        onComplete={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onComplete with a complete engine input after all fields answered', () => {
    const onComplete = vi.fn();
    render(
      <LabQuickInputsPanel
        missingFields={allFields()}
        initialInput={{}}
        onComplete={onComplete}
        onCancel={() => {}}
      />,
    );

    // Answer all required fields
    fireEvent.click(screen.getByText('Combi'));
    fireEvent.click(screen.getByText('1'));                  // bathrooms
    fireEvent.click(screen.getByText('1–2'));                // occupancy
    fireEvent.click(screen.getByText('Good'));               // mains
    fireEvent.click(screen.getByText('22 mm'));              // primary pipe
    fireEvent.click(screen.getByText('Not sure'));           // plan type

    const btn = screen.getByRole('button', { name: /run lab/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledOnce();
    const result = onComplete.mock.calls[0][0];
    expect(result.currentHeatSourceType).toBe('combi');
    expect(result.bathroomCount).toBe(1);
    expect(result.occupancyCount).toBe(2);
    expect(result.dynamicMainsPressure).toBe(2.5);  // 'good' preset
    expect(result.primaryPipeDiameter).toBe(22);
  });

  it('shows "Heating / hot water layout" row when planType is missing', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'planType', label: 'Heating layout' }]}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Y-plan')).toBeTruthy();
    expect(screen.getByText('S-plan')).toBeTruthy();
    expect(screen.getByText('Not sure')).toBeTruthy();
  });

  it('shows cylinder-type row when effectiveSystemType requires stored DHW', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        initialInput={{ currentHeatSourceType: 'system' }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('Standard')).toBeTruthy();
    expect(screen.getByText(/mains-fed supply/i)).toBeTruthy();
  });

  it('does not show cylinder-type row for combi systems', () => {
    render(
      <LabQuickInputsPanel
        missingFields={[{ id: 'bathroomCount', label: 'Bathrooms' }]}
        initialInput={{ currentHeatSourceType: 'combi' }}
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('Standard')).toBeNull();
  });
});

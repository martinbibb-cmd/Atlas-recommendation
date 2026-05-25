import { describe, expect, it } from 'vitest';
import { resolveCanonicalVisitExportState, resolveVisitSessionReference } from '../resolveCanonicalVisitExportState';

describe('resolveVisitSessionReference', () => {
  it('prefers saved visit metadata over the synthetic visit reference fallback', () => {
    expect(
      resolveVisitSessionReference(
        {
          visit_reference: 'Project Maple',
          customer_name: 'Jane Smith',
          address_line_1: '10 High Street',
        },
        'visit_1234',
      ),
    ).toBe('Project Maple');
  });

  it('falls back to customer name, then address, then visit id reference', () => {
    expect(
      resolveVisitSessionReference(
        {
          visit_reference: null,
          customer_name: 'Jane Smith',
          address_line_1: '10 High Street',
        },
        'visit_1234',
      ),
    ).toBe('Jane Smith');

    expect(
      resolveVisitSessionReference(
        {
          visit_reference: null,
          customer_name: null,
          address_line_1: '10 High Street',
        },
        'visit_1234',
      ),
    ).toBe('10 High Street');

    expect(
      resolveVisitSessionReference(
        {
          visit_reference: null,
          customer_name: null,
          address_line_1: null,
        },
        'visit_1234',
      ),
    ).toBe('SIT_1234');
  });
});

describe('resolveCanonicalVisitExportState', () => {
  it('prefers the latest saved visit state over stale in-memory defaults', () => {
    const savedSurvey = {
      postcode: 'AB1 2CD',
      fullSurvey: {
        heatLoss: {
          estimatedPeakHeatLossW: 12500,
          shellModel: {
            activeLayerId: 'layer_saved',
            layers: [],
            settings: {
              storeys: 3,
              ceilingHeight: 2.4,
              dwellingType: 'semi',
              wallType: 'cavityFullFill',
              loftInsulation: 'mm270plus',
              glazingType: 'doubleArated',
              glazingAmount: 'medium',
              floorType: 'insulated',
              thermalMass: 'medium',
            },
          },
        },
      },
    };

    const result = resolveCanonicalVisitExportState({
      activeVisitId: 'visit_saved',
      activeVisitMeta: {
        visit_reference: 'Project Maple',
        customer_name: 'Jane Smith',
        address_line_1: '10 High Street',
      },
      savedVisit: {
        schemaVersion: 2,
        visitId: 'visit_saved',
        visitReference: 'Project Maple',
        updatedAt: '2026-05-24T00:00:00.000Z',
        survey: savedSurvey,
        engineInputSnapshot: { bathroomCount: 2, occupancyCount: 4 } as never,
        decision: { recommendedScenarioId: 'scenario_saved' } as never,
        customerSummary: { customerDecision: { headline: 'Saved summary' } } as never,
        acceptedScenarioId: 'scenario_saved',
      },
      activeCanonicalPackage: {
        visitIdentity: {
          visitId: 'visit_saved',
          visitReference: 'Imported Package',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
        surveyDraft: {
          postcode: 'ZZ1 1ZZ',
          fullSurvey: {
            heatLoss: {
              shellModel: {
                activeLayerId: 'layer_imported',
                layers: [],
                settings: {
                  storeys: 1,
                  ceilingHeight: 2.4,
                  dwellingType: 'semi',
                  wallType: 'cavityUninsulated',
                  loftInsulation: 'mm100',
                  glazingType: 'single',
                  glazingAmount: 'low',
                  floorType: 'solidUninsulated',
                  thermalMass: 'light',
                },
              },
            },
          },
        } as never,
        engineInputSnapshot: { bathroomCount: 1, occupancyCount: 2 } as never,
        customerPropertyDetails: {},
        proposalTruth: {},
        generatedOutputStatus: {},
        workspaceBrandReference: {},
        importExportMetadata: { exportedAt: '2026-05-20T00:00:00.000Z', source: { target: 'local_only', surface: 'visit_home_export' } },
      } as never,
      currentSnapshot: {
        visitId: 'visit_saved',
        visitReference: 'Unsaved default',
        acceptedScenarioId: 'scenario_stale',
      },
      labFullSurveyModel: {
        postcode: 'YY1 1YY',
        fullSurvey: {
          heatLoss: {
            shellModel: {
              activeLayerId: 'layer_lab',
              layers: [],
              settings: {
                storeys: 2,
                ceilingHeight: 2.4,
                dwellingType: 'semi',
                wallType: 'cavityPartialFill',
                loftInsulation: 'mm200',
                glazingType: 'doubleOld',
                glazingAmount: 'high',
                floorType: 'suspendedUninsulated',
                thermalMass: 'heavy',
              },
            },
          },
        },
      } as never,
      labEngineInput: { bathroomCount: 9, occupancyCount: 9 } as never,
    });

    expect(result).toBeDefined();
    expect(result?.exportSurveyModel).toBe(savedSurvey);
    expect(result?.exportEngineInput).toMatchObject({ bathroomCount: 2, occupancyCount: 4 });
    expect(result?.visitReference).toBe('Project Maple');
    expect(result?.selectedScenarioId).toBe('scenario_saved');
  });

  it('prefers saved recommendation snapshot authority when resolving export state', () => {
    const result = resolveCanonicalVisitExportState({
      activeVisitId: 'visit_saved',
      savedVisit: {
        schemaVersion: 2,
        visitId: 'visit_saved',
        updatedAt: '2026-05-24T00:00:00.000Z',
        survey: { postcode: 'AB1 2CD' } as never,
        recommendationSnapshot: {
          snapshotId: 'snapshot-saved',
          createdAt: '2026-05-24T00:00:00.000Z',
          sourceVisitRevision: '2026-05-24T00:00:00.000Z',
          checksum: 'fnv1a32-saved',
        },
      },
      activeCanonicalPackage: {
        visitIdentity: { visitId: 'visit_saved' },
        surveyDraft: { postcode: 'AB1 2CD' } as never,
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        importExportMetadata: {
          exportedAt: '2026-05-20T00:00:00.000Z',
          source: { target: 'local_only', surface: 'visit_home_export' },
          recommendationSnapshot: {
            snapshotId: 'snapshot-package',
            createdAt: '2026-05-20T00:00:00.000Z',
            sourceVisitRevision: '2026-05-20T00:00:00.000Z',
            checksum: 'fnv1a32-package',
          },
        },
      } as never,
    });

    expect(result?.recommendationSnapshot?.snapshotId).toBe('snapshot-saved');
  });
});

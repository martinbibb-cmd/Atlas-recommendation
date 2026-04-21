/**
 * sampleVisitHandoffPack.ts
 *
 * PR11 — Developer fixture for the visit handoff review feature.
 *
 * Used by the ?visit-handoff=1 dev route as a default pack when no external
 * data is provided.  Representative of a typical completed visit.
 *
 * Must NOT be imported in production code paths.
 */

import type { VisitHandoffPack } from '../types/visitHandoffPack';

export const SAMPLE_VISIT_HANDOFF_PACK: VisitHandoffPack = {
  schemaVersion: '1.0',
  visitId: 'visit_demo_001',
  completedAt: '2025-10-14T14:32:00Z',
  engineerName: 'J. Smith',

  customerSummary: {
    address: '14 Acacia Road, London, SW1A 1AA',
    currentSystemDescription:
      'You currently have a combination boiler providing central heating and on-demand hot water.',
    findings: [
      'The existing boiler is over 15 years old and operating below its design efficiency.',
      'One radiator in the kitchen is not heating correctly and may need balancing or replacement.',
      'Hot water flow rate is adequate for a single bathroom but may not keep up with simultaneous demand.',
      'Loft insulation is present but below current recommended depth.',
    ],
    plannedWork: [
      'Replace the existing combination boiler with a new high-efficiency model.',
      'Fit a new magnetic system filter to protect the circuit.',
      'Balance radiators throughout the property.',
      'Carry out a full system flush before commissioning.',
    ],
    nextSteps:
      'Your engineer will be in touch within two working days to confirm the installation date and any additional details.',
  },

  engineerSummary: {
    rooms: [
      { id: 'room_01', name: 'Living Room', areaM2: 22, notes: 'Double radiator on south wall. TRV fitted.' },
      { id: 'room_02', name: 'Kitchen / Diner', areaM2: 18, notes: 'Single radiator. Not heating fully — TRV stuck.' },
      { id: 'room_03', name: 'Main Bedroom', areaM2: 16 },
      { id: 'room_04', name: 'Bedroom 2', areaM2: 12, notes: 'Small radiator. Adequate for room size.' },
      { id: 'room_05', name: 'Bathroom', areaM2: 6, notes: 'Towel rail — chrome ladder, electric backup present.' },
      { id: 'room_06', name: 'Hallway', areaM2: 8 },
    ],

    keyObjects: [
      {
        type: 'Boiler',
        make: 'Worcester Bosch Greenstar 28i',
        installYear: 2008,
        condition: 'Operational but end of service life. Annual service overdue.',
        notes: 'Located in kitchen cupboard. 28 kW combination boiler.',
      },
      {
        type: 'System filter',
        condition: 'No filter fitted.',
        notes: 'Recommend magnetic filter on new installation.',
      },
      {
        type: 'Thermostat / controls',
        make: 'Honeywell CM907',
        condition: 'Functional. Programmer-only — no zone control.',
        notes: 'Recommend smart controls upgrade.',
      },
      {
        type: 'Gas meter',
        condition: 'Good. U6 meter, accessible under stairs.',
      },
    ],

    proposedEmitters: [
      {
        roomId: 'room_01',
        roomName: 'Living Room',
        emitterType: 'Radiator',
        outputWatts: 1800,
        notes: 'Like-for-like double panel replacement.',
      },
      {
        roomId: 'room_02',
        roomName: 'Kitchen / Diner',
        emitterType: 'Radiator',
        outputWatts: 1200,
        notes: 'Replacement single panel with new TRV.',
      },
      {
        roomId: 'room_03',
        roomName: 'Main Bedroom',
        emitterType: 'Radiator',
        outputWatts: 1000,
      },
      {
        roomId: 'room_04',
        roomName: 'Bedroom 2',
        emitterType: 'Radiator',
        outputWatts: 700,
      },
      {
        roomId: 'room_05',
        roomName: 'Bathroom',
        emitterType: 'Towel rail',
        outputWatts: 400,
        notes: 'Retain existing chrome ladder rail. Plumb into CH circuit.',
      },
    ],

    accessNotes: [
      {
        location: 'Boiler cupboard (kitchen)',
        note: 'Narrow cupboard — 600 mm clearance. Full flush & new boiler installation feasible via right-hand door only.',
      },
      {
        location: 'Loft hatch (landing)',
        note: 'Standard hatch. Access for flue run confirmed.',
      },
    ],

    roomPlanNotes:
      'Standard two-storey semi-detached. Ground floor: hall, living room, kitchen/diner. ' +
      'First floor: two bedrooms, bathroom, landing. No loft conversion. ' +
      'Primary pipework runs under ground floor boards.',

    specNotes:
      'System to be installed as sealed pressurised circuit. ' +
      '22 mm primary, 15 mm distribution. ' +
      'Boiler replacement — 28–30 kW range appropriate for heat loss. ' +
      'Magnetic filter mandatory. Smart controls recommended.',

    fieldNotesSummary:
      'Clean install — no major obstructions. Customer confirmed they are in during daytime most weekdays. ' +
      'Asbestos survey not required — property post-1990 construction confirmed from deeds.',
  },
};

// src/explainers/lego/simulator/useSystemDiagramPlayback.ts
//
// Drives the SystemDiagramPanel with a cycling demo sequence that mirrors
// the real service-arbitration rules already established in prior lab refactor
// work (serviceArbitration.ts).
//
// Guarantees:
//   - resolveServiceMode() from serviceArbitration.ts is the single source
//     of truth for which SystemMode is active at any moment.
//   - computeServiceSwitchingActive() from the same module controls the CH-
//     suppression flag (combi only).
//   - supplyOriginsForSystemType() from supplyOrigins.ts provides the
//     authoritative origin mapping for each system type.
//   - No Math.random() is used anywhere in the state machine.

import { useState, useEffect, useCallback } from 'react'
import type { SystemMode, SystemType, HeatSourceType } from '../animation/types'
import type { LabSupplyOrigins } from '../sim/supplyOrigins'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'
import { resolveServiceMode, computeServiceSwitchingActive } from '../animation/serviceArbitration'
import { deriveCondensingState } from '../sim/condensingState'
import type { CondensingState } from '../sim/condensingState'
import type { OccupancyProfile, DemandPresetId } from './systemInputsTypes'

// ─── Simulator system choice (UI-level) ──────────────────────────────────────

/**
 * The four system families exposed in the simulator UI.
 *
 * Maps to internal SystemType + HeatSourceType:
 *   combi       → systemType='combi',              heatSourceType='combi'
 *   unvented    → systemType='unvented_cylinder',  heatSourceType='system_boiler'  (S-plan)
 *   open_vented → systemType='vented_cylinder',    heatSourceType='system_boiler'  (Y-plan)
 *   heat_pump   → systemType='unvented_cylinder',  heatSourceType='heat_pump'
 *   mixergy     → systemType='unvented_cylinder',  heatSourceType='system_boiler'  (Mixergy stratified)
 */
export type SimulatorSystemChoice = 'combi' | 'unvented' | 'open_vented' | 'heat_pump' | 'mixergy'

// ─── User demand controls ─────────────────────────────────────────────────────

/**
 * Explicit user-facing demand controls.
 *
 * When the user manually sets any of these, the hook switches to manual mode
 * and these values override the auto-cycling demo phases.
 */
export type DemandControls = {
  /** Whether space-heating is enabled (thermostat calling). */
  heatingEnabled: boolean
  /** Shower outlet open (hot-water draw in progress). */
  shower: boolean
  /** Bath outlet open (hot-water draw in progress). */
  bath: boolean
  /** Kitchen tap open (hot-water draw in progress). */
  kitchen: boolean
  /** Cold tap open (cold-water draw only; does not request hot service). */
  coldTap: boolean
}

// ─── Public state type ────────────────────────────────────────────────────────

/**
 * All display-relevant state the SystemDiagramPanel needs to drive its live
 * animated schematic.
 *
 * Sourced entirely from authoritative lab state:
 *   - systemMode from resolveServiceMode() (serviceArbitration.ts)
 *   - serviceSwitchingActive from computeServiceSwitchingActive() (same)
 *   - supplyOrigins from supplyOriginsForSystemType() (supplyOrigins.ts)
 *   - condensingState from deriveCondensingState() (condensingState.ts)
 */
export type SystemDiagramDisplayState = {
  systemMode: SystemMode
  systemType: SystemType
  heatSourceType: HeatSourceType
  /**
   * True when a combi boiler has diverted output to the plate HEX for a DHW
   * draw that interrupted an active CH call.  Always false for stored systems.
   *
   * Source: computeServiceSwitchingActive() in serviceArbitration.ts.
   */
  serviceSwitchingActive: boolean
  /**
   * Authoritative supply origins for this system type.
   * Presence of onDemandHot vs dhwHotStore drives combi vs stored rendering.
   */
  supplyOrigins: LabSupplyOrigins
  /**
   * Boiler condensing classification derived from return-water temperature.
   * Absent when no boiler is present (heat pump systems).
   */
  condensingState?: CondensingState
  /**
   * Measured or modelled return-water temperature (°C).
   * Used by the Efficiency panel to show numeric context alongside the
   * condensing-state classification.  Absent for heat pump systems.
   */
  returnTempC?: number
  /**
   * True when the user is actively drawing hot water from a stored cylinder.
   * Distinct from systemMode === 'dhw_draw' which is combi-only.
   *
   * For stored systems this drives the cylinder→outlets animated path without
   * conflating draw with reheat in the service mode enum.
   */
  hotDrawActive: boolean
  /**
   * Fractional fill level of the stored cylinder (0–1).
   * Absent for combi systems.
   */
  cylinderFillPct?: number
  /**
   * Cylinder architecture variant.
   * 'mixergy'  — stratified smart cylinder (Mixergy-style).
   * 'standard' — conventional vented or unvented cylinder.
   * Absent for combi and heat-pump-only systems (no boiler-served cylinder).
   */
  cylinderVariant?: 'standard' | 'mixergy'
  /**
   * Human-readable label for the current simulation phase.
   * Shown in the sim-time/phase bar.
   */
  phaseLabel: string
  /**
   * Coefficient of Performance estimate for heat pump systems.
   * Absent for boiler systems.
   */
  cop?: number
  /** Explicit outlet draw demands for shower/bath/kitchen/cold tap. */
  outletDemands?: {
    shower: boolean
    bath: boolean
    kitchen: boolean
    coldTap: boolean
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PHASE_DURATION_MS = 4_500

/**
 * Demo phases for a combi system.
 * Inputs that feed resolveServiceMode() at each phase.
 */
type CombiPhase = {
  heatingEnabled: boolean
  hotDrawActive: boolean
  /** Simulated CH return temperature for condensing classification. */
  returnTempC: number
  phaseLabel: string
}

const COMBI_PHASES: CombiPhase[] = [
  { heatingEnabled: false, hotDrawActive: false, returnTempC: 45, phaseLabel: 'Standby'           },
  { heatingEnabled: true,  hotDrawActive: false, returnTempC: 43, phaseLabel: 'Heating'            },
  { heatingEnabled: true,  hotDrawActive: true,  returnTempC: 52, phaseLabel: 'On-demand hot water' },
  { heatingEnabled: true,  hotDrawActive: false, returnTempC: 45, phaseLabel: 'Heating resumes'    },
  { heatingEnabled: false, hotDrawActive: false, returnTempC: 48, phaseLabel: 'Cooling'            },
]

/**
 * Demo phases for a stored unvented (S-plan) system.
 */
type StoredPhase = {
  heatingEnabled: boolean
  storeNeedsReheat: boolean
  hotDrawActive: boolean
  returnTempC: number
  cylinderFillPct: number
  phaseLabel: string
}

const STORED_PHASES: StoredPhase[] = [
  { heatingEnabled: false, storeNeedsReheat: false, hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.70, phaseLabel: 'Standby'       },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.68, phaseLabel: 'Heating'        },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: true,  returnTempC: 44, cylinderFillPct: 0.55, phaseLabel: 'Stored DHW draw' },
  { heatingEnabled: true,  storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.45, phaseLabel: 'CH + reheat'    },
  { heatingEnabled: false, storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.62, phaseLabel: 'Reheat only'    },
]

/**
 * Demo phases for an open vented (Y-plan) system.
 * Uses vented_cylinder SystemType — cold supply comes from CWS tank.
 */
const VENTED_PHASES: StoredPhase[] = [
  { heatingEnabled: false, storeNeedsReheat: false, hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.72, phaseLabel: 'Standby'       },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.70, phaseLabel: 'Heating'        },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: true,  returnTempC: 44, cylinderFillPct: 0.57, phaseLabel: 'Stored DHW draw' },
  { heatingEnabled: true,  storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 44, cylinderFillPct: 0.46, phaseLabel: 'CH + reheat'    },
  { heatingEnabled: false, storeNeedsReheat: true,  hotDrawActive: false, returnTempC: 46, cylinderFillPct: 0.63, phaseLabel: 'Reheat only'    },
]

/**
 * Demo phases for a heat pump + unvented cylinder system.
 * No condensing state (heat pumps do not condense like gas boilers).
 */
type HeatPumpPhase = {
  heatingEnabled: boolean
  storeNeedsReheat: boolean
  hotDrawActive: boolean
  cylinderFillPct: number
  /** Estimated COP at this operating point. */
  copEstimate: number
  phaseLabel: string
}

const HEAT_PUMP_PHASES: HeatPumpPhase[] = [
  { heatingEnabled: false, storeNeedsReheat: false, hotDrawActive: false, cylinderFillPct: 0.80, copEstimate: 3.2, phaseLabel: 'Standby'        },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: false, cylinderFillPct: 0.78, copEstimate: 3.4, phaseLabel: 'Heating'         },
  { heatingEnabled: true,  storeNeedsReheat: false, hotDrawActive: true,  cylinderFillPct: 0.65, copEstimate: 3.1, phaseLabel: 'Stored DHW draw'  },
  { heatingEnabled: true,  storeNeedsReheat: true,  hotDrawActive: false, cylinderFillPct: 0.50, copEstimate: 2.9, phaseLabel: 'CH + reheat'      },
  { heatingEnabled: false, storeNeedsReheat: true,  hotDrawActive: false, cylinderFillPct: 0.68, copEstimate: 3.0, phaseLabel: 'Reheat only'      },
]

// ─── Occupancy-aware demand tables ───────────────────────────────────────────

/**
 * Hour-by-hour demand for each occupancy profile.
 *
 * Each entry covers one hour of the 24-hour day (index 0 = midnight, 23 = 23:00).
 * heatingEnabled: whether the thermostat is calling for space heating.
 * hotDrawActive:  whether hot water is being drawn (shower/bath/kitchen).
 * label:          descriptive phase label shown in the phase bar.
 *
 * These tables are deterministic — no Math.random() or external data.
 */
type OccupancyHour = {
  heatingEnabled: boolean
  hotDrawActive: boolean
  label: string
}

type OccupancyTable = readonly OccupancyHour[]

const OCCUPANCY_PROFESSIONAL: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'          },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Morning wake-up'    },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning routine'    },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Preparing to leave' },
  /* 09 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 10 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 11 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 12 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 13 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'            },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home from work'     },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening routine'    },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'    },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'    },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'    },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'       },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'       },
]

const OCCUPANCY_STEADY_HOME: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 06 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'         },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning routine'   },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'    },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'    },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'    },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'    },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Lunchtime'         },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'  },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'  },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'  },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'  },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening routine'   },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'   },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'   },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'   },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'   },
  /* 22 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'   },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'      },
]

const OCCUPANCY_FAMILY: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'           },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family wake-up'      },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'School morning rush' },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'School drop-off'     },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'        },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'School pick-up'      },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'After school'        },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Family evening'      },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Family evening'      },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family evening'      },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family evening'      },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family evening'      },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'        },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'        },
]

const OCCUPANCY_SHIFT: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home from shift'   },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Post-shift routine' },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Rest period'       },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'Pre-shift'         },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 17 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 18 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 19 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 20 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 21 */ { heatingEnabled: false, hotDrawActive: false, label: 'Night shift'       },
  /* 22 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Pre-shift prep'    },
  /* 23 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Preparing for shift' },
]

// ─── Per-preset occupancy tables ──────────────────────────────────────────────
//
// These tables give each DemandPresetId a distinct hour-by-hour demand pattern
// that directly reflects the differences described in OccupancyPreset.ts.
//
// Profiles that already exist in the generic tables (professional, steady_home,
// family, shift) are re-used via the fallback mapping in getOccupancyTableForPreset.

const OCCUPANCY_WORKING_COUPLE: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'             },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'First person up'       },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning rush — both'   },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Finishing up'          },
  /* 09 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 10 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 11 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 12 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 13 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'               },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Arriving home'         },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening — first person'},
  /* 19 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening — second person'},
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'       },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'       },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'          },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'          },
]

const OCCUPANCY_FAMILY_TEENAGERS: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School wake-up'         },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning rush'           },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School drop-off'        },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School hours'           },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: false, label: 'School pick-up'         },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'After school'           },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family evening'         },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Teen shower peak'       },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Teen shower peak'       },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Late teen shower'       },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_RETIRED_COUPLE: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Morning rise'           },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning wash'           },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'         },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'         },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'         },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Lunchtime'              },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Afternoon wash / tea'   },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 22 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_HOME_WORKER: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Morning rise'           },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning shower'         },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Working from home'      },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Kitchen — mid-morning'  },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Working from home'      },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Lunch — kitchen use'    },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Working from home'      },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Working from home'      },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Afternoon kitchen'      },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Working from home'      },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Finish work'            },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening routine'        },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 22 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_MULTIGENERATIONAL: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Early riser'            },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning rush'           },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning overlap'        },
  /* 09 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Home – older gen'       },
  /* 10 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'         },
  /* 11 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – morning'         },
  /* 12 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Lunchtime'              },
  /* 13 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 14 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 15 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Afternoon kitchen'      },
  /* 16 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home – afternoon'       },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Family arriving home'   },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Family evening'         },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'High demand evening'    },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Family evening'         },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_BATH_HEAVY: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Morning wash (quick)'   },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Preparing to leave'     },
  /* 09 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 10 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 11 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 12 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 13 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'Out — daytime'          },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'Heading home'           },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home — heating on'      },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Preparing bath'         },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Bath draw — heavy load' },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Bath fill continues'    },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Post-bath — relaxing'   },
  /* 22 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_SHOWER_HEAVY: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'First shower'           },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Second shower'          },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Third shower — peak'    },
  /* 09 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 10 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 11 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 12 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 13 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home from work'         },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Post-work shower'       },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 21 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

const OCCUPANCY_WEEKEND_HEAVY: OccupancyTable = [
  /* 00 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 01 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 02 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 03 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 04 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 05 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 06 */ { heatingEnabled: false, hotDrawActive: false, label: 'Overnight'              },
  /* 07 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Weekday morning'        },
  /* 08 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Quick morning routine'  },
  /* 09 */ { heatingEnabled: false, hotDrawActive: false, label: 'Commuting'              },
  /* 10 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 11 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 12 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 13 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 14 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 15 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 16 */ { heatingEnabled: false, hotDrawActive: false, label: 'At work'                },
  /* 17 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Home from work'         },
  /* 18 */ { heatingEnabled: true,  hotDrawActive: true,  label: 'Evening routine'        },
  /* 19 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 20 */ { heatingEnabled: true,  hotDrawActive: false, label: 'Evening at home'        },
  /* 21 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
  /* 22 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
  /* 23 */ { heatingEnabled: false, hotDrawActive: false, label: 'Winding down'           },
]

/**
 * Select the occupancy table for a specific DemandPresetId.
 *
 * Each preset gets its own distinct 24-hour table. When a preset is not listed
 * here the fallback generic profile table is returned by `getOccupancyTable`.
 */
function getOccupancyTableForPreset(presetId: DemandPresetId): OccupancyTable | undefined {
  switch (presetId) {
    case 'single_working_adult':  return OCCUPANCY_PROFESSIONAL
    case 'working_couple':        return OCCUPANCY_WORKING_COUPLE
    case 'family_young_children': return OCCUPANCY_FAMILY
    case 'family_teenagers':      return OCCUPANCY_FAMILY_TEENAGERS
    case 'retired_couple':        return OCCUPANCY_RETIRED_COUPLE
    case 'home_worker':           return OCCUPANCY_HOME_WORKER
    case 'shift_worker':          return OCCUPANCY_SHIFT
    case 'multigenerational':     return OCCUPANCY_MULTIGENERATIONAL
    case 'bath_heavy':            return OCCUPANCY_BATH_HEAVY
    case 'shower_heavy':          return OCCUPANCY_SHOWER_HEAVY
    case 'weekend_heavy':         return OCCUPANCY_WEEKEND_HEAVY
    default:                      return undefined
  }
}

function getOccupancyTable(profile: OccupancyProfile): OccupancyTable {
  switch (profile) {
    case 'professional': return OCCUPANCY_PROFESSIONAL
    case 'steady_home':  return OCCUPANCY_STEADY_HOME
    case 'family':       return OCCUPANCY_FAMILY
    case 'shift':        return OCCUPANCY_SHIFT
  }
}

/**
 * Resolve the best occupancy table, preferring a per-preset table when
 * `demandPreset` is available, falling back to the generic 4-profile table.
 */
function resolveOccupancyTable(
  profile: OccupancyProfile,
  demandPreset?: DemandPresetId,
): OccupancyTable {
  if (demandPreset != null) {
    const presetTable = getOccupancyTableForPreset(demandPreset)
    if (presetTable != null) return presetTable
  }
  return getOccupancyTable(profile)
}

/**
 * Return the demand state for the given hour and occupancy profile.
 * @param hour  Integer 0–23.
 */
function getOccupancyDemand(hour: number, profile: OccupancyProfile, demandPreset?: DemandPresetId): OccupancyHour {
  const table = resolveOccupancyTable(profile, demandPreset)
  return table[Math.max(0, Math.min(23, hour))] ?? table[0]
}

/**
 * Build a sim-time label in "HH:00 · <label>" format.
 */
function occupancyPhaseLabel(hour: number, label: string): string {
  return `${String(hour).padStart(2, '0')}:00 · ${label}`
}

/**
 * Compute the cylinder fill level at a given hour for an occupancy profile.
 *
 * Deterministic: simulates cumulative draw/reheat from midnight to the given hour.
 * Starts at 0.85 (overnight full). Each hot-draw hour depletes by 0.08; each
 * heating-only hour reheats by 0.04.  Clamped to [0.15, 0.90].
 *
 * No React state is required — the fill level is a pure function of the hour
 * and profile, avoiding the need to call setState synchronously in an effect.
 */
function computeOccupancyCylinderFill(hour: number, profile: OccupancyProfile, demandPreset?: DemandPresetId): number {
  const table = resolveOccupancyTable(profile, demandPreset)
  let fill = 0.85
  for (let h = 0; h <= Math.min(hour, 23); h++) {
    const demand = table[h] ?? table[0]
    if (demand.hotDrawActive) {
      fill = Math.max(0.15, fill - 0.08)
    } else if (demand.heatingEnabled) {
      fill = Math.min(0.90, fill + 0.04)
    }
  }
  return fill
}

/**
 * Build a SystemDiagramDisplayState from the occupancy demand at the current
 * simulated hour.
 */
function buildOccupancyAutoState(
  choice: SimulatorSystemChoice,
  hour: number,
  profile: OccupancyProfile,
  demandPreset?: DemandPresetId,
): SystemDiagramDisplayState {
  const demand = getOccupancyDemand(hour, profile, demandPreset)
  const { heatingEnabled, hotDrawActive, label } = demand
  const phaseLabel = occupancyPhaseLabel(hour, label)
  const cylinderFill = computeOccupancyCylinderFill(hour, profile, demandPreset)

  switch (choice) {
    case 'combi': {
      const returnTempC = hotDrawActive ? 52 : heatingEnabled ? 43 : 45
      return buildCombiState({ heatingEnabled, hotDrawActive, returnTempC, phaseLabel })
    }
    case 'unvented': {
      const storeNeedsReheat = cylinderFill < 0.5
      const returnTempC = heatingEnabled ? 44 : 46
      return buildStoredState(
        { heatingEnabled, storeNeedsReheat, hotDrawActive, returnTempC, cylinderFillPct: cylinderFill, phaseLabel },
        'unvented_cylinder',
      )
    }
    case 'open_vented': {
      const storeNeedsReheat = cylinderFill < 0.5
      const returnTempC = heatingEnabled ? 44 : 46
      return buildStoredState(
        { heatingEnabled, storeNeedsReheat, hotDrawActive, returnTempC, cylinderFillPct: cylinderFill, phaseLabel },
        'vented_cylinder',
      )
    }
    case 'heat_pump': {
      const storeNeedsReheat = cylinderFill < 0.5
      const mode = resolveServiceMode({
        isCombi: false, hotDrawActive, heatingEnabled,
        hasStored: true, storeNeedsReheat, isSPlan: true,
      })
      const cop = heatingEnabled ? 3.3 : 3.0
      return {
        systemMode: mode,
        systemType: 'unvented_cylinder',
        heatSourceType: 'heat_pump',
        serviceSwitchingActive: false,
        supplyOrigins: supplyOriginsForSystemType('unvented_cylinder', { isHeatPump: true }),
        hotDrawActive, cylinderFillPct: cylinderFill, cop, phaseLabel,
        outletDemands: { shower: hotDrawActive, bath: false, kitchen: false, coldTap: false },
      }
    }
    case 'mixergy': {
      const storeNeedsReheat = cylinderFill < 0.5
      const returnTempC = heatingEnabled ? 44 : 46
      return {
        ...buildStoredState(
          { heatingEnabled, storeNeedsReheat, hotDrawActive, returnTempC, cylinderFillPct: cylinderFill, phaseLabel },
          'unvented_cylinder',
        ),
        cylinderVariant: 'mixergy',
      }
    }
  }
}

function buildCombiState(phase: CombiPhase): SystemDiagramDisplayState {
  const systemType: SystemType = 'combi'
  const heatSourceType: HeatSourceType = 'combi'
  const mode = resolveServiceMode({
    isCombi: true,
    hotDrawActive: phase.hotDrawActive,
    heatingEnabled: phase.heatingEnabled,
    // Combi boilers have no thermal store; hasStored / storeNeedsReheat / isSPlan
    // must be false so the arbitration logic never enters the stored-system branch.
    hasStored: false,
    storeNeedsReheat: false,
    isSPlan: false,
  })
  const serviceSwitchingActive = computeServiceSwitchingActive({
    isCombi: true,
    mode,
    heatingEnabled: phase.heatingEnabled,
  })
  return {
    systemMode: mode,
    systemType,
    heatSourceType,
    serviceSwitchingActive,
    supplyOrigins: supplyOriginsForSystemType(systemType),
    condensingState: deriveCondensingState(phase.returnTempC),
    returnTempC: phase.returnTempC,
    hotDrawActive: phase.hotDrawActive,
    phaseLabel: phase.phaseLabel,
    outletDemands: {
      shower: phase.hotDrawActive,
      bath: false,
      kitchen: false,
      coldTap: false,
    },
  }
}

function buildStoredState(
  phase: StoredPhase,
  systemType: 'unvented_cylinder' | 'vented_cylinder',
): SystemDiagramDisplayState {
  const heatSourceType: HeatSourceType = 'system_boiler'
  const mode = resolveServiceMode({
    isCombi: false,
    hotDrawActive: phase.hotDrawActive,
    heatingEnabled: phase.heatingEnabled,
    hasStored: true,
    storeNeedsReheat: phase.storeNeedsReheat,
    // S-plan for unvented; Y-plan (not S-plan) for vented
    isSPlan: systemType === 'unvented_cylinder',
  })
  return {
    systemMode: mode,
    systemType,
    heatSourceType,
    serviceSwitchingActive: false, // always false for stored
    supplyOrigins: supplyOriginsForSystemType(systemType),
    condensingState: deriveCondensingState(phase.returnTempC),
    returnTempC: phase.returnTempC,
    hotDrawActive: phase.hotDrawActive,
    cylinderFillPct: phase.cylinderFillPct,
    cylinderVariant: 'standard',
    phaseLabel: phase.phaseLabel,
    outletDemands: {
      shower: phase.hotDrawActive,
      bath: phase.hotDrawActive,
      kitchen: false,
      coldTap: false,
    },
  }
}

function buildHeatPumpState(phase: HeatPumpPhase): SystemDiagramDisplayState {
  // Heat pump with unvented cylinder — primary loop, no plate HEX, no condensing.
  const systemType: SystemType = 'unvented_cylinder'
  const heatSourceType: HeatSourceType = 'heat_pump'
  const mode = resolveServiceMode({
    isCombi: false,
    hotDrawActive: phase.hotDrawActive,
    heatingEnabled: phase.heatingEnabled,
    hasStored: true,
    storeNeedsReheat: phase.storeNeedsReheat,
    isSPlan: true,
  })
  return {
    systemMode: mode,
    systemType,
    heatSourceType,
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType(systemType, { isHeatPump: true }),
    // No condensingState — heat pumps do not condense like gas boilers.
    hotDrawActive: phase.hotDrawActive,
    cylinderFillPct: phase.cylinderFillPct,
    cop: phase.copEstimate,
    phaseLabel: phase.phaseLabel,
    outletDemands: {
      shower: phase.hotDrawActive,
      bath: false,
      kitchen: false,
      coldTap: false,
    },
  }
}

// ─── Manual demand overrides ──────────────────────────────────────────────────

/** Manual-mode COP for heating-active heat pump. */
const MANUAL_HP_COP_HEATING = 3.3
/** Manual-mode COP for standby/reheat-only heat pump. */
const MANUAL_HP_COP_STANDBY = 3.1

/**
 * Build a SystemDiagramDisplayState from explicit user demand controls.
 * Used when the user has taken manual control (isManualMode === true).
 */
function buildManualState(
  systemChoice: SimulatorSystemChoice,
  demand: DemandControls,
  cylinderFillRef: number,
): SystemDiagramDisplayState {
  const hotDrawActive = demand.shower || demand.bath || demand.kitchen

  switch (systemChoice) {
    case 'combi': {
      const mode = resolveServiceMode({
        isCombi: true,
        hotDrawActive,
        heatingEnabled: demand.heatingEnabled,
        hasStored: false,
        storeNeedsReheat: false,
        isSPlan: false,
      })
      const serviceSwitchingActive = computeServiceSwitchingActive({
        isCombi: true,
        mode,
        heatingEnabled: demand.heatingEnabled,
      })
      const returnTempC = hotDrawActive ? 52 : demand.heatingEnabled ? 44 : 47
      const phaseLabel = mode === 'dhw_draw' ? 'On-demand hot water'
        : mode === 'heating' ? 'Heating' : 'Standby'
      return {
        systemMode: mode,
        systemType: 'combi',
        heatSourceType: 'combi',
        serviceSwitchingActive,
        supplyOrigins: supplyOriginsForSystemType('combi'),
        condensingState: deriveCondensingState(returnTempC),
        returnTempC,
        hotDrawActive,
        phaseLabel,
        outletDemands: {
          shower: demand.shower,
          bath: demand.bath,
          kitchen: demand.kitchen,
          coldTap: demand.coldTap,
        },
      }
    }
    case 'unvented': {
      const storeNeedsReheat = cylinderFillRef < 0.5
      const mode = resolveServiceMode({
        isCombi: false, hotDrawActive, heatingEnabled: demand.heatingEnabled,
        hasStored: true, storeNeedsReheat, isSPlan: true,
      })
      const returnTempC = demand.heatingEnabled ? 44 : 46
      const phaseLabel = mode === 'heating_and_reheat' ? 'CH + reheat'
        : mode === 'dhw_reheat' ? 'Reheat only'
        : mode === 'heating' ? 'Heating'
        : hotDrawActive ? 'Stored DHW draw' : 'Standby'
      return {
        systemMode: mode, systemType: 'unvented_cylinder', heatSourceType: 'system_boiler',
        serviceSwitchingActive: false,
        supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
        condensingState: deriveCondensingState(returnTempC), returnTempC,
        hotDrawActive, cylinderFillPct: cylinderFillRef, cylinderVariant: 'standard', phaseLabel,
        outletDemands: {
          shower: demand.shower,
          bath: demand.bath,
          kitchen: demand.kitchen,
          coldTap: demand.coldTap,
        },
      }
    }
    case 'open_vented': {
      const storeNeedsReheat = cylinderFillRef < 0.5
      const mode = resolveServiceMode({
        isCombi: false, hotDrawActive, heatingEnabled: demand.heatingEnabled,
        hasStored: true, storeNeedsReheat, isSPlan: false,
      })
      const returnTempC = demand.heatingEnabled ? 44 : 46
      const phaseLabel = mode === 'dhw_reheat' ? 'Reheat only'
        : mode === 'heating' ? 'Heating'
        : hotDrawActive ? 'Stored DHW draw' : 'Standby'
      return {
        systemMode: mode, systemType: 'vented_cylinder', heatSourceType: 'system_boiler',
        serviceSwitchingActive: false,
        supplyOrigins: supplyOriginsForSystemType('vented_cylinder'),
        condensingState: deriveCondensingState(returnTempC), returnTempC,
        hotDrawActive, cylinderFillPct: cylinderFillRef, cylinderVariant: 'standard', phaseLabel,
        outletDemands: {
          shower: demand.shower,
          bath: demand.bath,
          kitchen: demand.kitchen,
          coldTap: demand.coldTap,
        },
      }
    }
    case 'heat_pump': {
      const storeNeedsReheat = cylinderFillRef < 0.5
      const mode = resolveServiceMode({
        isCombi: false, hotDrawActive, heatingEnabled: demand.heatingEnabled,
        hasStored: true, storeNeedsReheat, isSPlan: true,
      })
      const phaseLabel = mode === 'heating_and_reheat' ? 'CH + reheat'
        : mode === 'dhw_reheat' ? 'Reheat only'
        : mode === 'heating' ? 'Heating'
        : hotDrawActive ? 'Stored DHW draw' : 'Standby'
      const cop = demand.heatingEnabled ? MANUAL_HP_COP_HEATING : MANUAL_HP_COP_STANDBY
      return {
        systemMode: mode, systemType: 'unvented_cylinder', heatSourceType: 'heat_pump',
        serviceSwitchingActive: false,
        supplyOrigins: supplyOriginsForSystemType('unvented_cylinder', { isHeatPump: true }),
        hotDrawActive, cylinderFillPct: cylinderFillRef, cop, phaseLabel,
        outletDemands: {
          shower: demand.shower,
          bath: demand.bath,
          kitchen: demand.kitchen,
          coldTap: demand.coldTap,
        },
      }
    }
    case 'mixergy': {
      const storeNeedsReheat = cylinderFillRef < 0.5
      const mode = resolveServiceMode({
        isCombi: false, hotDrawActive, heatingEnabled: demand.heatingEnabled,
        hasStored: true, storeNeedsReheat, isSPlan: true,
      })
      const returnTempC = demand.heatingEnabled ? 44 : 46
      const phaseLabel = mode === 'heating_and_reheat' ? 'CH + reheat'
        : mode === 'dhw_reheat' ? 'Reheat only'
        : mode === 'heating' ? 'Heating'
        : hotDrawActive ? 'Stored DHW draw' : 'Standby'
      return {
        systemMode: mode, systemType: 'unvented_cylinder', heatSourceType: 'system_boiler',
        serviceSwitchingActive: false,
        supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
        condensingState: deriveCondensingState(returnTempC), returnTempC,
        hotDrawActive, cylinderFillPct: cylinderFillRef, cylinderVariant: 'mixergy', phaseLabel,
        outletDemands: {
          shower: demand.shower,
          bath: demand.bath,
          kitchen: demand.kitchen,
          coldTap: demand.coldTap,
        },
      }
    }
  }
}

// ─── Phase counts per system choice ──────────────────────────────────────────

function phaseCount(choice: SimulatorSystemChoice): number {
  switch (choice) {
    case 'combi':       return COMBI_PHASES.length
    case 'unvented':    return STORED_PHASES.length
    case 'open_vented': return VENTED_PHASES.length
    case 'heat_pump':   return HEAT_PUMP_PHASES.length
    case 'mixergy':     return STORED_PHASES.length
  }
}

function buildAutoState(
  choice: SimulatorSystemChoice,
  phase: number,
): SystemDiagramDisplayState {
  switch (choice) {
    case 'combi':
      return buildCombiState(COMBI_PHASES[phase] ?? COMBI_PHASES[0])
    case 'unvented':
      return buildStoredState(STORED_PHASES[phase] ?? STORED_PHASES[0], 'unvented_cylinder')
    case 'open_vented':
      return buildStoredState(VENTED_PHASES[phase] ?? VENTED_PHASES[0], 'vented_cylinder')
    case 'heat_pump':
      return buildHeatPumpState(HEAT_PUMP_PHASES[phase] ?? HEAT_PUMP_PHASES[0])
    case 'mixergy':
      return buildStoredState(STORED_PHASES[phase] ?? STORED_PHASES[0], 'unvented_cylinder')
  }
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export type UseSystemDiagramPlaybackResult = {
  state: SystemDiagramDisplayState
  /** The currently selected UI system choice. */
  systemChoice: SimulatorSystemChoice
  setSystemChoice: (c: SimulatorSystemChoice) => void
  /** User demand controls (manual mode). */
  demandControls: DemandControls
  setDemandControls: (partial: Partial<DemandControls>) => void
  /** True when user has overridden the auto-cycling demo phases. */
  isManualMode: boolean
  /** Return to the automatic cycling demo. */
  resetToAutoMode: () => void
  /** Force manual mode without changing demand values. */
  setManualMode: () => void
  /**
   * Current simulated hour of the day (0–23).
   * Advances independently of the demo-phase cycle.
   * Used by DayTimelinePanel and, when an occupancy profile is active, to
   * drive the occupancy-aware demo phases.
   */
  simHour: number
  // ── Legacy fields preserved for backward compatibility ───────────────────
  /** @deprecated Use systemChoice instead. Kept for panel prop compatibility. */
  systemType: SystemType
  /** @deprecated Use setSystemChoice instead. */
  setSystemType: (t: SystemType) => void
}

/** Simulated start hour — 06:00 so the demo begins at a natural point in the day. */
const DEFAULT_SIM_START_HOUR = 6

/**
 * Real-time interval per simulated hour, at 1× speed.
 *
 * At 1× speed a full 24-hour day completes in 24 × 6 = 144 s ≈ 2.4 min.
 * The 500 ms floor (same as the phase cycle floor) prevents over-fast
 * cycling at very high speed multipliers.
 */
const SIM_HOUR_INTERVAL_MS = 6_000

const DEFAULT_DEMAND: DemandControls = {
  heatingEnabled: true,
  shower: false,
  bath: false,
  kitchen: false,
  coldTap: false,
}

export function useSystemDiagramPlayback(
  initialSystemChoice: SimulatorSystemChoice = 'combi',
  timeSpeedMultiplier: number = 1,
  occupancyProfile?: OccupancyProfile,
  demandPreset?: DemandPresetId,
): UseSystemDiagramPlaybackResult {
  const [systemChoice, setSystemChoiceState] = useState<SimulatorSystemChoice>(initialSystemChoice)
  const [phase, setPhase] = useState(0)
  const [isManualMode, setIsManualMode] = useState(false)
  const [demandControls, setDemandControlsState] = useState<DemandControls>(DEFAULT_DEMAND)
  // Track cylinder fill separately for manual-mode continuity.
  const [cylinderFillRef, setCylinderFillRef] = useState(0.70)
  // Simulated hour of day (0–23) for the 24-hour timeline and occupancy-aware demo.
  const [simHour, setSimHour] = useState(DEFAULT_SIM_START_HOUR)

  const setSystemChoice = useCallback((c: SimulatorSystemChoice) => {
    setSystemChoiceState(c)
    setPhase(0)
    setIsManualMode(false)
    setDemandControlsState(DEFAULT_DEMAND)
    setSimHour(DEFAULT_SIM_START_HOUR)
  }, [])

  const setDemandControls = useCallback((partial: Partial<DemandControls>) => {
    setDemandControlsState(prev => {
      const next = { ...prev, ...partial }
      return next
    })
    setIsManualMode(true)
  }, [])

  const resetToAutoMode = useCallback(() => {
    setIsManualMode(false)
    setPhase(0)
    setSimHour(DEFAULT_SIM_START_HOUR)
  }, [])

  const setManualMode = useCallback(() => {
    setIsManualMode(true)
  }, [])

  // Auto-cycle when in demo mode (generic phases, used when no occupancyProfile).
  useEffect(() => {
    if (isManualMode || occupancyProfile !== undefined) return
    const count = phaseCount(systemChoice)
    const intervalMs = Math.max(500, Math.round(PHASE_DURATION_MS / Math.max(0.1, timeSpeedMultiplier)))
    const timer = setInterval(() => {
      setPhase(prev => {
        const next = (prev + 1) % count
        // Sync cylinderFillRef from auto phase for smooth manual transitions.
        const autoState = buildAutoState(systemChoice, next)
        if (autoState.cylinderFillPct !== undefined) {
          setCylinderFillRef(autoState.cylinderFillPct)
        }
        return next
      })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [systemChoice, isManualMode, occupancyProfile, timeSpeedMultiplier])

  // Advance simulated hour (0–23) independently of the demo-phase cycle.
  // Pauses in manual mode so the timeline reflects the last auto position.
  useEffect(() => {
    if (isManualMode) return
    const intervalMs = Math.max(500, Math.round(SIM_HOUR_INTERVAL_MS / Math.max(0.1, timeSpeedMultiplier)))
    const timer = setInterval(() => {
      setSimHour(prev => (prev + 1) % 24)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isManualMode, timeSpeedMultiplier])

  const state: SystemDiagramDisplayState = isManualMode
    ? buildManualState(systemChoice, demandControls, cylinderFillRef)
    : occupancyProfile !== undefined
    ? buildOccupancyAutoState(systemChoice, simHour, occupancyProfile, demandPreset)
    : buildAutoState(systemChoice, phase)

  // ── Legacy compatibility shim ────────────────────────────────────────────
  const systemType: SystemType =
    systemChoice === 'combi'       ? 'combi'
    : systemChoice === 'open_vented' ? 'vented_cylinder'
    : 'unvented_cylinder'

  const setSystemType = useCallback((t: SystemType) => {
    const choice: SimulatorSystemChoice =
      t === 'combi'            ? 'combi'
      : t === 'vented_cylinder'  ? 'open_vented'
      : 'unvented'
    setSystemChoice(choice)
  }, [setSystemChoice])

  return {
    state,
    systemChoice,
    setSystemChoice,
    demandControls,
    setDemandControls,
    isManualMode,
    resetToAutoMode,
    setManualMode,
    simHour,
    systemType,
    setSystemType,
  }
}

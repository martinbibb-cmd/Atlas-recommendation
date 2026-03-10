// src/explainers/lego/simulator/useHousePlayback.ts
//
// Display adapter that turns SystemDiagramDisplayState into per-room and
// building-level state for the HouseStatusPanel.
//
// Guarantees:
//   - No Math.random() — all transitions are deterministic.
//   - No second simulator — this is a pure display model derived from
//     authoritative SystemDiagramDisplayState produced by useSystemDiagramPlayback.
//   - Indoor temperature is animated using the exponential decay formula
//     T(t) = T_outdoor + (T_current − T_outdoor) × e^(−Δt/τ) for cooling
//     and an asymptotic rise toward the setpoint for heating.
//   - DEFAULT_DEMO_TAU_HOURS from thermal.ts is used for the demo fallback.

import { useState, useEffect } from 'react'
import type { SystemDiagramDisplayState } from './useSystemDiagramPlayback'
import { DEFAULT_DEMO_TAU_HOURS } from '../animation/thermal'

// ─── Public types ─────────────────────────────────────────────────────────────

export type RoomHeatState = 'heating_active' | 'warming' | 'stable' | 'cooling'

export type RoomDisplayState = {
  name: string
  /** Whether this room has an emitter (radiator / towel rail). */
  hasEmitter: boolean
  /** True when this room's emitter is currently energised. */
  emitterActive: boolean
  /** Thermal display state of the room. */
  state: RoomHeatState
}

export type FloorDisplayState = {
  key: string
  label: string
  /** CSS class applied to the floor band. */
  className: string
  rooms: RoomDisplayState[]
}

export type HouseDisplayState = {
  floors: FloorDisplayState[]
  /** Estimated indoor temperature (°C). */
  indoorTempC: number
  /** One-line building status shown in the status bar. */
  statusLabel: string
  /** True when combi CH has been suppressed for a DHW draw. */
  chPaused: boolean
}

// ─── Room catalogue ───────────────────────────────────────────────────────────

/**
 * Static room catalogue.  `hasEmitter` reflects real domestic practice:
 * kitchens, lounges, and bedrooms have radiators; lofts and gardens do not.
 * Bathrooms have towel rails (treated as emitters).
 */
type RoomCatalogue = {
  name: string
  hasEmitter: boolean
}

const FLOOR_CATALOGUE: Array<{
  key: string
  label: string
  className: string
  rooms: RoomCatalogue[]
}> = [
  {
    key: 'loft',
    label: 'Loft',
    className: 'house-floor--loft',
    rooms: [
      { name: 'Loft space',      hasEmitter: false },
      { name: 'Airing cupboard', hasEmitter: false },
    ],
  },
  {
    key: 'first',
    label: 'First floor',
    className: 'house-floor--first',
    rooms: [
      { name: 'Bedroom 1', hasEmitter: true  },
      { name: 'Bedroom 2', hasEmitter: true  },
      { name: 'Bathroom',  hasEmitter: true  }, // towel rail
    ],
  },
  {
    key: 'ground',
    label: 'Ground floor',
    className: 'house-floor--ground',
    rooms: [
      { name: 'Kitchen',       hasEmitter: true  },
      { name: 'Lounge',        hasEmitter: true  },
      { name: 'Bathroom / WC', hasEmitter: true  }, // downstairs WC towel rail
    ],
  },
  {
    key: 'outside',
    label: 'Outside',
    className: 'house-floor--outside',
    rooms: [
      { name: 'Garden / external', hasEmitter: false },
    ],
  },
]

// ─── Thermal constants ────────────────────────────────────────────────────────

/** Outdoor ambient for demo — mid-winter UK. */
const T_OUTDOOR_C = 5

/** Thermostat setpoint. */
const T_SETPOINT_C = 20

/**
 * Demo start temperature — realistic "been off for a while" start.
 * Enough below setpoint to show visible warming when CH kicks in.
 */
const T_INITIAL_C = 16.5

/**
 * Time-acceleration factor for the demo: 1 real second represents this many
 * simulated seconds of building-physics time.  At 3600× the 42-hour τ maps
 * to a 42-second demo τ, which gives clearly visible temperature movement
 * across the ~22-second demo cycle without feeling artificially fast.
 */
const DEMO_TIME_ACCELERATION = 3_600

/** Heating τ in real seconds (demo-accelerated). */
const TAU_HEAT_S = (DEFAULT_DEMO_TAU_HOURS * 3_600) / DEMO_TIME_ACCELERATION // ≈ 42 s

/** Cooling τ in real seconds (demo-accelerated). */
const TAU_COOL_S = (DEFAULT_DEMO_TAU_HOURS * 3_600) / DEMO_TIME_ACCELERATION // ≈ 42 s

/** How often the indoor-temperature simulation ticks (ms). */
const TICK_MS = 500

// ─── Helper: derive room state ────────────────────────────────────────────────

function deriveRoomState(
  hasEmitter: boolean,
  emitterActive: boolean,
  warmthFactor: number,
): RoomHeatState {
  if (hasEmitter && emitterActive) return 'heating_active'
  if (warmthFactor > 0.7)         return 'warming'
  if (warmthFactor > 0.35)        return 'stable'
  return 'cooling'
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export function useHousePlayback(
  diagramState: SystemDiagramDisplayState,
): HouseDisplayState {
  const [indoorTempC, setIndoorTempC] = useState(T_INITIAL_C)
  // warmthFactor: 0 = cold building, 1 = fully heated
  const [warmthFactor, setWarmthFactor] = useState(
    (T_INITIAL_C - T_OUTDOOR_C) / (T_SETPOINT_C - T_OUTDOOR_C),
  )

  const chActive =
    (diagramState.systemMode === 'heating' ||
      diagramState.systemMode === 'heating_and_reheat') &&
    !diagramState.serviceSwitchingActive

  const chPaused = diagramState.serviceSwitchingActive

  // ── Tick: advance the indoor temperature simulation ─────────────────────
  useEffect(() => {
    const dt = TICK_MS / 1_000 // seconds per tick

    const timer = setInterval(() => {
      setIndoorTempC(prev => {
        if (chActive) {
          // Asymptotic rise toward setpoint using τ_heat.
          // Equivalent to: T + (T_setpoint - T) × (1 − e^(−dt/τ))
          // which for small dt ≈ (T_setpoint - T) × dt/τ
          const delta = (T_SETPOINT_C - prev) * (1 - Math.exp(-dt / TAU_HEAT_S))
          return prev + delta
        } else {
          // Exponential decay toward outdoor: T(t) = T_outdoor + (T_current − T_outdoor) × e^(−dt/τ)
          return T_OUTDOOR_C + (prev - T_OUTDOOR_C) * Math.exp(-dt / TAU_COOL_S)
        }
      })

      setWarmthFactor(prev => {
        if (chActive) {
          const delta = (1 - prev) * (1 - Math.exp(-dt / TAU_HEAT_S))
          return Math.min(1, prev + delta)
        } else {
          return Math.max(0, prev * Math.exp(-dt / TAU_COOL_S))
        }
      })
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [chActive])

  // ── Build display model ──────────────────────────────────────────────────
  const floors: FloorDisplayState[] = FLOOR_CATALOGUE.map(floor => ({
    key:       floor.key,
    label:     floor.label,
    className: floor.className,
    rooms: floor.rooms.map(r => {
      const emitterActive = r.hasEmitter && chActive
      return {
        name:          r.name,
        hasEmitter:    r.hasEmitter,
        emitterActive,
        state:         deriveRoomState(r.hasEmitter, emitterActive, warmthFactor),
      }
    }),
  }))

  // ── Status label ─────────────────────────────────────────────────────────
  let statusLabel: string
  if (chPaused) {
    statusLabel = 'CH paused — on-demand hot water active'
  } else if (chActive) {
    const riseRate = (T_SETPOINT_C - indoorTempC) / (T_SETPOINT_C - T_OUTDOOR_C)
    statusLabel = riseRate > 0.5 ? 'Warming quickly' : 'Warming slowly'
  } else if (warmthFactor > 0.6) {
    statusLabel = 'Stable — holding warmth'
  } else {
    statusLabel = 'Cooling'
  }

  return { floors, indoorTempC, statusLabel, chPaused }
}

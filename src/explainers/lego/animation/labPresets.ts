// src/explainers/lego/animation/labPresets.ts
//
// Ready-made Demo Lab control configurations for cylinder and combi scenarios.
// Each preset is a complete LabControls object that can be loaded directly
// into the Demo Lab animation.

import type { LabControls } from './types'
import { defaultOutlets } from './types'

export type LabPreset = {
  id: string
  label: string
  description: string
  controls: LabControls
}

// ─── Combi — typical autumn ───────────────────────────────────────────────────

const combiTypical: LabPreset = {
  id: 'combi-typical',
  label: 'Combi — 30 kW, 10 °C',
  description: 'On-demand hot water from a 30 kW combi, typical autumn cold inlet.',
  controls: {
    systemType: 'combi',
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: 30,
    mainsDynamicFlowLpm: 16,
    pipeDiameterMm: 15,
    outlets: defaultOutlets(),
  },
}

// ─── Unvented cylinder — 180 L ───────────────────────────────────────────────

const unventedCylinder180: LabPreset = {
  id: 'unvented-180',
  label: 'Unvented cylinder — 180 L',
  description: 'Mains-fed unvented cylinder, 180 L at 55 °C with 12 kW reheat. Shows drawdown and recovery.',
  controls: {
    systemType: 'unvented_cylinder',
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: 30,
    mainsDynamicFlowLpm: 18,
    pipeDiameterMm: 22,
    cylinder: {
      volumeL: 180,
      initialTempC: 55,
      reheatKw: 12,
    },
    outlets: defaultOutlets(),
  },
}

// ─── Vented cylinder — 180 L ─────────────────────────────────────────────────

const ventedCylinder180: LabPreset = {
  id: 'vented-180',
  label: 'Vented cylinder — 180 L, 3 m head',
  description: 'Tank-fed vented cylinder, 180 L at 55 °C, 3 m head. Weaker pressure than unvented.',
  controls: {
    systemType: 'vented_cylinder',
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: 30,
    mainsDynamicFlowLpm: 18,
    pipeDiameterMm: 15,
    cylinder: {
      volumeL: 180,
      initialTempC: 55,
      reheatKw: 12,
    },
    vented: {
      headMeters: 3,
    },
    outlets: defaultOutlets(),
  },
}

// ─── Bath draw — unvented drawdown scenario ───────────────────────────────────

const bathDrawUnvented: LabPreset = {
  id: 'bath-draw-unvented',
  label: 'Bath draw — unvented cylinder',
  description: 'Unvented 180 L cylinder with bath outlet open (18 L/min). Watch the store cool and reheat.',
  controls: {
    systemType: 'unvented_cylinder',
    coldInletC: 10,
    dhwSetpointC: 50,
    combiDhwKw: 30,
    mainsDynamicFlowLpm: 18,
    pipeDiameterMm: 22,
    cylinder: {
      volumeL: 180,
      initialTempC: 55,
      reheatKw: 12,
    },
    outlets: [
      { id: 'A', enabled: false, kind: 'shower_mixer', demandLpm: 10 },
      { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
      { id: 'C', enabled: true,  kind: 'bath',         demandLpm: 18 },
    ],
  },
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const LAB_PRESETS: LabPreset[] = [
  combiTypical,
  unventedCylinder180,
  ventedCylinder180,
  bathDrawUnvented,
]

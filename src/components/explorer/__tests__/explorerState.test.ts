/**
 * explorerState.test.ts
 *
 * Validates the ExplorerSelection discriminated union:
 *   - All layer variants carry exactly the fields they need
 *   - Exhaustive narrowing works correctly via layer checks
 *   - No shared optional fields float across variants
 */

import { describe, it, expect } from 'vitest';
import type { ExplorerSelection } from '../explorerTypes';

describe('ExplorerSelection discriminated union', () => {
  it('house layer carries no extra IDs', () => {
    const s: ExplorerSelection = { layer: 'house' };
    expect(s.layer).toBe('house');
    // TypeScript would reject roomId/emitterId here — confirmed at compile time
  });

  it('room layer carries exactly roomId', () => {
    const s: ExplorerSelection = { layer: 'room', roomId: 'living' };
    expect(s.layer).toBe('room');
    if (s.layer === 'room') {
      expect(s.roomId).toBe('living');
    }
  });

  it('emitter layer carries roomId and emitterId', () => {
    const s: ExplorerSelection = { layer: 'emitter', roomId: 'living', emitterId: 'rad-living' };
    expect(s.layer).toBe('emitter');
    if (s.layer === 'emitter') {
      expect(s.roomId).toBe('living');
      expect(s.emitterId).toBe('rad-living');
    }
  });

  it('hydraulic layer carries roomId, emitterId and pipeIds', () => {
    const s: ExplorerSelection = {
      layer: 'hydraulic',
      roomId: 'living',
      emitterId: 'rad-living',
      pipeIds: ['pipe-living-flow', 'pipe-living-return'],
    };
    expect(s.layer).toBe('hydraulic');
    if (s.layer === 'hydraulic') {
      expect(s.roomId).toBe('living');
      expect(s.emitterId).toBe('rad-living');
      expect(s.pipeIds).toHaveLength(2);
    }
  });

  it('heatSource layer carries boilerId', () => {
    const s: ExplorerSelection = { layer: 'heatSource', boilerId: 'primary' };
    expect(s.layer).toBe('heatSource');
    if (s.layer === 'heatSource') {
      expect(s.boilerId).toBe('primary');
    }
  });

  it('physics layer allows optional roomId', () => {
    const withRoom: ExplorerSelection = { layer: 'physics', roomId: 'bedroom1' };
    const withoutRoom: ExplorerSelection = { layer: 'physics' };
    expect(withRoom.layer).toBe('physics');
    if (withRoom.layer === 'physics') {
      expect(withRoom.roomId).toBe('bedroom1');
    }
    expect(withoutRoom.layer).toBe('physics');
    if (withoutRoom.layer === 'physics') {
      expect(withoutRoom.roomId).toBeUndefined();
    }
  });

  it('discriminant narrowing correctly extracts roomId only when present', () => {
    const states: ExplorerSelection[] = [
      { layer: 'house' },
      { layer: 'room', roomId: 'kitchen' },
      { layer: 'emitter', roomId: 'kitchen', emitterId: 'rad-kitchen' },
      { layer: 'heatSource', boilerId: 'primary' },
    ];

    const roomIds = states.map(s => ('roomId' in s ? s.roomId : undefined));
    expect(roomIds).toEqual([undefined, 'kitchen', 'kitchen', undefined]);
  });
});

describe('ExplorerSelection — layer progression safety', () => {
  it('each layer variant can be assigned to ExplorerSelection type', () => {
    const all: ExplorerSelection[] = [
      { layer: 'house' },
      { layer: 'room', roomId: 'hallway' },
      { layer: 'emitter', roomId: 'hallway', emitterId: 'rad-hallway' },
      { layer: 'hydraulic', roomId: 'hallway', emitterId: 'rad-hallway', pipeIds: [] },
      { layer: 'heatSource', boilerId: 'primary' },
      { layer: 'physics' },
    ];
    expect(all).toHaveLength(6);
    expect(all.map(s => s.layer)).toEqual([
      'house', 'room', 'emitter', 'hydraulic', 'heatSource', 'physics',
    ]);
  });
});

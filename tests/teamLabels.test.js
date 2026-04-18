import { describe, it, expect } from 'vitest';
import { buildTeamLabelById, teamLabelAtIndex, labelMatchSide } from '../src/domain/teamLabels.js';

describe('teamLabels', () => {
  it('teamLabelAtIndex usa letras A–Z', () => {
    expect(teamLabelAtIndex(0)).toBe('Time A');
    expect(teamLabelAtIndex(25)).toBe('Time Z');
  });

  it('buildTeamLabelById: em campo primeiro, depois aguardando', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const map = buildTeamLabelById([a, b], [c]);
    expect(map).toEqual({
      a: 'Time A',
      b: 'Time B',
      c: 'Time C',
    });
  });

  it('labelMatchSide: lado A/B do placar, não FIFO', () => {
    const byId = {
      x: { id: 'x', displayName: '', players: [1, 2, 3] },
      y: { id: 'y', displayName: 'Verde', players: [4] },
    };
    expect(labelMatchSide('x', 'A', byId)).toBe('Time A (3 jog.)');
    expect(labelMatchSide('y', 'B', byId)).toBe('Verde (Time B)');
  });
});

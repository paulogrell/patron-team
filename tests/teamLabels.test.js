import { describe, it, expect } from 'vitest';
import { buildTeamLabelById, teamLabelAtIndex } from '../src/domain/teamLabels.js';

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
});

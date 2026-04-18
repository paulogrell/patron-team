import { describe, it, expect } from 'vitest';
import { validateMatchPlayerStats, validatePlayerStatLine } from '../src/domain/playerStatRules.js';

describe('playerStatRules', () => {
  it('rejeita assistências acima dos gols do time', () => {
    const teamId = 't1';
    const lines = [
      {
        playerId: 'p1',
        teamId,
        goals: 0,
        assists: 1,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
    ];
    const errs = validatePlayerStatLine(lines[0], lines);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('aceita assist quando há gols suficientes no time', () => {
    const teamId = 't1';
    const lines = [
      {
        playerId: 'p1',
        teamId,
        goals: 2,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: 'p2',
        teamId,
        goals: 0,
        assists: 2,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
    ];
    expect(validateMatchPlayerStats(lines)).toHaveLength(0);
  });

  it('rejeita mais de um goleiro externo no mesmo time', () => {
    const teamId = 't1';
    const lines = [
      {
        playerId: 'p1',
        teamId,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: true,
      },
      {
        playerId: 'p2',
        teamId,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: true,
      },
    ];
    expect(
      validateMatchPlayerStats(lines).some((e) => e.includes('goleiro externo'))
    ).toBe(true);
  });
});

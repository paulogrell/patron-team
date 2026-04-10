import { describe, it, expect } from 'vitest';
import { sortWaitingTeamsForRound } from '../src/domain/waitingQueueOrder.js';

const rid = 'r1';
const mkTeam = (id, players, extra = {}) => ({
  id,
  roundId: rid,
  status: 'waiting',
  players,
  createdAt: '2020-01-01T00:00:00.000Z',
  ...extra,
});
const mkPlayer = (id, joinedAt) => ({
  id,
  status: 'available',
  joinedAt,
});

describe('sortWaitingTeamsForRound', () => {
  it('coloca times incompletos por último quando há rosterTargetSize', () => {
    const teams = [
      mkTeam('solo', ['p3'], { enteredWaitingAt: '2019-01-01T00:00:00.000Z' }),
      mkTeam('fullB', ['p6', 'p7', 'p8', 'p9', 'p10'], {
        enteredWaitingAt: '2018-01-01T00:00:00.000Z',
      }),
      mkTeam('fullA', ['p1', 'p2', 'p4', 'p5', 'p11'], {
        enteredWaitingAt: '2017-01-01T00:00:00.000Z',
      }),
    ];
    const players = [
      mkPlayer('p1', '2020-01-01T00:00:00.000Z'),
      mkPlayer('p2', '2020-01-02T00:00:00.000Z'),
      mkPlayer('p3', '2020-01-03T00:00:00.000Z'),
      mkPlayer('p4', '2020-01-04T00:00:00.000Z'),
      mkPlayer('p5', '2020-01-05T00:00:00.000Z'),
      mkPlayer('p6', '2020-02-01T00:00:00.000Z'),
      mkPlayer('p7', '2020-02-02T00:00:00.000Z'),
      mkPlayer('p8', '2020-02-03T00:00:00.000Z'),
      mkPlayer('p9', '2020-02-04T00:00:00.000Z'),
      mkPlayer('p10', '2020-02-05T00:00:00.000Z'),
      mkPlayer('p11', '2020-01-06T00:00:00.000Z'),
    ];
    const sorted = sortWaitingTeamsForRound(teams, rid, players, 5);
    expect(sorted.map((t) => t.id)).toEqual(['fullA', 'fullB', 'solo']);
  });
});

/**
 * Throughput stress: many players + many finalized matches, random outcomes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPlayer,
  getPlayers,
  getTeams,
  getMatches,
  formTeam,
  scheduleMatch,
  finalizeMatch,
  deleteDatabase,
  ensureDefaultActiveRound,
  getActiveRoundId,
} from '../src/api/indexeddb.js';
import {
  mulberry32,
  pickResult,
  seedPlayers,
  playFinalizedMatch,
  assertNoPlayerOnMultipleTeams,
  assertRostersReferenceExistingPlayers,
} from './helpers/stressFactory.js';

beforeEach(async () => {
  await deleteDatabase();
});

describe('stress: throughput', () => {
  it('100 jogadores e 60 partidas finalizadas sem violar integridade de elenco', async () => {
    await ensureDefaultActiveRound();
    const rid = await getActiveRoundId();
    const teamSize = 5;
    const playerCount = 100;
    const matchCount = 60;
    const rng = mulberry32(42);

    await seedPlayers(addPlayer, playerCount, 'ThruP');

    await formTeam(teamSize, rid);
    await formTeam(teamSize, rid);

    for (let i = 0; i < matchCount; i += 1) {
      const result = pickResult(rng);
      await playFinalizedMatch(
        scheduleMatch,
        finalizeMatch,
        getTeams,
        formTeam,
        rid,
        teamSize,
        result
      );
      if (i % 10 === 9) {
        await assertNoPlayerOnMultipleTeams(getTeams);
        await assertRostersReferenceExistingPlayers(getPlayers, getTeams, rid);
      }
    }

    await assertNoPlayerOnMultipleTeams(getTeams);
    await assertRostersReferenceExistingPlayers(getPlayers, getTeams, rid);

    const players = await getPlayers(false);
    expect(players).toHaveLength(playerCount);

    const finalized = (await getMatches(rid)).filter((m) => m.status === 'finalized');
    expect(finalized.length).toBe(matchCount);
  });
});

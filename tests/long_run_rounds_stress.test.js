/**
 * Multi-round stress: isolated rounds, many matches each.
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
  createRound,
} from '../src/api/indexeddb.js';
import {
  playFinalizedMatch,
  mulberry32,
  pickResult,
  assertNoPlayerOnMultipleTeams,
  assertRostersReferenceExistingPlayers,
} from './helpers/stressFactory.js';

beforeEach(async () => {
  await deleteDatabase();
});

async function runRoundMatches(rid, teamSize, playerPrefix, playerCount, matchCount, seed) {
  for (let i = 1; i <= playerCount; i += 1) {
    await addPlayer(`${playerPrefix}${i}`);
  }
  await formTeam(teamSize, rid);
  await formTeam(teamSize, rid);
  const rng = mulberry32(seed);
  for (let i = 0; i < matchCount; i += 1) {
    await playFinalizedMatch(
      scheduleMatch,
      finalizeMatch,
      getTeams,
      formTeam,
      rid,
      teamSize,
      pickResult(rng)
    );
  }
}

describe('stress: multi-round', () => {
  it('três rodadas com partidas finalizadas e escopo por roundId', async () => {
    await ensureDefaultActiveRound();
    const rid1 = await getActiveRoundId();
    const teamSize = 5;
    const perRoundPlayers = 26;
    const perRoundMatches = 14;

    await runRoundMatches(rid1, teamSize, 'LR1_', perRoundPlayers, perRoundMatches, 11);

    const round2 = await createRound('stress-long-r2');
    const rid2 = round2.id;
    await runRoundMatches(rid2, teamSize, 'LR2_', perRoundPlayers, perRoundMatches, 22);

    const round3 = await createRound('stress-long-r3');
    const rid3 = round3.id;
    await runRoundMatches(rid3, teamSize, 'LR3_', perRoundPlayers, perRoundMatches, 33);

    for (const rid of [rid1, rid2, rid3]) {
      const finalized = (await getMatches(rid)).filter((m) => m.status === 'finalized');
      expect(finalized.length).toBe(perRoundMatches);
      const teams = await getTeams(rid);
      expect(teams.every((t) => t.roundId === rid)).toBe(true);
      await assertRostersReferenceExistingPlayers(getPlayers, getTeams, rid);
    }

    await assertNoPlayerOnMultipleTeams(getTeams);

    const allPlayers = await getPlayers(false);
    expect(allPlayers.length).toBe(perRoundPlayers * 3);

    const sumMatches = (await getMatches(null)).filter((m) => m.status === 'finalized').length;
    expect(sumMatches).toBe(perRoundMatches * 3);
  });
});

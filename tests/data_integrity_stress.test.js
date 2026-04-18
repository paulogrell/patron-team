/**
 * Export / import / maintenance under non-trivial state.
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
  exportData,
  importData,
  deleteDatabase,
  ensureDefaultActiveRound,
  getActiveRoundId,
  openDB,
  runDatastoreMaintenance,
} from '../src/api/indexeddb.js';
import {
  playFinalizedMatch,
  mulberry32,
  pickResult,
  assertNoPlayerOnMultipleTeams,
} from './helpers/stressFactory.js';

beforeEach(async () => {
  await deleteDatabase();
});

describe('stress: data integrity', () => {
  it('export → delete → import preserva contagens e schemaVersion', async () => {
    await ensureDefaultActiveRound();
    const rid = await getActiveRoundId();
    const teamSize = 5;

    for (let i = 1; i <= 32; i += 1) {
      await addPlayer(`DataP${i}`);
    }
    await formTeam(teamSize, rid);
    await formTeam(teamSize, rid);

    const rng = mulberry32(99);
    for (let i = 0; i < 10; i += 1) {
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

    const before = await exportData();
    expect(before.schemaVersion).toBe(3);
    const pCount = before.players.length;
    const mCount = before.matches.length;
    const tCount = before.teams.length;

    await deleteDatabase();
    await importData(before);

    const players = await getPlayers(false);
    const matches = await getMatches(rid);
    const teams = await getTeams(rid);
    expect(players).toHaveLength(pCount);
    expect(matches).toHaveLength(mCount);
    expect(teams).toHaveLength(tCount);

    const again = await exportData();
    expect(again.schemaVersion).toBe(3);
    await assertNoPlayerOnMultipleTeams(getTeams);
  });

  it('manutenção remove player_stats órfã após import', async () => {
    await ensureDefaultActiveRound();
    const rid = await getActiveRoundId();
    const teamSize = 5;

    for (let i = 1; i <= 15; i += 1) {
      await addPlayer(`MaintP${i}`);
    }
    await formTeam(teamSize, rid);
    await formTeam(teamSize, rid);
    await playFinalizedMatch(
      scheduleMatch,
      finalizeMatch,
      getTeams,
      formTeam,
      rid,
      teamSize,
      'A_win'
    );

    const snapshot = await exportData();
    await deleteDatabase();
    await importData(snapshot);

    const fakeMatchId = crypto.randomUUID();
    const allTeams = await getTeams(null);
    expect(allTeams.length).toBeGreaterThan(0);
    const teamRow = allTeams[0];
    const playersAfterImport = await getPlayers(false);
    expect(playersAfterImport.length).toBeGreaterThan(0);
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('player_stats', 'readwrite');
      tx.objectStore('player_stats').add({
        id: crypto.randomUUID(),
        roundId: teamRow.roundId,
        matchId: fakeMatchId,
        teamId: teamRow.id,
        playerId: playersAfterImport[0].id,
        goals: 9,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const summary = await runDatastoreMaintenance();
    expect(summary.removedStats).toBeGreaterThanOrEqual(1);
    await assertNoPlayerOnMultipleTeams(getTeams);
  });
});

/**
 * Testes unitários para a camada IndexedDB.
 *
 * Cobre as operações críticas:
 *   - addPlayer e getPlayers
 *   - formTeam (FIFO e atomicidade)
 *   - removePlayer (com e sem substituição)
 *   - recordMatch (vitória, derrota, empate)
 *   - exportData e importData
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDB,
  closeDB,
  addPlayer,
  getPlayers,
  updatePlayerName,
  updateTeamDisplayName,
  updateTeamRoster,
  formTeam,
  formTeamsForRound,
  removePlayer,
  restorePlayerToAvailable,
  recordMatch,
  getTeams,
  getMatches,
  scheduleMatch,
  updateScheduledMatchTeams,
  cancelScheduledMatch,
  bulkUpsertPlayerStats,
  listPlayerStatsForMatch,
  getMatchScoresForRound,
  exportData,
  importData,
  deleteDatabase,
  ensureDefaultActiveRound,
  getActiveRoundId,
  finalizeMatch,
  getRoundStatistics,
} from '../src/api/indexeddb.js';

async function testRoundId() {
  await ensureDefaultActiveRound();
  return getActiveRoundId();
}

// Limpa o banco antes de cada teste para isolamento
beforeEach(async () => {
  await deleteDatabase();
});

describe('addPlayer e getPlayers', () => {
  it('deve adicionar um jogador com status available', async () => {
    const player = await addPlayer('Carlos');
    expect(player).toBeDefined();
    expect(player.name).toBe('Carlos');
    expect(player.status).toBe('available');
    expect(player.id).toBeDefined();
    expect(player.joinedAt).toBeDefined();
  });

  it('deve rejeitar nome vazio', async () => {
    await expect(addPlayer('')).rejects.toThrow('Nome do jogador é obrigatório.');
  });

  it('deve listar jogadores na ordem FIFO (joinedAt ascendente)', async () => {
    await addPlayer('Alice');
    // Pequeno delay para garantir timestamps diferentes
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('Bruno');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('Carla');

    const players = await getPlayers(true);
    expect(players).toHaveLength(3);
    expect(players[0].name).toBe('Alice');
    expect(players[1].name).toBe('Bruno');
    expect(players[2].name).toBe('Carla');
  });
});

describe('formTeam', () => {
  it('deve formar um time com os N primeiros jogadores disponíveis (FIFO)', async () => {
    const rid = await testRoundId();
    await addPlayer('J1');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J2');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J3');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J4');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J5');

    const team = await formTeam(3, rid);
    expect(team).toBeDefined();
    expect(team.players).toHaveLength(3);
    expect(team.status).toBe('in_field');

    // Verifica que os jogadores selecionados estão em campo
    const players = await getPlayers();
    const inField = players.filter((p) => p.status === 'in_field');
    expect(inField).toHaveLength(3);

    // Verifica FIFO: os 3 primeiros devem ser os selecionados
    const available = players.filter((p) => p.status === 'available');
    expect(available).toHaveLength(2);
  });

  it('deve rejeitar quando há menos disponíveis que o limite do time', async () => {
    const rid = await testRoundId();
    await addPlayer('J1');
    await addPlayer('J2');

    await expect(formTeam(5, rid)).rejects.toThrow(
      'Jogadores insuficientes para formar um time de 5. Necessário: 5, disponível: 2.'
    );

    const teams = await getTeams(rid);
    expect(teams.filter((t) => t.roundId === rid)).toHaveLength(0);
  });

  it('deve rejeitar se não há nenhum jogador disponível', async () => {
    const rid = await testRoundId();
    await expect(formTeam(5, rid)).rejects.toThrow('Nenhum jogador disponível');
  });

  it('deve rejeitar tamanho inválido', async () => {
    const rid = await testRoundId();
    await expect(formTeam(0, rid)).rejects.toThrow('Tamanho do time deve ser maior que zero');
  });

  it('completa o time com fila + jogadores do time waiting (perdedor) até o size', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 10; i += 1) {
      await addPlayer(`P${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const teamA = await formTeam(5, rid);
    const teamB = await formTeam(5, rid);
    await recordMatch(rid, teamA.id, teamB.id, 'A_win');

    await addPlayer('N1');
    await new Promise((r) => setTimeout(r, 3));
    await addPlayer('N2');

    const teamNew = await formTeam(5, rid);
    expect(teamNew.players).toHaveLength(5);
    expect(new Set(teamNew.players)).toEqual(new Set(teamB.players));

    const teamsAfter = await getTeams(rid);
    expect(teamsAfter.find((t) => t.id === teamB.id)).toBeUndefined();

    const nIds = new Set(
      (await getPlayers()).filter((p) => p.name === 'N1' || p.name === 'N2').map((p) => p.id)
    );
    const tookN = teamNew.players.filter((id) => nIds.has(id));
    expect(tookN).toHaveLength(0);
  });

  it('FIFO global: prioriza joinedAt mesmo quando o jogador está só em time waiting', async () => {
    const rid = await testRoundId();
    for (const n of ['A', 'B', 'C', 'D', 'Olivia', 'Mafra']) {
      await addPlayer(n);
      await new Promise((r) => setTimeout(r, 5));
    }
    const players = await getPlayers();
    const byName = Object.fromEntries(players.map((p) => [p.name, p]));
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['teams'], 'readwrite');
      tx.objectStore('teams').add({
        id: crypto.randomUUID(),
        roundId: rid,
        players: [byName.Olivia.id],
        status: 'waiting',
        isBlocked: false,
        createdAt: new Date().toISOString(),
        enteredWaitingAt: new Date().toISOString(),
        waitingOrder: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const teamNew = await formTeam(5, rid);
    const expectFirstFive = ['A', 'B', 'C', 'D', 'Olivia'].map((n) => byName[n].id);
    expect(teamNew.players).toEqual(expectFirstFive);
    expect(teamNew.players).not.toContain(byName.Mafra.id);
  });

  it('com 2 em campo + 1 waiting completo, próximo formTeam forma segundo waiting sem repetir elenco', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 21; i += 1) {
      await addPlayer(`P${i}`);
      await new Promise((r) => setTimeout(r, 2));
    }
    await formTeam(5, rid);
    await formTeam(5, rid);
    const w1 = await formTeam(5, rid);
    expect(w1.status).toBe('waiting');

    const w2 = await formTeam(5, rid);
    expect(w2.status).toBe('waiting');
    const overlap = w1.players.filter((id) => w2.players.includes(id));
    expect(overlap).toHaveLength(0);

    const teams = await getTeams(rid);
    expect(teams.filter((t) => t.status === 'waiting')).toHaveLength(2);
  });

  it('com 1 time em campo e times em waiting, novos formTeam viram waiting', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 20; i += 1) {
      await addPlayer(`P${i}`);
      await new Promise((r) => setTimeout(r, 2));
    }
    const t1 = await formTeam(5, rid);
    const t2 = await formTeam(5, rid);
    const t3 = await formTeam(5, rid);
    expect(t3.status).toBe('waiting');

    await recordMatch(rid, t1.id, t2.id, 'A_win');

    const inFieldAfter = (await getTeams(rid)).filter((t) => t.status === 'in_field');
    expect(inFieldAfter).toHaveLength(1);

    const mid = await formTeam(5, rid);
    expect(mid.status).toBe('waiting');
  });
});

describe('formTeamsForRound', () => {
  it('deve formar múltiplos times na mesma transação', async () => {
    const rid = await testRoundId();
    for (let i = 0; i < 6; i += 1) {
      await addPlayer(`J${i}`);
      await new Promise((r) => setTimeout(r, 5));
    }
    const teams = await formTeamsForRound(rid, 3, 2);
    expect(teams).toHaveLength(2);
    expect(teams[0].players).toHaveLength(3);
    expect(teams[1].players).toHaveLength(3);
    expect(teams[0].roundId).toBe(rid);
  });
});

describe('removePlayer', () => {
  it('deve marcar jogador como lesionado e substituir pelo próximo time na fila', async () => {
    const rid = await testRoundId();
    await addPlayer('João');
    await addPlayer('X1');
    await addPlayer('X2');
    await addPlayer('Rep');
    await addPlayer('Floater');
    await new Promise((r) => setTimeout(r, 5));
    await formTeam(1, rid);
    await formTeam(1, rid);
    const waitingTeam = await formTeam(1, rid);
    expect(waitingTeam.status).toBe('waiting');

    const playersBefore = await getPlayers();
    const victim = playersBefore.find((p) => p.name === 'João');
    expect(victim.status).toBe('in_field');

    const { substituted } = await removePlayer(victim.id, 'injured', false, rid, 1);
    expect(substituted).toBe(true);

    const updated = await getPlayers();
    expect(updated.find((p) => p.id === victim.id).status).toBe('injured');
    const x2 = updated.find((p) => p.name === 'X2');
    expect(x2.status).toBe('in_field');
    const teamsAfter = await getTeams(rid);
    const stillWaiting = teamsAfter.find((t) => t.id === waitingTeam.id);
    expect(stillWaiting).toBeDefined();
    expect(stillWaiting.players).toContain(updated.find((p) => p.name === 'Rep').id);
  });

  it('deve marcar jogador como cansado e substituir pelo próximo time na fila', async () => {
    const rid = await testRoundId();
    await addPlayer('Maria');
    await addPlayer('X');
    await addPlayer('Y');
    await addPlayer('Z');
    await new Promise((r) => setTimeout(r, 5));
    await formTeam(1, rid);
    await formTeam(1, rid);
    await formTeam(1, rid);

    const maria = (await getPlayers()).find((p) => p.name === 'Maria');
    const { substituted } = await removePlayer(maria.id, 'tired', false, rid, 1);
    expect(substituted).toBe(true);

    const players = await getPlayers();
    const tired = players.find((p) => p.id === maria.id);
    expect(tired.status).toBe('tired');
    const y = players.find((p) => p.name === 'Y');
    expect(y.status).toBe('in_field');
    const waitingRoster = (await getTeams(rid)).find((t) => t.status === 'waiting')?.players || [];
    expect(waitingRoster).toContain(players.find((p) => p.name === 'Z').id);
  });

  it('sem time waiting: substitui por jogador disponível na fila global', async () => {
    const rid = await testRoundId();
    for (const name of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'Bench']) {
      await addPlayer(name);
      await new Promise((r) => setTimeout(r, 5));
    }
    await formTeam(3, rid);
    await formTeam(3, rid);

    const teams = await getTeams(rid);
    expect(teams.filter((t) => t.status === 'waiting')).toHaveLength(0);

    const inField = teams.find((t) => t.status === 'in_field');
    const victimId = inField.players[0];
    const { substituted } = await removePlayer(victimId, 'injured', false, rid, 3);
    expect(substituted).toBe(true);

    const players = await getPlayers();
    expect(players.find((p) => p.id === victimId).status).toBe('injured');
    const bench = players.find((p) => p.name === 'Bench');
    expect(bench.status).toBe('in_field');
    const fieldAfter = (await getTeams(rid)).find((t) => t.id === inField.id);
    expect(fieldAfter.players).toContain(bench.id);
    expect(fieldAfter.players).not.toContain(victimId);
  });

  it('deve rejeitar motivo inválido', async () => {
    const player = await addPlayer('Test');
    await expect(removePlayer(player.id, 'invalid')).rejects.toThrow(
      "Motivo deve ser 'injured' ou 'tired'"
    );
  });

  it('deve substituir jogador (substitute=true) a partir do próximo time waiting', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 10; i += 1) {
      await addPlayer(`J${i}`);
      await new Promise((r) => setTimeout(r, 8));
    }

    await formTeam(3, rid);
    await formTeam(3, rid);
    const waiting = await formTeam(3, rid);
    expect(waiting.status).toBe('waiting');

    const teams = await getTeams(rid);
    const inFieldA = teams.find((t) => t.status === 'in_field');
    const firstPlayerId = inFieldA.players[0];

    await removePlayer(firstPlayerId, 'tired', true, rid, 3);

    const players = await getPlayers();
    expect(players.find((p) => p.id === firstPlayerId).status).toBe('tired');

    const fromHead = players.find((p) => p.name === 'J7');
    expect(fromHead.status).toBe('in_field');
    const inFieldAfter = (await getTeams(rid)).filter((t) => t.status === 'in_field');
    expect(inFieldAfter.some((t) => t.players.includes(fromHead.id))).toBe(true);

    const j10 = players.find((p) => p.name === 'J10');
    const waitingAfter = (await getTeams(rid)).find((t) => t.status === 'waiting');
    expect(waitingAfter.players).toContain(j10.id);
  });

  it('sem jogador na fila global: dissolve o último waiting e libera o elenco', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 12; i += 1) {
      await addPlayer(`J${i}`);
      await new Promise((r) => setTimeout(r, 8));
    }

    // Dois primeiros times em campo; 3º e 4º waiting (regra formTeam: waiting só após 2 in_field).
    await formTeam(3, rid);
    await formTeam(3, rid);
    await formTeam(3, rid);
    await formTeam(3, rid);

    const teams = await getTeams(rid);
    const inFieldA = teams.find((t) => t.status === 'in_field');
    const firstPlayerId = inFieldA.players[0];

    await removePlayer(firstPlayerId, 'tired', true, rid, 3);

    const players = await getPlayers();
    expect(players.find((p) => p.id === firstPlayerId).status).toBe('tired');

    const fromHead = players.find((p) => p.name === 'J7');
    expect(fromHead.status).toBe('in_field');

    const teamsAfter = await getTeams(rid);
    const waitingTeams = teamsAfter.filter((t) => t.status === 'waiting');
    expect(waitingTeams).toHaveLength(1);
    expect(waitingTeams[0].players).toHaveLength(3);

    const j11 = players.find((p) => p.name === 'J11');
    const j12 = players.find((p) => p.name === 'J12');
    expect(j11.status).toBe('available');
    expect(j12.status).toBe('available');
    expect(waitingTeams[0].players.includes(j11.id)).toBe(false);
    expect(waitingTeams[0].players.includes(j12.id)).toBe(false);
  });

  it('restorePlayerToAvailable libera cansado/lesionado para o fim da fila', async () => {
    const rid = await testRoundId();
    await addPlayer('Alpha');
    await addPlayer('Beta');
    await addPlayer('Gamma');
    await addPlayer('Delta');
    await new Promise((r) => setTimeout(r, 5));
    await formTeam(1, rid);
    await formTeam(1, rid);
    await formTeam(1, rid);
    const alpha = (await getPlayers()).find((p) => p.name === 'Alpha');
    await removePlayer(alpha.id, 'tired', false, rid, 1);
    expect((await getPlayers()).find((x) => x.id === alpha.id).status).toBe('tired');

    await restorePlayerToAvailable(alpha.id);
    const after = (await getPlayers()).find((x) => x.id === alpha.id);
    expect(after.status).toBe('available');
    expect(new Date(after.joinedAt).getTime()).toBeGreaterThan(0);
  });
});

describe('updatePlayerName', () => {
  it('deve atualizar o nome do jogador', async () => {
    const p = await addPlayer('Antigo');
    await updatePlayerName(p.id, '  Novo Nome  ');
    const list = await getPlayers();
    expect(list.find((x) => x.id === p.id).name).toBe('Novo Nome');
  });

  it('deve rejeitar nome vazio', async () => {
    const p = await addPlayer('X');
    await expect(updatePlayerName(p.id, '   ')).rejects.toThrow('Nome do jogador é obrigatório.');
  });
});

describe('updateTeamDisplayName', () => {
  it('deve definir e limpar displayName', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 5; i += 1) {
      await addPlayer(`T${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const team = await formTeam(5, rid);
    await updateTeamDisplayName(team.id, '  Os Gênios  ');
    let teams = await getTeams(rid);
    expect(teams.find((t) => t.id === team.id).displayName).toBe('Os Gênios');

    await updateTeamDisplayName(team.id, '');
    teams = await getTeams(rid);
    expect(teams.find((t) => t.id === team.id).displayName).toBeUndefined();
  });
});

describe('updateTeamRoster', () => {
  it('deve trocar um jogador do elenco por outro disponível na fila', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 6; i += 1) {
      await addPlayer(`R${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const team = await formTeam(5, rid);
    const onBench = (await getPlayers(true)).find((p) => p.name === 'R6');
    expect(onBench.status).toBe('available');
    const outId = team.players[0];
    const nextIds = [team.players[1], team.players[2], team.players[3], team.players[4], onBench.id];
    await updateTeamRoster(team.id, nextIds, rid, { teamSize: 5 });
    const updated = (await getTeams(rid)).find((t) => t.id === team.id);
    expect(updated.players).toEqual(nextIds);
    const outP = (await getPlayers(true)).find((p) => p.id === outId);
    expect(outP.status).toBe('available');
  });

  it('deve rejeitar jogador que já está em outro time', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 10; i += 1) {
      await addPlayer(`X${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const t1 = await formTeam(5, rid);
    const t2 = await formTeam(5, rid);
    const steal = t2.players[0];
    await expect(
      updateTeamRoster(t1.id, [...t1.players.filter((id) => id !== t1.players[0]), steal], rid, {
        teamSize: 5,
      })
    ).rejects.toThrow(/outro time/);
  });
});

describe('partidas agendadas: updateScheduledMatchTeams e cancelScheduledMatch', () => {
  async function setupThreeTeamsScheduled() {
    const rid = await testRoundId();
    for (let i = 1; i <= 15; i += 1) {
      await addPlayer(`S${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const t1 = await formTeam(5, rid);
    const t2 = await formTeam(5, rid);
    const t3 = await formTeam(5, rid);
    const match = await scheduleMatch(rid, t1.id, t2.id, { teamSize: 5 });
    return { rid, t1, t2, t3, match };
  }

  it('updateScheduledMatchTeams troca times e remove stats rascunho', async () => {
    const { rid, t1, t2, t3, match } = await setupThreeTeamsScheduled();

    await bulkUpsertPlayerStats(match.id, rid, [
      {
        playerId: t1.players[0],
        teamId: t1.id,
        goals: 1,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: t2.players[0],
        teamId: t2.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
    ]);
    expect((await listPlayerStatsForMatch(match.id)).length).toBeGreaterThan(0);

    await updateScheduledMatchTeams(match.id, t1.id, t3.id, { teamSize: 5 });
    const updated = (await getMatches(rid)).find((m) => m.id === match.id);
    expect(updated.teamA).toBe(t1.id);
    expect(updated.teamB).toBe(t3.id);
    expect(await listPlayerStatsForMatch(match.id)).toHaveLength(0);
  });

  it('cancelScheduledMatch remove a partida', async () => {
    const { rid, t1, t2, match } = await setupThreeTeamsScheduled();
    await cancelScheduledMatch(match.id);
    const matches = await getMatches(rid);
    expect(matches.find((m) => m.id === match.id)).toBeUndefined();
  });

  it('getMatchScoresForRound inclui gols contra do adversário no placar', async () => {
    const { rid, t1, t2, match } = await setupThreeTeamsScheduled();
    await bulkUpsertPlayerStats(match.id, rid, [
      {
        playerId: t1.players[0],
        teamId: t1.id,
        goals: 1,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: t2.players[0],
        teamId: t2.id,
        goals: 0,
        assists: 0,
        ownGoals: 1,
        wasGoalkeeper: false,
      },
    ]);
    const scores = await getMatchScoresForRound(rid);
    expect(scores[match.id].scoreA).toBe(2);
    expect(scores[match.id].scoreB).toBe(0);
  });
});

describe('goleiro externo', () => {
  async function setupMatchWithBench() {
    const rid = await testRoundId();
    for (let i = 1; i <= 11; i++) {
      await addPlayer(`B${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const t1 = await formTeam(5, rid);
    const t2 = await formTeam(5, rid);
    const players = await getPlayers();
    const bench = players.find((p) => p.status === 'available');
    expect(bench).toBeDefined();
    const match = await scheduleMatch(rid, t1.id, t2.id, { teamSize: 5 });
    return { rid, t1, t2, match, bench };
  }

  it('bulkUpsert aceita goleiro disponível fora do elenco', async () => {
    const { rid, t1, t2, match, bench } = await setupMatchWithBench();
    await bulkUpsertPlayerStats(match.id, rid, [
      {
        playerId: t1.players[0],
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: t2.players[0],
        teamId: t2.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: bench.id,
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: true,
      },
    ]);
    const stats = await listPlayerStatsForMatch(match.id);
    expect(stats.filter((s) => s.wasGoalkeeper).length).toBe(1);
  });

  it('bulkUpsert rejeita goleiro que está no elenco de campo', async () => {
    const { rid, t1, t2, match } = await setupMatchWithBench();
    await expect(
      bulkUpsertPlayerStats(match.id, rid, [
        {
          playerId: t1.players[0],
          teamId: t1.id,
          goals: 0,
          assists: 0,
          ownGoals: 0,
          wasGoalkeeper: true,
        },
      ])
    ).rejects.toThrow(/Goleiro externo não pode estar no elenco/);
  });

  it('finalizeMatch mantém goleiro no time waiting', async () => {
    const rid = await testRoundId();
    for (let i = 1; i <= 15; i++) {
      await addPlayer(`W${i}`);
      await new Promise((r) => setTimeout(r, 3));
    }
    const t1 = await formTeam(5, rid);
    const t2 = await formTeam(5, rid);
    const t3 = await formTeam(5, rid);
    expect(t3.status).toBe('waiting');
    const gkId = t3.players[0];
    const match = await scheduleMatch(rid, t1.id, t2.id, { teamSize: 5 });

    await bulkUpsertPlayerStats(match.id, rid, [
      {
        playerId: t1.players[0],
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: t2.players[0],
        teamId: t2.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: gkId,
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: true,
      },
    ]);

    await finalizeMatch(match.id, 'A_win', { teamSize: 5 });

    const teams = await getTeams(rid);
    const t3After = teams.find((t) => t.id === t3.id);
    expect(t3After).toBeDefined();
    expect(t3After.players.includes(gkId)).toBe(true);
  });

  it('getRoundStatistics conta partidas como goleiro', async () => {
    const { rid, t1, t2, match, bench } = await setupMatchWithBench();
    await bulkUpsertPlayerStats(match.id, rid, [
      {
        playerId: t1.players[0],
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: t2.players[0],
        teamId: t2.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: false,
      },
      {
        playerId: bench.id,
        teamId: t1.id,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        wasGoalkeeper: true,
      },
    ]);
    await finalizeMatch(match.id, 'A_win', { teamSize: 5 });

    const stats = await getRoundStatistics(rid);
    const benchRow = stats.find((r) => r.playerId === bench.id);
    expect(benchRow).toBeDefined();
    expect(benchRow.goalkeeperMatches).toBe(1);
  });
});

describe('recordMatch', () => {
  async function setupTwoTeams() {
    const rid = await testRoundId();
    for (let i = 1; i <= 10; i++) {
      await addPlayer(`P${i}`);
      await new Promise((r) => setTimeout(r, 5));
    }
    const teamA = await formTeam(5, rid);
    const teamB = await formTeam(5, rid);
    return { teamA, teamB, rid };
  }

  it('deve registrar vitória do Time A e dissolver Time B na fila de jogadores', async () => {
    const { teamA, teamB, rid } = await setupTwoTeams();

    const match = await recordMatch(rid, teamA.id, teamB.id, 'A_win');
    expect(match).toBeDefined();
    expect(match.result).toBe('A_win');

    const teams = await getTeams(rid);
    expect(teams.find((t) => t.id === teamB.id)).toBeUndefined();
    const winner = teams.find((t) => t.id === teamA.id);
    expect(winner).toBeDefined();
    expect(winner.status).toBe('in_field');

    const players = await getPlayers();
    for (const pid of teamB.players) {
      const p = players.find((pl) => pl.id === pid);
      expect(p.status).toBe('available');
    }
  });

  it('deve registrar vitória do Time B e dissolver Time A na fila de jogadores', async () => {
    const { teamA, teamB, rid } = await setupTwoTeams();

    await recordMatch(rid, teamA.id, teamB.id, 'B_win');

    const teams = await getTeams(rid);
    expect(teams.find((t) => t.id === teamA.id)).toBeUndefined();
    expect(teams.find((t) => t.id === teamB.id)?.status).toBe('in_field');
  });

  it('deve tratar empate dissolvendo ambos os times na fila de jogadores', async () => {
    const { teamA, teamB, rid } = await setupTwoTeams();

    await recordMatch(rid, teamA.id, teamB.id, 'draw');

    const teams = await getTeams(rid);
    expect(teams.find((t) => t.id === teamA.id)).toBeUndefined();
    expect(teams.find((t) => t.id === teamB.id)).toBeUndefined();
  });

  it('deve rejeitar resultado inválido', async () => {
    const rid = await testRoundId();
    await expect(recordMatch(rid, 'a', 'b', 'invalid')).rejects.toThrow(
      "Resultado deve ser 'A_win', 'B_win' ou 'draw'"
    );
  });

  it('deve rejeitar time inexistente', async () => {
    const rid = await testRoundId();
    await expect(recordMatch(rid, 'inexistente', 'outro', 'A_win')).rejects.toThrow(
      'Time A não encontrado nesta rodada'
    );
  });
});

describe('exportData e importData', () => {
  it('deve exportar todos os dados', async () => {
    await addPlayer('P1');
    await addPlayer('P2');

    const data = await exportData();
    expect(data.players).toHaveLength(2);
    expect(data.teams).toBeDefined();
    expect(data.matches).toBeDefined();
    expect(data.rounds).toBeDefined();
    expect(data.meta).toBeDefined();
    expect(data.player_stats).toBeDefined();
    expect(data.schemaVersion).toBe(3);
    expect(data.exportedAt).toBeDefined();
  });

  it('deve importar dados e substituir existentes', async () => {
    await addPlayer('Existente');

    const importPayload = {
      players: [
        {
          id: crypto.randomUUID(),
          name: 'Importado1',
          status: 'available',
          joinedAt: new Date().toISOString(),
          goals: 0,
          assists: 0,
        },
        {
          id: crypto.randomUUID(),
          name: 'Importado2',
          status: 'available',
          joinedAt: new Date().toISOString(),
          goals: 0,
          assists: 0,
        },
      ],
      teams: [],
      matches: [],
    };

    await importData(importPayload);

    const players = await getPlayers();
    // Deve ter apenas os importados (o existente foi limpo)
    expect(players).toHaveLength(2);
    expect(players.map((p) => p.name)).toContain('Importado1');
    expect(players.map((p) => p.name)).toContain('Importado2');
    expect(players.map((p) => p.name)).not.toContain('Existente');
  });

  it('deve rejeitar JSON inválido', async () => {
    await expect(importData({})).rejects.toThrow('JSON inválido');
    await expect(importData(null)).rejects.toThrow('JSON inválido');
  });

  it('deve fazer roundtrip export → import', async () => {
    await addPlayer('RT1');
    await addPlayer('RT2');
    await addPlayer('RT3');

    const exported = await exportData();
    await deleteDatabase();

    await importData(exported);

    const players = await getPlayers();
    expect(players).toHaveLength(3);
  });
});



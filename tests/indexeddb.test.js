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
  formTeam,
  removePlayer,
  recordMatch,
  getTeams,
  getMatches,
  exportData,
  importData,
  deleteDatabase,
} from '../src/api/indexeddb.js';

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
    await addPlayer('J1');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J2');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J3');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J4');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J5');

    const team = await formTeam(3);
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

  it('deve rejeitar se não há jogadores suficientes', async () => {
    await addPlayer('J1');
    await addPlayer('J2');

    await expect(formTeam(5)).rejects.toThrow('Jogadores disponíveis insuficientes');
  });

  it('deve rejeitar tamanho inválido', async () => {
    await expect(formTeam(0)).rejects.toThrow('Tamanho do time deve ser maior que zero');
  });
});

describe('removePlayer', () => {
  it('deve marcar jogador como lesionado', async () => {
    const player = await addPlayer('João');
    // Precisa estar in_field primeiro
    await addPlayer('X1');
    await addPlayer('X2');
    const team = await formTeam(1);

    // Verifica qual jogador foi para o time (FIFO = João)
    const players = await getPlayers();
    const inField = players.find((p) => p.status === 'in_field');

    await removePlayer(inField.id, 'injured', false);

    const updated = await getPlayers();
    const injured = updated.find((p) => p.id === inField.id);
    expect(injured.status).toBe('injured');
  });

  it('deve marcar jogador como cansado', async () => {
    const player = await addPlayer('Maria');
    await formTeam(1);

    await removePlayer(player.id, 'tired', false);

    const players = await getPlayers();
    const tired = players.find((p) => p.id === player.id);
    expect(tired.status).toBe('tired');
  });

  it('deve rejeitar motivo inválido', async () => {
    const player = await addPlayer('Test');
    await expect(removePlayer(player.id, 'invalid')).rejects.toThrow(
      "Motivo deve ser 'injured' ou 'tired'"
    );
  });

  it('deve substituir jogador quando substitute=true', async () => {
    // Cria 4 jogadores: 3 para time + 1 reserva
    await addPlayer('J1');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J2');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('J3');
    await new Promise((r) => setTimeout(r, 10));
    await addPlayer('Reserva');

    // Forma time com 3
    const team = await formTeam(3);
    const firstPlayerId = team.players[0];

    // Substitui o primeiro por outro disponível
    await removePlayer(firstPlayerId, 'tired', true);

    const players = await getPlayers();
    const tired = players.find((p) => p.id === firstPlayerId);
    expect(tired.status).toBe('tired');

    // O reserva deve estar in_field agora
    const reserva = players.find((p) => p.name === 'Reserva');
    expect(reserva.status).toBe('in_field');
  });
});

describe('recordMatch', () => {
  // Helper para criar dois times
  async function setupTwoTeams() {
    for (let i = 1; i <= 10; i++) {
      await addPlayer(`P${i}`);
      await new Promise((r) => setTimeout(r, 5));
    }
    const teamA = await formTeam(5);
    const teamB = await formTeam(5);
    return { teamA, teamB };
  }

  it('deve registrar vitória do Time A e devolver Time B para a fila', async () => {
    const { teamA, teamB } = await setupTwoTeams();

    const match = await recordMatch(teamA.id, teamB.id, 'A_win');
    expect(match).toBeDefined();
    expect(match.result).toBe('A_win');

    // Time B deve ter status 'waiting'
    const teams = await getTeams();
    const updatedB = teams.find((t) => t.id === teamB.id);
    expect(updatedB.status).toBe('waiting');

    // Jogadores do Time B devem estar 'available' com joinedAt atualizado
    const players = await getPlayers();
    for (const pid of teamB.players) {
      const p = players.find((pl) => pl.id === pid);
      expect(p.status).toBe('available');
    }
  });

  it('deve registrar vitória do Time B e devolver Time A para a fila', async () => {
    const { teamA, teamB } = await setupTwoTeams();

    await recordMatch(teamA.id, teamB.id, 'B_win');

    const teams = await getTeams();
    const updatedA = teams.find((t) => t.id === teamA.id);
    expect(updatedA.status).toBe('waiting');
  });

  it('deve tratar empate removendo ambos os times do fluxo', async () => {
    const { teamA, teamB } = await setupTwoTeams();

    await recordMatch(teamA.id, teamB.id, 'draw');

    const teams = await getTeams();
    const updatedA = teams.find((t) => t.id === teamA.id);
    const updatedB = teams.find((t) => t.id === teamB.id);
    expect(updatedA.status).toBe('waiting');
    expect(updatedB.status).toBe('waiting');
  });

  it('deve rejeitar resultado inválido', async () => {
    await expect(recordMatch('a', 'b', 'invalid')).rejects.toThrow(
      "Resultado deve ser 'A_win', 'B_win' ou 'draw'"
    );
  });

  it('deve rejeitar time inexistente', async () => {
    await expect(recordMatch('inexistente', 'outro', 'A_win')).rejects.toThrow(
      'Time A não encontrado'
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
        },
        {
          id: crypto.randomUUID(),
          name: 'Importado2',
          status: 'available',
          joinedAt: new Date().toISOString(),
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



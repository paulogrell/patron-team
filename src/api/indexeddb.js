/**
 * indexeddb.js — Camada de acesso a dados com IndexedDB
 *
 * Database: teamQueueDB (versão 1)
 * Object stores:
 *   - players  (keyPath: id, índices: joinedAt, status)
 *   - teams    (keyPath: id, índice: status)
 *   - matches  (keyPath: id)
 *
 * Todas as operações de escrita usam transações readwrite atômicas.
 * IDs gerados com crypto.randomUUID().
 * Sincronização entre abas via BroadcastChannel.
 */

const DB_NAME = 'teamQueueDB';
const DB_VERSION = 2;

// ---------- Canal de broadcast para sincronização entre abas ----------
let broadcastChannel = null;
try {
  broadcastChannel = new BroadcastChannel('team-queue-sync');
} catch {
  // BroadcastChannel pode não existir em ambientes de teste
  console.warn('BroadcastChannel não disponível neste ambiente.');
}

/**
 * Notifica outras abas que houve mudança nos dados.
 * @param {string} type - Tipo da mudança (ex.: 'player_added', 'team_formed')
 */
function notifyChange(type) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, timestamp: Date.now() });
  }
}

// ---------- Abertura / criação do banco ----------

/** Cache da conexão aberta para reutilização */
let dbInstance = null;

/**
 * Abre (ou retorna a conexão cacheada) o banco teamQueueDB.
 * Cria as object stores e índices na primeira execução.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Criação/migração do schema
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Versão 1: stores iniciais
      if (oldVersion < 1) {
        // Store de jogadores
        const playersStore = db.createObjectStore('players', { keyPath: 'id' });
        playersStore.createIndex('joinedAt', 'joinedAt', { unique: false });
        playersStore.createIndex('status', 'status', { unique: false });

        // Store de times
        const teamsStore = db.createObjectStore('teams', { keyPath: 'id' });
        teamsStore.createIndex('status', 'status', { unique: false });

        // Store de partidas
        db.createObjectStore('matches', { keyPath: 'id' });
      }

      // Versão 2: campos goals e assists nos jogadores (migração)
      // IndexedDB não exige alteração de schema para novos campos,
      // mas atualizamos registros existentes para consistência.
      if (oldVersion < 2 && oldVersion >= 1) {
        const tx = event.target.transaction;
        const playersStore = tx.objectStore('players');
        const cursorReq = playersStore.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const player = cursor.value;
            if (player.goals === undefined) player.goals = 0;
            if (player.assists === undefined) player.assists = 0;
            cursor.update(player);
            cursor.continue();
          }
        };
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fecha a conexão com o banco de dados.
 * Necessário antes de deletar o banco (ex.: em testes).
 */
export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ---------- Utilitário para promisificar requisições IDB ----------

/**
 * Converte uma IDBRequest em Promise.
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- Operações de jogadores ----------

/**
 * Adiciona um novo jogador à fila com status 'available'.
 * @param {string} name - Nome do jogador
 * @returns {Promise<object>} Jogador criado
 */
export async function addPlayer(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Nome do jogador é obrigatório.');
  }

  const db = await openDB();
  const player = {
    id: crypto.randomUUID(),
    name: name.trim(),
    status: 'available',
    joinedAt: new Date().toISOString(),
    goals: 0,
    assists: 0,
  };

  const tx = db.transaction('players', 'readwrite');
  const store = tx.objectStore('players');
  store.add(player);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('player_added');
      resolve(player);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Lista todos os jogadores, opcionalmente ordenados por joinedAt (FIFO).
 * @param {boolean} orderByJoinedAt - Se true, ordena por joinedAt ascendente
 * @returns {Promise<object[]>}
 */
export async function getPlayers(orderByJoinedAt = true) {
  const db = await openDB();
  const tx = db.transaction('players', 'readonly');
  const store = tx.objectStore('players');

  return new Promise((resolve, reject) => {
    let request;
    if (orderByJoinedAt) {
      // Usar índice joinedAt para ordem ascendente (FIFO)
      const index = store.index('joinedAt');
      request = index.openCursor(null, 'next');
    } else {
      request = store.openCursor();
    }

    const results = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Forma um time selecionando os N primeiros jogadores 'available' pela ordem FIFO.
 *
 * PONTO CRÍTICO: Toda a seleção e atualização ocorre numa única transação readwrite
 * para evitar condições de corrida (ex.: outra aba formando time ao mesmo tempo).
 *
 * @param {number} size - Número de jogadores por time
 * @returns {Promise<object>} Time criado
 */
export async function formTeam(size) {
  if (!size || size < 1) {
    throw new Error('Tamanho do time deve ser maior que zero.');
  }

  const db = await openDB();
  // Transação abrange players E teams para atomicidade
  const tx = db.transaction(['players', 'teams'], 'readwrite');
  const playersStore = tx.objectStore('players');
  const teamsStore = tx.objectStore('teams');

  return new Promise((resolve, reject) => {
    let settled = false;
    const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };
    const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };

    const selectedPlayers = [];
    // Percorre o índice joinedAt para selecionar FIFO
    const index = playersStore.index('joinedAt');
    const cursorReq = index.openCursor(null, 'next');

    cursorReq.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor && selectedPlayers.length < size) {
        const player = cursor.value;
        // Seleciona apenas jogadores disponíveis
        if (player.status === 'available') {
          player.status = 'in_field';
          cursor.update(player);
          selectedPlayers.push(player.id);
        }
        cursor.continue();
      } else {
        // Verificação: precisamos de exatamente 'size' jogadores
        if (selectedPlayers.length < size) {
          tx.abort();
          safeReject(
            new Error(
              `Jogadores disponíveis insuficientes. Necessário: ${size}, disponível: ${selectedPlayers.length}`
            )
          );
          return;
        }

        // Cria o registro do time
        const team = {
          id: crypto.randomUUID(),
          players: selectedPlayers,
          status: 'in_field',
          createdAt: new Date().toISOString(),
        };
        teamsStore.add(team);

        tx.oncomplete = () => {
          notifyChange('team_formed');
          safeResolve(team);
        };
      }
    };

    cursorReq.onerror = () => safeReject(cursorReq.error);
    tx.onerror = () => safeReject(tx.error);
    tx.onabort = () => safeReject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Remove/substitui um jogador marcando-o como lesionado ou cansado.
 *
 * PONTO CRÍTICO: Se substitute=true, o próximo jogador 'available' é
 * automaticamente promovido a 'in_field' dentro da mesma transação,
 * garantindo que nenhuma outra operação simultânea pegue esse substituto.
 *
 * @param {string} playerId - ID do jogador a ser removido
 * @param {'injured'|'tired'} reason - Motivo da remoção
 * @param {boolean} substitute - Se true, insere próximo disponível no lugar
 * @returns {Promise<void>}
 */
export async function removePlayer(playerId, reason, substitute = false) {
  if (!['injured', 'tired'].includes(reason)) {
    throw new Error("Motivo deve ser 'injured' ou 'tired'.");
  }

  const db = await openDB();
  const tx = db.transaction(['players', 'teams'], 'readwrite');
  const playersStore = tx.objectStore('players');
  const teamsStore = tx.objectStore('teams');

  return new Promise((resolve, reject) => {
    let settled = false;
    const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };
    const safeResolve = () => { if (!settled) { settled = true; resolve(); } };

    // 1. Busca o jogador e atualiza seu status
    const getReq = playersStore.get(playerId);
    getReq.onsuccess = () => {
      const player = getReq.result;
      if (!player) {
        tx.abort();
        safeReject(new Error('Jogador não encontrado.'));
        return;
      }

      const previousStatus = player.status;
      player.status = reason; // 'injured' ou 'tired'
      playersStore.put(player);

      // 2. Se o jogador estava em campo e queremos substituto, buscar próximo available
      if (substitute && previousStatus === 'in_field') {
        // Encontra o time do jogador para atualizar a lista de jogadores
        const teamIndex = teamsStore.index('status');
        const teamCursorReq = teamIndex.openCursor(IDBKeyRange.only('in_field'));

        teamCursorReq.onsuccess = (event) => {
          const teamCursor = event.target.result;
          if (teamCursor) {
            const team = teamCursor.value;
            const playerIdx = team.players.indexOf(playerId);

            if (playerIdx !== -1) {
              // Encontrou o time, agora busca substituto
              const joinedIndex = playersStore.index('joinedAt');
              const subCursorReq = joinedIndex.openCursor(null, 'next');

              subCursorReq.onsuccess = (subEvent) => {
                const subCursor = subEvent.target.result;
                if (subCursor) {
                  const candidate = subCursor.value;
                  if (candidate.status === 'available') {
                    // Reserva o substituto: marca como in_field dentro da mesma transação
                    candidate.status = 'in_field';
                    playersStore.put(candidate);

                    // Atualiza o time substituindo o jogador removido
                    team.players[playerIdx] = candidate.id;
                    teamsStore.put(team);
                    return; // tx.oncomplete resolverá
                  }
                  subCursor.continue();
                }
                // Se não encontrou substituto, mantém o time com jogador a menos
              };
            } else {
              teamCursor.continue();
            }
          }
        };
      }
    };

    tx.oncomplete = () => {
      notifyChange('player_removed');
      safeResolve();
    };
    tx.onerror = () => safeReject(tx.error);
    tx.onabort = () => safeReject(tx.error || new Error('Transação abortada.'));
  });
}

// ---------- Operações de times ----------

/**
 * Lista todos os times.
 * @returns {Promise<object[]>}
 */
export async function getTeams() {
  const db = await openDB();
  const tx = db.transaction('teams', 'readonly');
  const store = tx.objectStore('teams');
  return promisify(store.getAll());
}

// ---------- Operações de partidas ----------

/**
 * Registra o resultado de uma partida e aplica as regras de negócio:
 *   - Time perdedor: todos os jogadores voltam ao fim da fila (joinedAt = now)
 *   - Empate: ambos os times são removidos do fluxo (status → 'waiting')
 *   - Time vencedor permanece em campo
 *
 * PONTO CRÍTICO: Toda a lógica ocorre em uma única transação readwrite
 * abrangendo players, teams e matches para garantir atomicidade.
 *
 * @param {string} teamAId - ID do time A
 * @param {string} teamBId - ID do time B
 * @param {'A_win'|'B_win'|'draw'} result - Resultado da partida
 * @returns {Promise<object>} Registro da partida
 */
export async function recordMatch(teamAId, teamBId, result) {
  if (!['A_win', 'B_win', 'draw'].includes(result)) {
    throw new Error("Resultado deve ser 'A_win', 'B_win' ou 'draw'.");
  }

  const db = await openDB();
  const tx = db.transaction(['players', 'teams', 'matches'], 'readwrite');
  const playersStore = tx.objectStore('players');
  const teamsStore = tx.objectStore('teams');
  const matchesStore = tx.objectStore('matches');

  return new Promise((resolve, reject) => {
    let settled = false;
    const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };
    const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };

    const teamAReq = teamsStore.get(teamAId);

    teamAReq.onsuccess = () => {
      const teamA = teamAReq.result;
      if (!teamA) {
        tx.abort();
        safeReject(new Error('Time A não encontrado.'));
        return;
      }

      const teamBReq = teamsStore.get(teamBId);
      teamBReq.onsuccess = () => {
        const teamB = teamBReq.result;
        if (!teamB) {
          tx.abort();
          safeReject(new Error('Time B não encontrado.'));
          return;
        }

        const now = new Date().toISOString();

        /**
         * Envia jogadores de um time de volta para o fim da fila.
         * Atualiza joinedAt = now e status = 'available'.
         */
        const sendToEndOfQueue = (team) => {
          team.status = 'waiting';
          teamsStore.put(team);
          for (const pid of team.players) {
            const pReq = playersStore.get(pid);
            pReq.onsuccess = () => {
              const p = pReq.result;
              if (p && (p.status === 'in_field' || p.status === 'available')) {
                p.status = 'available';
                p.joinedAt = now;
                playersStore.put(p);
              }
            };
          }
        };

        /**
         * Remove ambos os times do fluxo (empate).
         * Jogadores voltam ao fim da fila com joinedAt atualizado.
         */
        const removeFromFlow = (team) => {
          team.status = 'waiting';
          teamsStore.put(team);
          for (const pid of team.players) {
            const pReq = playersStore.get(pid);
            pReq.onsuccess = () => {
              const p = pReq.result;
              if (p) {
                p.status = 'available';
                p.joinedAt = now;
                playersStore.put(p);
              }
            };
          }
        };

        // Aplica regras conforme o resultado
        if (result === 'A_win') {
          // Time B perde → volta para o fim da fila
          sendToEndOfQueue(teamB);
        } else if (result === 'B_win') {
          // Time A perde → volta para o fim da fila
          sendToEndOfQueue(teamA);
        } else {
          // Empate → ambos removidos do fluxo
          removeFromFlow(teamA);
          removeFromFlow(teamB);
        }

        // Cria registro da partida
        const match = {
          id: crypto.randomUUID(),
          teamA: teamAId,
          teamB: teamBId,
          result,
          timestamp: now,
        };
        matchesStore.add(match);

        tx.oncomplete = () => {
          notifyChange('match_recorded');
          safeResolve(match);
        };
      };
    };

    tx.onerror = () => safeReject(tx.error);
    tx.onabort = () => safeReject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Lista todas as partidas registradas.
 * @returns {Promise<object[]>}
 */
export async function getMatches() {
  const db = await openDB();
  const tx = db.transaction('matches', 'readonly');
  const store = tx.objectStore('matches');
  return promisify(store.getAll());
}

// ---------- Estatísticas de jogadores (gols e assistências) ----------

/**
 * Registra um gol para o jogador especificado.
 * Incrementa o campo 'goals' do jogador em 1 dentro de uma transação readwrite.
 * @param {string} playerId - ID do jogador que marcou o gol
 * @returns {Promise<object>} Jogador atualizado
 */
export async function recordGoal(playerId) {
  const db = await openDB();
  const tx = db.transaction('players', 'readwrite');
  const store = tx.objectStore('players');

  return new Promise((resolve, reject) => {
    const getReq = store.get(playerId);
    getReq.onsuccess = () => {
      const player = getReq.result;
      if (!player) {
        tx.abort();
        reject(new Error('Jogador não encontrado.'));
        return;
      }
      player.goals = (player.goals || 0) + 1;
      store.put(player);
    };

    tx.oncomplete = () => {
      notifyChange('player_goal');
      // Retorna o jogador atualizado buscando novamente após commit
      openDB().then((db2) => {
        const tx2 = db2.transaction('players', 'readonly');
        const s2 = tx2.objectStore('players');
        const r = s2.get(playerId);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Remove um gol do jogador especificado (mínimo 0).
 * @param {string} playerId - ID do jogador
 * @returns {Promise<object>} Jogador atualizado
 */
export async function removeGoal(playerId) {
  const db = await openDB();
  const tx = db.transaction('players', 'readwrite');
  const store = tx.objectStore('players');

  return new Promise((resolve, reject) => {
    const getReq = store.get(playerId);
    getReq.onsuccess = () => {
      const player = getReq.result;
      if (!player) {
        tx.abort();
        reject(new Error('Jogador não encontrado.'));
        return;
      }
      player.goals = Math.max(0, (player.goals || 0) - 1);
      store.put(player);
    };

    tx.oncomplete = () => {
      notifyChange('player_goal_removed');
      openDB().then((db2) => {
        const tx2 = db2.transaction('players', 'readonly');
        const s2 = tx2.objectStore('players');
        const r = s2.get(playerId);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Registra uma assistência para o jogador especificado.
 * Incrementa o campo 'assists' do jogador em 1 dentro de uma transação readwrite.
 * @param {string} playerId - ID do jogador que deu a assistência
 * @returns {Promise<object>} Jogador atualizado
 */
export async function recordAssist(playerId) {
  const db = await openDB();
  const tx = db.transaction('players', 'readwrite');
  const store = tx.objectStore('players');

  return new Promise((resolve, reject) => {
    const getReq = store.get(playerId);
    getReq.onsuccess = () => {
      const player = getReq.result;
      if (!player) {
        tx.abort();
        reject(new Error('Jogador não encontrado.'));
        return;
      }
      player.assists = (player.assists || 0) + 1;
      store.put(player);
    };

    tx.oncomplete = () => {
      notifyChange('player_assist');
      openDB().then((db2) => {
        const tx2 = db2.transaction('players', 'readonly');
        const s2 = tx2.objectStore('players');
        const r = s2.get(playerId);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Remove uma assistência do jogador especificado (mínimo 0).
 * @param {string} playerId - ID do jogador
 * @returns {Promise<object>} Jogador atualizado
 */
export async function removeAssist(playerId) {
  const db = await openDB();
  const tx = db.transaction('players', 'readwrite');
  const store = tx.objectStore('players');

  return new Promise((resolve, reject) => {
    const getReq = store.get(playerId);
    getReq.onsuccess = () => {
      const player = getReq.result;
      if (!player) {
        tx.abort();
        reject(new Error('Jogador não encontrado.'));
        return;
      }
      player.assists = Math.max(0, (player.assists || 0) - 1);
      store.put(player);
    };

    tx.oncomplete = () => {
      notifyChange('player_assist_removed');
      openDB().then((db2) => {
        const tx2 = db2.transaction('players', 'readonly');
        const s2 = tx2.objectStore('players');
        const r = s2.get(playerId);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transação abortada.'));
  });
}

/**
 * Retorna as estatísticas de todos os jogadores (gols e assistências).
 * Inclui valores padrão para jogadores criados antes da versão 2.
 * @returns {Promise<object[]>} Lista de jogadores com stats normalizadas
 */
export async function getPlayerStats() {
  const players = await getPlayers(false);
  return players.map((p) => ({
    ...p,
    goals: p.goals || 0,
    assists: p.assists || 0,
  }));
}

// ---------- Export / Import de dados ----------

/**
 * Exporta todos os dados (players, teams, matches) como um objeto JSON.
 * Útil para backup dos dados offline.
 * @returns {Promise<object>}
 */
export async function exportData() {
  const db = await openDB();
  const tx = db.transaction(['players', 'teams', 'matches'], 'readonly');
  const players = await promisify(tx.objectStore('players').getAll());
  const teams = await promisify(tx.objectStore('teams').getAll());
  const matches = await promisify(tx.objectStore('matches').getAll());
  return { players, teams, matches, exportedAt: new Date().toISOString() };
}

/**
 * Importa dados de um JSON, substituindo todos os registros existentes.
 *
 * PONTO CRÍTICO: Limpa todas as stores antes de inserir os novos dados,
 * tudo dentro de uma única transação readwrite.
 *
 * @param {object} json - Objeto com arrays players, teams e matches
 * @returns {Promise<void>}
 */
export async function importData(json) {
  if (!json || !json.players || !json.teams || !json.matches) {
    throw new Error('JSON inválido. Deve conter players, teams e matches.');
  }

  const db = await openDB();
  const tx = db.transaction(['players', 'teams', 'matches'], 'readwrite');
  const playersStore = tx.objectStore('players');
  const teamsStore = tx.objectStore('teams');
  const matchesStore = tx.objectStore('matches');

  // Limpa todas as stores antes de importar
  playersStore.clear();
  teamsStore.clear();
  matchesStore.clear();

  // Insere os dados importados
  for (const player of json.players) {
    playersStore.add(player);
  }
  for (const team of json.teams) {
    teamsStore.add(team);
  }
  for (const match of json.matches) {
    matchesStore.add(match);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      notifyChange('data_imported');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Sincronização entre abas ----------

/**
 * Registra um callback para ser chamado quando outra aba modificar os dados.
 * Usa BroadcastChannel para comunicação entre abas.
 * @param {function} callback - Função chamada com o evento { type, timestamp }
 * @returns {function} Função para cancelar a inscrição
 */
export function onChange(callback) {
  if (!broadcastChannel) {
    console.warn('BroadcastChannel indisponível, sincronização entre abas desativada.');
    return () => {};
  }

  const handler = (event) => {
    callback(event.data);
  };
  broadcastChannel.addEventListener('message', handler);

  // Retorna função para remover o listener
  return () => {
    broadcastChannel.removeEventListener('message', handler);
  };
}

// ---------- Utilidades ----------

/**
 * Exclui o banco de dados inteiro (útil para testes e reset).
 * Fecha a conexão antes de deletar para evitar bloqueio.
 * @returns {Promise<void>}
 */
export async function deleteDatabase() {
  closeDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Se outra conexão bloqueia a exclusão, forçar resolução
    request.onblocked = () => resolve();
  });
}








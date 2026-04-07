# Arquitetura — Arjen IndexedDB

## Visão Geral

A aplicação segue uma arquitetura simples de **camada de dados + componentes React**,
com IndexedDB como persistência local e BroadcastChannel para sincronização entre abas.

```
┌─────────────────────────────────────────────────────┐
│                    Navegador                         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Aba 1   │  │  Aba 2   │  │  Service Worker  │  │
│  │  (React) │  │  (React) │  │  (Cache offline) │  │
│  └────┬─────┘  └────┬─────┘  └──────────────────┘  │
│       │              │                               │
│       │  BroadcastChannel                            │
│       │◄────────────►│                               │
│       │              │                               │
│       ▼              ▼                               │
│  ┌──────────────────────────┐                        │
│  │       indexeddb.js        │  ← API de dados       │
│  │    (transações atômicas)  │                        │
│  └────────────┬─────────────┘                        │
│               │                                      │
│               ▼                                      │
│  ┌──────────────────────────┐                        │
│  │    IndexedDB (teamQueueDB)│                       │
│  │                           │                       │
│  │  ┌─────────┐ ┌────────┐  │                       │
│  │  │ players │ │ teams  │  │                       │
│  │  └─────────┘ └────────┘  │                       │
│  │  ┌─────────┐             │                       │
│  │  │ matches │             │                       │
│  │  └─────────┘             │                       │
│  └──────────────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

## Object Stores

### players
| Campo      | Tipo     | Descrição                                    |
|-----------|----------|----------------------------------------------|
| id        | string   | UUID (keyPath)                               |
| name      | string   | Nome do jogador                              |
| status    | string   | `available` \| `in_field` \| `injured` \| `tired` |
| joinedAt  | string   | ISO timestamp de entrada na fila             |
| goals     | number   | Quantidade de gols marcados (padrão: 0)      |
| assists   | number   | Quantidade de assistências (padrão: 0)       |

**Índices:**
- `joinedAt` — Para ordenação FIFO
- `status` — Para filtrar por status

### teams
| Campo     | Tipo       | Descrição                          |
|----------|------------|-------------------------------------|
| id       | string     | UUID (keyPath)                     |
| players  | string[]   | Array de IDs de jogadores          |
| status   | string     | `in_field` \| `waiting`            |
| createdAt| string     | ISO timestamp de criação           |

**Índices:**
- `status` — Para filtrar times em campo/aguardando

### matches
| Campo     | Tipo     | Descrição                              |
|----------|----------|----------------------------------------|
| id       | string   | UUID (keyPath)                         |
| teamA    | string   | ID do time A                           |
| teamB    | string   | ID do time B                           |
| result   | string   | `A_win` \| `B_win` \| `draw`          |
| timestamp| string   | ISO timestamp do registro              |

---

## Sequência de Transações

### formTeam(size)

```
1. Abrir transação readwrite em [players, teams]
2. Abrir cursor no índice joinedAt (players)
3. Para cada cursor:
   a. Se player.status === 'available' E selecionados < size:
      - Atualizar player.status = 'in_field'
      - cursor.update(player)
      - Adicionar player.id à lista
   b. Avançar cursor
4. Se selecionados < size:
   → ABORT transação (jogadores insuficientes)
5. Criar objeto team:
   { id: UUID, players: [...ids], status: 'in_field', createdAt: now }
6. Inserir team na store 'teams'
7. COMMIT (automático ao completar)
```

**Garantia de atomicidade:** Se qualquer passo falhar, a transação inteira é revertida e nenhum jogador é marcado como `in_field`.

### recordMatch(teamAId, teamBId, result)

```
1. Abrir transação readwrite em [players, teams, matches]
2. Buscar teamA e teamB por ID
3. Validar existência dos times
4. Conforme resultado:

   SE result === 'A_win':
     - teamB.status = 'waiting'
     - Para cada jogador do teamB:
       - player.status = 'available'
       - player.joinedAt = now  (vai para fim da fila)

   SE result === 'B_win':
     - teamA.status = 'waiting'
     - Para cada jogador do teamA:
       - player.status = 'available'
       - player.joinedAt = now

   SE result === 'draw':
     - teamA.status = 'waiting'
     - teamB.status = 'waiting'
     - Para cada jogador de ambos:
       - player.status = 'available'
       - player.joinedAt = now

5. Criar registro de match:
   { id: UUID, teamA, teamB, result, timestamp: now }
6. Inserir match na store 'matches'
7. COMMIT
```

### removePlayer(playerId, reason, substitute)

```
1. Abrir transação readwrite em [players, teams]
2. Buscar jogador por ID
3. Salvar status anterior
4. Atualizar player.status = reason (injured | tired)
5. SE substitute === true E status anterior === 'in_field':
   a. Encontrar o time do jogador (buscar por status 'in_field')
   b. Abrir cursor no índice joinedAt (players)
   c. Encontrar primeiro player com status === 'available'
   d. Marcar substituto como 'in_field' (reserva atômica)
   e. Atualizar array team.players: trocar ID removido pelo ID do substituto
6. COMMIT
```

---

## Sincronização entre Abas

```
Aba 1 faz operação (ex: addPlayer)
  │
  ├─ Executa transação no IndexedDB
  │
  └─ broadcastChannel.postMessage({ type: 'player_added', timestamp })
        │
        ▼
     BroadcastChannel 'team-queue-sync'
        │
        ▼
     Aba 2 recebe mensagem
        │
        └─ Callback chama refreshData() → recarrega tudo do IndexedDB
```

## Componentes React

```
App
├── Navegação (Abas: Fila & Partidas / Estatísticas)
│
├── [Aba: Fila & Partidas]
│   ├── Controls        → Painel de ações (adicionar, formar time, partida, backup)
│   ├── QueueList       → Lista de jogadores na fila (FIFO)
│   └── RightColumn
│       ├── TeamsPanel  → Cards dos times em campo (TeamCard)
│       └── MatchHistory → Histórico de partidas
│
└── [Aba: Estatísticas]
    └── PlayerStats     → Tabela com gols, assistências e controles (+/−)
```

### Estatísticas de Jogadores (recordGoal / recordAssist)

```
1. Abrir transação readwrite em [players]
2. Buscar jogador por ID
3. Incrementar player.goals (ou player.assists) em 1
4. Atualizar registro com store.put(player)
5. COMMIT
6. Notificar outras abas via BroadcastChannel
```

**Migração v1 → v2:** Ao atualizar o banco da versão 1 para a 2,
todos os jogadores existentes recebem `goals: 0` e `assists: 0`
automaticamente no `onupgradeneeded`.

## PWA / Service Worker

- **Estratégia:** Cache First com fallback para rede
- **Recursos cacheados:** HTML, CSS, JS (assets do build)
- **Dados:** Persistidos no IndexedDB (não no cache do SW)


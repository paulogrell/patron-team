/**
 * Elegibilidade de goleiro externo (fora do elenco de campo da partida).
 * Funções puras — sem I/O.
 */

function str(id) {
  return String(id);
}

function isBenchOrStreetCandidate(player) {
  if (!player) return false;
  const s = player.status;
  if (s === 'in_field' || s === 'injured' || s === 'tired') return false;
  if (s === 'available') return true;
  if (s == null || s === '') return true;
  if (typeof s === 'string' && ['injured', 'tired', 'in_field'].includes(s.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Elencos de campo dos dois times (prioriza times vivos; senão roster na partida).
 * @returns {{ idsA: string[], idsB: string[] }}
 */
export function getFieldRosterIds(match, teamAObj, teamBObj) {
  const idsA = teamAObj?.players?.length ? [...teamAObj.players] : [...(match.rosterA || [])];
  const idsB = teamBObj?.players?.length ? [...teamBObj.players] : [...(match.rosterB || [])];
  return { idsA, idsB };
}

/**
 * Jogador está no elenco de campo de algum dos dois times da partida.
 */
export function isOnEitherFieldRoster(playerId, idsA, idsB) {
  const p = str(playerId);
  return idsA.some((id) => str(id) === p) || idsB.some((id) => str(id) === p);
}

/**
 * Goleiro externo defende um gol; não pode estar em campo em nenhum dos dois times.
 */
export function isOnFieldRosterForTeam(playerId, teamId, match, idsA, idsB) {
  const roster = teamId === match.teamA ? idsA : idsB;
  return roster.some((id) => str(id) === str(playerId));
}

/**
 * @param {object[]} teams — times da rodada
 * @param {object[]} players — lista de jogadores (ou usar mapa no caller)
 */
export function isEligibleExternalGoalkeeper(playerId, match, teams, players) {
  const pid = str(playerId);
  const roundId = match.roundId;
  const { teamA, teamB } = match;
  const player = players.find((pl) => str(pl.id) === pid);
  if (!player) return false;

  const roundTeams = teams.filter((t) => t.roundId === roundId);
  const containing = roundTeams.filter((t) => (t.players || []).some((id) => str(id) === pid));

  for (const t of containing) {
    if (t.status === 'in_field' && t.id !== teamA && t.id !== teamB) {
      return false;
    }
  }

  if (containing.length === 0) {
    return isBenchOrStreetCandidate(player);
  }

  const onlyNonPlayingWaiting = containing.every(
    (t) => t.status === 'waiting' && t.id !== teamA && t.id !== teamB
  );
  return onlyNonPlayingWaiting;
}

/**
 * IDs que podem ser selecionados como goleiro externo para um dos lados (defendem teamForGk).
 * Exclui quem está em qualquer elenco de campo (A ou B).
 */
export function eligibleExternalGoalkeeperIds(match, teams, players, teamForGk, idsA, idsB) {
  if (!teamForGk || (teamForGk !== match.teamA && teamForGk !== match.teamB)) return [];
  const out = [];
  for (const p of players) {
    if (!isEligibleExternalGoalkeeper(p.id, match, teams, players)) continue;
    if (isOnEitherFieldRoster(p.id, idsA, idsB)) continue;
    out.push(p.id);
  }
  return out;
}

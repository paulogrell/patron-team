/**
 * Regras de validação alinhadas ao modelo PlayerStat do SLF
 * (saturday_league_football/app/models/player_stat.rb).
 * Funções puras — sem I/O.
 */

export function teamGoalsTotal(rows, current = null) {
  let sum = 0;
  for (const r of rows) {
    if (current && r.playerId === current.playerId) continue;
    sum += Number(r.goals) || 0;
  }
  if (current) sum += Number(current.goals) || 0;
  return sum;
}

export function teamAssistsTotal(rows, current = null) {
  let sum = 0;
  for (const r of rows) {
    if (current && r.playerId === current.playerId) continue;
    sum += Number(r.assists) || 0;
  }
  if (current) sum += Number(current.assists) || 0;
  return sum;
}

/**
 * Valida uma linha contra as demais do mesmo time na partida.
 * @param {object} line - stats de um jogador no time
 * @param {object[]} sameTeamLines - todas as linhas do mesmo teamId na partida
 * @returns {string[]}
 */
export function validatePlayerStatLine(line, sameTeamLines) {
  const errors = [];
  const assists = Number(line.assists) || 0;
  const ownGoals = Number(line.ownGoals) || 0;
  const others = sameTeamLines.filter((r) => r.playerId !== line.playerId);
  const teamGoals = teamGoalsTotal(others, line);
  const teamAssists = teamAssistsTotal(others, line);

  if (assists > 0 && teamAssists > teamGoals) {
    errors.push('Assistências do time não podem exceder os gols do time.');
  }
  if (ownGoals > 0 && assists > 0) {
    errors.push('Não pode haver assistências com gols contra na mesma linha.');
  }
  if (line.wasGoalkeeper === true) {
    const alsoField = sameTeamLines.some(
      (r) => r.playerId === line.playerId && r !== line && r.wasGoalkeeper === false
    );
    if (alsoField) {
      errors.push('Jogador não pode ser goleiro e jogador de linha na mesma partida.');
    }
  }
  return errors;
}

/**
 * Valida todas as linhas de stats de uma partida, agrupadas por time.
 * @param {Array<{ playerId: string, teamId: string, goals?: number, assists?: number, ownGoals?: number, wasGoalkeeper?: boolean }>} lines
 * @returns {string[]}
 */
export function validateMatchPlayerStats(lines) {
  const byTeam = new Map();
  for (const line of lines) {
    if (!byTeam.has(line.teamId)) byTeam.set(line.teamId, []);
    byTeam.get(line.teamId).push(line);
  }
  const allErrors = [];
  for (const [, teamLines] of byTeam) {
    for (const line of teamLines) {
      for (const e of validatePlayerStatLine(line, teamLines)) {
        allErrors.push(e);
      }
    }
    const gkCount = teamLines.filter((l) => l.wasGoalkeeper === true).length;
    if (gkCount > 1) {
      allErrors.push('Só pode haver um goleiro externo por time.');
    }
  }
  return allErrors;
}

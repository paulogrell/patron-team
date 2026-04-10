/**
 * Rótulos padrão com letras do alfabeto (Time A … Time Z, depois Time 27…).
 * Ordem: primeiro todos os times em campo, depois os que aguardam (fila de espera).
 */

export function teamLabelAtIndex(index) {
  if (index < 0) return 'Time';
  if (index < 26) {
    return `Time ${String.fromCharCode(65 + index)}`;
  }
  return `Time ${index + 1}`;
}

/**
 * @param {object[]} teamsInField — times com status in_field (ordem do array preservada)
 * @param {object[]} teamsWaiting — times waiting (ex.: já ordenados por sortWaitingTeamsForRound)
 * @returns {Record<string, string>} teamId -> "Time A" | …
 */
export function buildTeamLabelById(teamsInField, teamsWaiting) {
  const map = {};
  let i = 0;
  for (const t of teamsInField || []) {
    if (t?.id) map[t.id] = teamLabelAtIndex(i);
    i += 1;
  }
  for (const t of teamsWaiting || []) {
    if (t?.id) map[t.id] = teamLabelAtIndex(i);
    i += 1;
  }
  return map;
}

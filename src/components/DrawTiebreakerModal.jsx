import React from 'react';

/**
 * Empate com um time waiting na fila: escolher qual time (A ou B) leva vantagem na fila.
 */
export default function DrawTiebreakerModal({ match, teams, teamLabelById = {}, onPick, onCancel }) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const a = teamMap[match.teamA];
  const b = teamMap[match.teamB];
  const labelA = a?.displayName?.trim() || teamLabelById[match.teamA] || 'Lado A';
  const labelB = b?.displayName?.trim() || teamLabelById[match.teamB] || 'Lado B';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content match-stats-modal">
        <h3>Desempate na fila</h3>
        <p className="modal-sub">
          Há um time aguardando e o jogo empatou. Escolha qual time (lado A ou B da partida) entra com
          prioridade na fila de jogadores.
        </p>
        <div className="tiebreaker-actions">
          <button
            type="button"
            className="btn btn-match btn-a-win"
            onClick={() => onPick(match.teamA)}
          >
            Prioridade: {labelA}
            {a ? ` (${a.players?.length || 0} jog.)` : ''}
          </button>
          <button
            type="button"
            className="btn btn-match btn-b-win"
            onClick={() => onPick(match.teamB)}
          >
            Prioridade: {labelB}
            {b ? ` (${b.players?.length || 0} jog.)` : ''}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

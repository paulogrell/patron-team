import React from 'react';

/**
 * MatchHistory — Exibe o histórico de partidas registradas.
 * Mostra os times envolvidos e o resultado formatado em português.
 *
 * @param {object} props
 * @param {Array} props.matches - Lista de partidas
 * @param {Array} props.teams - Lista de todos os times (para resolver IDs)
 */
export default function MatchHistory({ matches, teams }) {
  // Mapa de times por ID
  const teamMap = {};
  for (const t of teams) {
    teamMap[t.id] = t;
  }

  // Mapeia resultados para rótulos legíveis
  const resultLabel = {
    A_win: '🏆 Time A venceu',
    B_win: '🏆 Time B venceu',
    draw: '🤝 Empate',
  };

  const resultClass = {
    A_win: 'result-a-win',
    B_win: 'result-b-win',
    draw: 'result-draw',
  };

  // Ordena partidas da mais recente para a mais antiga
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  return (
    <div className="panel history-panel">
      <h2>📋 Histórico de Partidas ({matches.length})</h2>
      {sortedMatches.length === 0 ? (
        <p className="empty-message">Nenhuma partida registrada ainda.</p>
      ) : (
        <ul className="match-list">
          {sortedMatches.map((match) => (
            <li key={match.id} className={`match-item ${resultClass[match.result]}`}>
              <div className="match-info">
                <span className="match-teams">
                  Time A vs Time B
                </span>
                <span className="match-result">{resultLabel[match.result]}</span>
              </div>
              <span className="match-time">
                {new Date(match.timestamp).toLocaleString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


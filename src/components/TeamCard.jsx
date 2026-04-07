import React from 'react';

/**
 * TeamCard — Exibe um card de time com a lista de jogadores.
 * Mostra o status do time e permite ações rápidas.
 *
 * @param {object} props
 * @param {object} props.team - Dados do time
 * @param {Array} props.allPlayers - Lista de todos os jogadores (para resolver nomes)
 * @param {string} props.label - Rótulo do time (ex.: "Time A", "Time B")
 */
export default function TeamCard({ team, allPlayers, label }) {
  // Cria um mapa de jogadores por ID para acesso rápido
  const playerMap = {};
  for (const p of allPlayers) {
    playerMap[p.id] = p;
  }

  return (
    <div className={`team-card ${team.status === 'in_field' ? 'team-active' : 'team-waiting'}`}>
      <h3>
        {label || `Time`}{' '}
        <span className="team-status">
          {team.status === 'in_field' ? '🏟️ Em campo' : '⏳ Aguardando'}
        </span>
      </h3>
      <ul className="team-players">
        {team.players.map((pid) => {
          const player = playerMap[pid];
          return (
            <li key={pid} className="team-player-item">
              {player ? player.name : `Jogador ${pid.slice(0, 8)}...`}
              {player && player.status !== 'in_field' && (
                <span className="player-badge">
                  {player.status === 'injured' ? ' 🤕' : player.status === 'tired' ? ' 😓' : ''}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="team-meta">
        Criado em: {new Date(team.createdAt).toLocaleString('pt-BR')}
      </p>
    </div>
  );
}


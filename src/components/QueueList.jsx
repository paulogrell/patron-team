import React from 'react';

/**
 * QueueList — Exibe a fila de jogadores ordenada por FIFO (joinedAt).
 * Mostra o status de cada jogador com cores diferenciadas.
 *
 * @param {object} props
 * @param {Array} props.players - Lista de jogadores
 * @param {function} props.onRemove - Callback para remover jogador (id, motivo, substituir)
 */
export default function QueueList({ players, onRemove }) {
  // Mapeia status para rótulos em português
  const statusLabel = {
    available: '🟢 Disponível',
    in_field: '🔵 Em campo',
    injured: '🔴 Lesionado',
    tired: '🟡 Cansado',
  };

  const statusClass = {
    available: 'status-available',
    in_field: 'status-in-field',
    injured: 'status-injured',
    tired: 'status-tired',
  };

  return (
    <div className="panel queue-panel">
      <h2>⚽ Fila de Jogadores ({players.length})</h2>
      {players.length === 0 ? (
        <p className="empty-message">Nenhum jogador na fila. Adicione jogadores para começar!</p>
      ) : (
        <ul className="player-list">
          {players.map((player, index) => (
            <li key={player.id} className={`player-item ${statusClass[player.status]}`}>
              <div className="player-info">
                <span className="player-position">#{index + 1}</span>
                <span className="player-name">{player.name}</span>
                <span className="player-status">{statusLabel[player.status]}</span>
              </div>
              {/* Botões de ação disponíveis apenas para jogadores em campo */}
              {player.status === 'in_field' && (
                <div className="player-actions">
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => onRemove(player.id, 'injured', false)}
                    title="Marcar como lesionado"
                  >
                    🤕 Lesão
                  </button>
                  <button
                    className="btn btn-info btn-sm"
                    onClick={() => onRemove(player.id, 'tired', false)}
                    title="Marcar como cansado"
                  >
                    😓 Cansado
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onRemove(player.id, 'tired', true)}
                    title="Substituir por próximo da fila"
                  >
                    🔄 Substituir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


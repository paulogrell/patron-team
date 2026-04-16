import React from 'react';

/**
 * Exibe rodada ativa (sem criar novas). Múltiplas rodadas só por import legado.
 */
export default function RoundSelector({ rounds, activeRoundId, onSelectRound }) {
  const active = rounds.find((r) => r.id === activeRoundId);

  if (rounds.length <= 1) {
    return (
      <div className="panel round-selector-panel" data-testid="round-panel">
        <h2>Rodada</h2>
        <p className="info-message">
          {active ? (
            <>
              <strong>{active.name}</strong>
              <span className="subtle"> — {new Date(active.createdAt).toLocaleString('pt-BR')}</span>
            </>
          ) : (
            'Carregando…'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="panel round-selector-panel" data-testid="round-panel">
      <h2>Rodada</h2>
      <div className="form-row">
        <label htmlFor="roundSelect">Rodada ativa (import legado):</label>
        <select
          id="roundSelect"
          data-testid="round-select"
          className="input-text"
          value={activeRoundId || ''}
          onChange={(e) => onSelectRound(e.target.value)}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({new Date(r.createdAt).toLocaleDateString('pt-BR')})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

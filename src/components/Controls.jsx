import React, { useState, useRef } from 'react';

/**
 * Controles: jogadores, formar um time (limite N), sugestão de partida, backup.
 */
export default function Controls({
  onAddPlayer,
  onFormTeam,
  onSuggestNext,
  suggestion,
  onScheduleSuggested,
  onExport,
  onImport,
  activeRoundId,
  teamSize,
  onTeamSizeChange,
}) {
  const [playerName, setPlayerName] = useState('');
  const fileInputRef = useRef(null);

  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      onAddPlayer(playerName.trim());
      setPlayerName('');
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        onImport(json);
      } catch {
        alert('Erro ao ler arquivo JSON. Verifique o formato.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const canAct = Boolean(activeRoundId);

  return (
    <div className="panel controls-panel">
      <h2>Controles</h2>
      {!canAct && <p className="info-message">Carregando rodada…</p>}

      <section className="control-section">
        <h3>Adicionar jogador</h3>
        <form onSubmit={handleAddPlayer} className="add-player-form">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Nome do jogador..."
            className="input-text"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!canAct}>
            Adicionar
          </button>
        </form>
      </section>

      <section className="control-section">
        <h3>Limite de jogadores por time</h3>
        <p className="info-message subtle">
          Use o mesmo número ao formar time e ao calcular a próxima partida automática.
        </p>
        <div className="form-row">
          <label htmlFor="teamSize">Jogadores por time:</label>
          <input
            id="teamSize"
            type="number"
            min="1"
            max="20"
            value={teamSize}
            onChange={(e) => onTeamSizeChange(Number(e.target.value))}
            className="input-number"
          />
          <button
            type="button"
            onClick={() => onFormTeam(teamSize)}
            className="btn btn-success"
            disabled={!canAct}
          >
            Formar 1 time
          </button>
        </div>
      </section>

      <section className="control-section">
        <h3>Próxima partida (sugestão)</h3>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!canAct}
          onClick={() => onSuggestNext()}
        >
          Sugerir confronto
        </button>
        {suggestion?.ok && (
          <p className="info-message">
            Dois primeiros times em campo (não bloqueados). Agende para registrar no histórico.
          </p>
        )}
        {suggestion && !suggestion.ok && (
          <p className="info-message warning-text">{suggestion.error}</p>
        )}
        {suggestion?.ok && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canAct}
            onClick={() => onScheduleSuggested()}
          >
            Agendar partida sugerida
          </button>
        )}
      </section>

      <section className="control-section">
        <h3>Backup / Restore</h3>
        <div className="backup-buttons">
          <button type="button" onClick={onExport} className="btn btn-outline">
            Exportar dados
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-outline"
          >
            Importar dados
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </section>
    </div>
  );
}

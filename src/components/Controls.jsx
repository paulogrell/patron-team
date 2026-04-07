import React, { useState, useRef } from 'react';

/**
 * Controls — Painel de controles com botões de ação rápida.
 * Permite adicionar jogadores, formar times, registrar partidas
 * e fazer export/import de dados.
 *
 * @param {object} props
 * @param {function} props.onAddPlayer - Callback para adicionar jogador
 * @param {function} props.onFormTeam - Callback para formar time
 * @param {function} props.onRecordMatch - Callback para registrar partida
 * @param {function} props.onExport - Callback para exportar dados
 * @param {function} props.onImport - Callback para importar dados
 * @param {Array} props.teamsInField - Times atualmente em campo
 */
export default function Controls({
  onAddPlayer,
  onFormTeam,
  onRecordMatch,
  onExport,
  onImport,
  teamsInField,
}) {
  const [playerName, setPlayerName] = useState('');
  const [teamSize, setTeamSize] = useState(5);
  const fileInputRef = useRef(null);

  // Adiciona jogador ao pressionar Enter ou clicar no botão
  const handleAddPlayer = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      onAddPlayer(playerName.trim());
      setPlayerName('');
    }
  };

  // Importa dados de um arquivo JSON
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
    // Limpa o input para permitir reimportação do mesmo arquivo
    e.target.value = '';
  };

  return (
    <div className="panel controls-panel">
      <h2>🎮 Controles</h2>

      {/* Seção: Adicionar jogador */}
      <section className="control-section">
        <h3>Adicionar Jogador</h3>
        <form onSubmit={handleAddPlayer} className="add-player-form">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Nome do jogador..."
            className="input-text"
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            ➕ Adicionar
          </button>
        </form>
      </section>

      {/* Seção: Formar time */}
      <section className="control-section">
        <h3>Formar Time</h3>
        <div className="form-row">
          <label htmlFor="teamSize">Jogadores por time:</label>
          <input
            id="teamSize"
            type="number"
            min="1"
            max="20"
            value={teamSize}
            onChange={(e) => setTeamSize(Number(e.target.value))}
            className="input-number"
          />
          <button onClick={() => onFormTeam(teamSize)} className="btn btn-success">
            👥 Formar Time
          </button>
        </div>
      </section>

      {/* Seção: Registrar resultado da partida */}
      <section className="control-section">
        <h3>Registrar Partida</h3>
        {teamsInField.length < 2 ? (
          <p className="info-message">
            ⚠️ É necessário pelo menos 2 times em campo para registrar uma partida.
          </p>
        ) : (
          <div className="match-controls">
            <p className="info-message">
              Times em campo: <strong>{teamsInField.length}</strong>
            </p>
            <div className="match-buttons">
              <button
                className="btn btn-match btn-a-win"
                onClick={() =>
                  onRecordMatch(teamsInField[0].id, teamsInField[1].id, 'A_win')
                }
              >
                🏆 Time A Venceu
              </button>
              <button
                className="btn btn-match btn-draw"
                onClick={() =>
                  onRecordMatch(teamsInField[0].id, teamsInField[1].id, 'draw')
                }
              >
                🤝 Empate
              </button>
              <button
                className="btn btn-match btn-b-win"
                onClick={() =>
                  onRecordMatch(teamsInField[0].id, teamsInField[1].id, 'B_win')
                }
              >
                🏆 Time B Venceu
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Seção: Backup / Restore */}
      <section className="control-section">
        <h3>💾 Backup / Restore</h3>
        <div className="backup-buttons">
          <button onClick={onExport} className="btn btn-outline">
            📤 Exportar Dados
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-outline">
            📥 Importar Dados
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


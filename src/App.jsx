import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  addPlayer,
  getPlayers,
  getTeams,
  getMatches,
  formTeam,
  removePlayer,
  recordMatch,
  exportData,
  importData,
  onChange,
  recordGoal,
  removeGoal,
  recordAssist,
  removeAssist,
} from './api/indexeddb.js';
import QueueList from './components/QueueList.jsx';
import TeamCard from './components/TeamCard.jsx';
import MatchHistory from './components/MatchHistory.jsx';
import Controls from './components/Controls.jsx';
import PlayerStats from './components/PlayerStats.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { isAuthenticated, clearSession } from './auth/auth.js';
import './styles.css';

/**
 * App — Componente principal da aplicação Arjen Queue.
 * Gerencia o estado global carregando dados do IndexedDB
 * e sincronizando com outras abas via BroadcastChannel.
 * Inclui gate de autenticação antes de exibir o conteúdo.
 */
export default function App() {
  // Estado de autenticação — verifica sessão ativa ao montar
  const [autenticado, setAutenticado] = useState(isAuthenticated());
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  // Aba ativa: 'queue' (visão principal) ou 'stats' (estatísticas)
  const [activeTab, setActiveTab] = useState('queue');

  /** Callback de login bem-sucedido */
  const handleLogin = () => setAutenticado(true);

  /** Logout — limpa sessão e volta para tela de login */
  const handleLogout = () => {
    clearSession();
    setAutenticado(false);
  };

  // Se não autenticado, exibe tela de login
  if (!autenticado) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  /**
   * Recarrega todos os dados do IndexedDB para o estado React.
   * Chamado na inicialização e sempre que há mudanças.
   */
  const refreshData = useCallback(async () => {
    try {
      const [p, t, m] = await Promise.all([getPlayers(), getTeams(), getMatches()]);
      setPlayers(p);
      setTeams(t);
      setMatches(m);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados do banco.');
    }
  }, []);

  // Carrega dados na montagem e configura sincronização entre abas
  useEffect(() => {
    refreshData();

    // Escuta mudanças de outras abas via BroadcastChannel
    const unsubscribe = onChange((event) => {
      console.log('Mudança detectada em outra aba:', event.type);
      refreshData();
    });

    return unsubscribe;
  }, [refreshData]);

  // ---------- Handlers ----------

  const handleAddPlayer = async (name) => {
    try {
      await addPlayer(name);
      toast.success(`Jogador "${name}" adicionado à fila!`);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleFormTeam = async (size) => {
    try {
      await formTeam(size);
      toast.success(`Time de ${size} jogadores formado!`);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRemovePlayer = async (playerId, reason, substitute) => {
    try {
      await removePlayer(playerId, reason, substitute);
      const msg = substitute
        ? 'Jogador substituído com sucesso!'
        : `Jogador marcado como ${reason === 'injured' ? 'lesionado' : 'cansado'}.`;
      toast.success(msg);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRecordMatch = async (teamAId, teamBId, result) => {
    try {
      await recordMatch(teamAId, teamBId, result);
      const labels = { A_win: 'Time A venceu!', B_win: 'Time B venceu!', draw: 'Empate!' };
      toast.success(`Partida registrada: ${labels[result]}`);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-queue-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      toast.error(`Erro ao exportar: ${err.message}`);
    }
  };

  const handleImport = async (json) => {
    try {
      await importData(json);
      toast.success('Dados importados com sucesso!');
      await refreshData();
    } catch (err) {
      toast.error(`Erro ao importar: ${err.message}`);
    }
  };

  // ---------- Handlers de Estatísticas (gols e assistências) ----------

  const handleRecordGoal = async (playerId) => {
    try {
      await recordGoal(playerId);
      toast.success('⚽ Gol registrado!');
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRemoveGoal = async (playerId) => {
    try {
      await removeGoal(playerId);
      toast.success('Gol removido.');
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRecordAssist = async (playerId) => {
    try {
      await recordAssist(playerId);
      toast.success('👟 Assistência registrada!');
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRemoveAssist = async (playerId) => {
    try {
      await removeAssist(playerId);
      toast.success('Assistência removida.');
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // Filtra times atualmente em campo para o painel de partidas
  const teamsInField = teams.filter((t) => t.status === 'in_field');

  return (
    <div className="app-container">
      <Toaster position="top-right" />

      <header className="app-header">
        <div className="app-header-top">
          <h1>⚽ Arjen — Fila de Times</h1>
          <button className="btn btn-logout" onClick={handleLogout} title="Sair">
            🚪 Sair
          </button>
        </div>
        <p>Gerenciador de fila de peladeiros</p>
      </header>

      {/* Navegação por abas */}
      <nav className="app-tabs">
        <button
          className={`tab-btn ${activeTab === 'queue' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          🏟️ Fila &amp; Partidas
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Estatísticas
        </button>
      </nav>

      {activeTab === 'queue' ? (
        <main className="app-main">
          {/* Coluna esquerda: Controles */}
          <Controls
            onAddPlayer={handleAddPlayer}
            onFormTeam={handleFormTeam}
            onRecordMatch={handleRecordMatch}
            onExport={handleExport}
            onImport={handleImport}
            teamsInField={teamsInField}
          />

          {/* Coluna central: Fila de jogadores */}
          <QueueList players={players} onRemove={handleRemovePlayer} />

          {/* Coluna direita: Times em campo e Histórico */}
          <div className="right-column">
            <div className="panel teams-panel">
              <h2>🏟️ Times em Campo ({teamsInField.length})</h2>
              {teamsInField.length === 0 ? (
                <p className="empty-message">Nenhum time em campo.</p>
              ) : (
                <div className="teams-grid">
                  {teamsInField.map((team, idx) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      allPlayers={players}
                      label={`Time ${String.fromCharCode(65 + idx)}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <MatchHistory matches={matches} teams={teams} />
          </div>
        </main>
      ) : (
        <main className="app-main-stats">
          <PlayerStats
            players={players}
            onRecordGoal={handleRecordGoal}
            onRemoveGoal={handleRemoveGoal}
            onRecordAssist={handleRecordAssist}
            onRemoveAssist={handleRemoveAssist}
          />
        </main>
      )}

      <footer className="app-footer">
        <p>Arjen</p>
      </footer>
    </div>
  );
}


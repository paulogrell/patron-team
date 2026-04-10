import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  addPlayer,
  getPlayers,
  getTeams,
  getMatches,
  formTeam,
  removePlayer,
  restorePlayerToAvailable,
  scheduleMatch,
  finalizeMatch,
  updatePlayerName,
  updateTeamDisplayName,
  updateTeamRoster,
  updateScheduledMatchTeams,
  cancelScheduledMatch,
  exportData,
  importData,
  onChange,
  ensureDefaultActiveRound,
  getActiveRoundId,
  setActiveRoundId,
  getRounds,
  suggestNextMatchForRound,
  getRoundStatistics,
  getMatchScoresForRound,
  listPreWaitingTeamIds,
} from './api/indexeddb.js';
import { sortWaitingTeamsForRound } from './domain/waitingQueueOrder.js';
import { buildTeamLabelById } from './domain/teamLabels.js';
import QueueList from './components/QueueList.jsx';
import TeamCard from './components/TeamCard.jsx';
import MatchHistory from './components/MatchHistory.jsx';
import Controls from './components/Controls.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import RoundSelector from './components/RoundSelector.jsx';
import RoundStatistics from './components/RoundStatistics.jsx';
import MatchStatsModal from './components/MatchStatsModal.jsx';
import DrawTiebreakerModal from './components/DrawTiebreakerModal.jsx';
import EditPlayerModal from './components/EditPlayerModal.jsx';
import EditTeamModal from './components/EditTeamModal.jsx';
import EditScheduledMatchModal from './components/EditScheduledMatchModal.jsx';
import { isAuthenticated, clearSession } from './auth/auth.js';
import './styles.css';

export default function App() {
  const [autenticado, setAutenticado] = useState(isAuthenticated());
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [activeRoundId, setActiveRoundIdState] = useState(null);
  const [roundStatsRows, setRoundStatsRows] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [suggestion, setSuggestion] = useState(null);
  const [statsModalMatch, setStatsModalMatch] = useState(null);
  const [activeTab, setActiveTab] = useState('queue');
  const [teamSize, setTeamSize] = useState(5);
  const [drawTiebreakerMatch, setDrawTiebreakerMatch] = useState(null);
  const [editPlayer, setEditPlayer] = useState(null);
  const [editTeam, setEditTeam] = useState(null);
  const [editTeamDefaultLabel, setEditTeamDefaultLabel] = useState('');
  const [editMatch, setEditMatch] = useState(null);

  const handleLogin = () => setAutenticado(true);

  const handleLogout = () => {
    clearSession();
    setAutenticado(false);
  };

  if (!autenticado) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  const refreshData = useCallback(async () => {
    try {
      await ensureDefaultActiveRound();
      const aid = await getActiveRoundId();
      setActiveRoundIdState(aid);
      const [p, t, m, r, stats, scores] = await Promise.all([
        getPlayers(),
        aid ? getTeams(aid) : getTeams(),
        aid ? getMatches(aid) : getMatches(),
        getRounds(),
        aid ? getRoundStatistics(aid) : Promise.resolve([]),
        aid ? getMatchScoresForRound(aid) : Promise.resolve({}),
      ]);
      setPlayers(p);
      setTeams(t);
      setMatches(m);
      setRounds(r);
      setRoundStatsRows(stats);
      setMatchScores(scores);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados do banco.');
    }
  }, []);

  useEffect(() => {
    refreshData();
    const unsubscribe = onChange(() => {
      refreshData();
    });
    return unsubscribe;
  }, [refreshData]);

  const handleSelectRound = async (roundId) => {
    try {
      await setActiveRoundId(roundId);
      setSuggestion(null);
      await refreshData();
      toast.success('Rodada ativa alterada.');
    } catch (err) {
      toast.error(err.message);
    }
  };

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
    if (!activeRoundId) return;
    try {
      const team = await formTeam(size, activeRoundId);
      const n = team.players?.length ?? 0;
      toast.success(`Time de ${n} jogadores formado!`);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleSuggestNext = async () => {
    if (!activeRoundId) return;
    try {
      const s = await suggestNextMatchForRound(activeRoundId, teamSize);
      setSuggestion(s);
      if (s.ok) toast.success('Sugestão calculada.');
      else toast.error(s.error);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleScheduleSuggested = async () => {
    if (!activeRoundId || !suggestion?.ok) return;
    try {
      await scheduleMatch(activeRoundId, suggestion.teamAId, suggestion.teamBId, { teamSize });
      toast.success('Partida agendada. Edite stats e finalize no histórico.');
      setSuggestion(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleFinalizeScheduled = async (matchId, result, tiebreakerWinnerTeamId = null) => {
    try {
      await finalizeMatch(matchId, result, { teamSize, tiebreakerWinnerTeamId });
      toast.success('Partida finalizada.');
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRequestDraw = async (match) => {
    if (!activeRoundId) return;
    try {
      const pre = await listPreWaitingTeamIds(activeRoundId, teamSize);
      if (pre.length === 1) {
        setDrawTiebreakerMatch(match);
        return;
      }
      await handleFinalizeScheduled(match.id, 'draw');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTiebreakerPick = async (winnerTeamId) => {
    if (!drawTiebreakerMatch) return;
    try {
      await finalizeMatch(drawTiebreakerMatch.id, 'draw', {
        teamSize,
        tiebreakerWinnerTeamId: winnerTeamId,
      });
      toast.success('Partida finalizada.');
      setDrawTiebreakerMatch(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemovePlayer = async (playerId, reason, substitute) => {
    try {
      const { substituted } = await removePlayer(
        playerId,
        reason,
        substitute,
        activeRoundId,
        teamSize
      );
      const msg = substituted
        ? `${reason === 'injured' ? 'Lesão' : 'Cansado'} registrado — substituto entrou a partir do próximo time na fila.`
        : `Jogador marcado como ${reason === 'injured' ? 'lesionado' : 'cansado'}.`;
      toast.success(msg);
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleRestorePlayer = async (playerId) => {
    try {
      await restorePlayerToAvailable(playerId);
      toast.success('Jogador liberado e colocado no fim da fila.');
      await refreshData();
    } catch (err) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleSavePlayerName = async (playerId, name) => {
    try {
      await updatePlayerName(playerId, name);
      toast.success('Nome do jogador atualizado.');
      setEditPlayer(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveTeam = async (teamId, { displayName, playerIds }) => {
    try {
      await updateTeamDisplayName(teamId, displayName);
      const orig =
        teams.find((x) => x.id === teamId)?.players ?? editTeam?.players ?? [];
      const rosterChanged = JSON.stringify(playerIds) !== JSON.stringify(orig);
      if (rosterChanged) {
        if (!activeRoundId) {
          toast.error('Selecione uma rodada.');
          return;
        }
        await updateTeamRoster(teamId, playerIds, activeRoundId, { teamSize });
      }
      toast.success('Time atualizado.');
      setEditTeam(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveScheduledTeams = async (matchId, teamAId, teamBId) => {
    try {
      await updateScheduledMatchTeams(matchId, teamAId, teamBId, { teamSize });
      toast.success('Times da partida atualizados.');
      setEditMatch(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancelScheduledMatch = async (matchId) => {
    try {
      await cancelScheduledMatch(matchId);
      toast.success('Partida cancelada.');
      setEditMatch(null);
      await refreshData();
    } catch (err) {
      toast.error(err.message);
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

  const teamsInField = teams.filter((t) => t.status === 'in_field');
  const teamsWaiting = useMemo(
    () =>
      activeRoundId
        ? sortWaitingTeamsForRound(teams, activeRoundId, players, teamSize)
        : [],
    [teams, activeRoundId, players, teamSize]
  );

  const teamLabelById = useMemo(
    () => buildTeamLabelById(teamsInField, teamsWaiting),
    [teamsInField, teamsWaiting]
  );

  return (
    <div className="app-container">
      <Toaster position="top-right" />

      <header className="app-header">
        <div className="app-header-top">
          <h1>Arjen — Fila de times</h1>
          <button className="btn btn-logout" onClick={handleLogout} title="Sair" type="button">
            Sair
          </button>
        </div>
        <p>Gerenciador de fila de peladeiros (partidas e stats locais)</p>
      </header>

      <RoundSelector
        rounds={rounds}
        activeRoundId={activeRoundId}
        onSelectRound={handleSelectRound}
      />

      <nav className="app-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'queue' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          Fila e partidas
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'round' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('round')}
        >
          Estatísticas da rodada
        </button>
      </nav>

      {activeTab === 'queue' ? (
        <main className="app-main">
          <Controls
            onAddPlayer={handleAddPlayer}
            onFormTeam={handleFormTeam}
            onSuggestNext={handleSuggestNext}
            suggestion={suggestion}
            onScheduleSuggested={handleScheduleSuggested}
            onExport={handleExport}
            onImport={handleImport}
            activeRoundId={activeRoundId}
            teamSize={teamSize}
            onTeamSizeChange={setTeamSize}
          />
          <div className="center-column">
            <MatchHistory
              matches={matches}
              teams={teams}
              teamLabelById={teamLabelById}
              matchScores={matchScores}
              onEditStats={(m) => setStatsModalMatch(m)}
              onEditScheduledMatch={(m) => setEditMatch(m)}
              onFinalize={(id, res) => handleFinalizeScheduled(id, res)}
              onRequestDraw={handleRequestDraw}
            />
            <QueueList
              players={players}
              onRemove={handleRemovePlayer}
              onRestore={handleRestorePlayer}
              onEditPlayer={(p) => setEditPlayer(p)}
              waitingTeams={teamsWaiting}
            />
          </div>
          <div className="right-column">
            <div className="panel teams-panel">
              <h2>Times em campo ({teamsInField.length})</h2>
              {teamsInField.length === 0 ? (
                <p className="empty-message">Nenhum time em campo nesta rodada.</p>
              ) : (
                <div className="teams-grid">
                  {teamsInField.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      allPlayers={players}
                      label={teamLabelById[team.id] || 'Time'}
                      onEditTeam={(t, lbl) => {
                        setEditTeam(t);
                        setEditTeamDefaultLabel(lbl);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="panel teams-panel teams-waiting-panel">
              <h2>Próximos na fila ({teamsWaiting.length})</h2>
              {teamsWaiting.length === 0 ? (
                <p className="empty-message">Nenhum time aguardando nesta rodada.</p>
              ) : (
                <div className="teams-grid">
                  {teamsWaiting.map((team, idx) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      allPlayers={players}
                      label={teamLabelById[team.id] || 'Time'}
                      waitingQueueIndex={idx + 1}
                      onEditTeam={(t, lbl) => {
                        setEditTeam(t);
                        setEditTeamDefaultLabel(lbl);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="app-main-stats">
          <RoundStatistics rows={roundStatsRows} />
        </main>
      )}

      {statsModalMatch && activeRoundId && (
        <MatchStatsModal
          match={statsModalMatch}
          teams={teams}
          teamLabelById={teamLabelById}
          allPlayers={players}
          roundId={activeRoundId}
          onClose={() => setStatsModalMatch(null)}
          onSaved={() => {
            toast.success('Stats salvas.');
            refreshData();
          }}
        />
      )}

      {drawTiebreakerMatch && (
        <DrawTiebreakerModal
          match={drawTiebreakerMatch}
          teams={teams}
          teamLabelById={teamLabelById}
          onPick={handleTiebreakerPick}
          onCancel={() => setDrawTiebreakerMatch(null)}
        />
      )}

      {editPlayer && (
        <EditPlayerModal
          player={editPlayer}
          onClose={() => setEditPlayer(null)}
          onSave={handleSavePlayerName}
        />
      )}

      {editTeam && (
        <EditTeamModal
          team={editTeam}
          defaultLabel={editTeamDefaultLabel}
          allPlayers={players}
          roundTeams={teams}
          teamSize={teamSize}
          onClose={() => setEditTeam(null)}
          onSave={handleSaveTeam}
        />
      )}

      {editMatch && activeRoundId && (
        <EditScheduledMatchModal
          match={editMatch}
          teams={teams}
          teamLabelById={teamLabelById}
          teamSize={teamSize}
          onClose={() => setEditMatch(null)}
          onSave={handleSaveScheduledTeams}
          onCancelMatch={handleCancelScheduledMatch}
        />
      )}

      <footer className="app-footer">
        <p>Arjen — IndexedDB v3</p>
      </footer>
    </div>
  );
}
